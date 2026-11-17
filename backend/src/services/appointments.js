import mongoose from 'mongoose'
import { runAtomic } from '../config/db.js'
import { ACTIVE_APPOINTMENT_STATUSES } from '../models/enums.js'
import { Appointment, AppointmentSlot, Doctor, Patient } from '../models/index.js'
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js'
import { notify } from './notifications.js'
import { findSlot, localTimeString } from './schedule.js'
import { getSettings } from './settings.js'

const HOUR = 60 * 60 * 1000

export const STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'completed', 'no_show', 'cancelled'],
  checked_in: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
}

const ROLE_STATUS_CHANGES = {
  patient: ['cancelled'],
  doctor: ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'],
  admin: ['confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'],
}

const opts = session => (session ? { session } : {})

function isDuplicateKey(error) {
  return error?.code === 11000 || error?.errorResponse?.code === 11000
}

async function loadBookableDoctor(doctorId) {
  const doctor = await Doctor.findById(doctorId).lean()
  if (!doctor) throw notFound('Doctor not found.')
  const settings = await getSettings()
  if (settings.requireDoctorVerification && doctor.verificationStatus !== 'verified') throw badRequest('This doctor is not accepting bookings yet.')
  return { doctor, settings }
}

function validateSlot(doctor, settings, startAt) {
  const now = Date.now()
  if (Number.isNaN(startAt.getTime())) throw badRequest('startAt must be a valid date.')
  if (startAt.getTime() <= now) throw badRequest('Appointments must be booked for a future time.')
  if (startAt.getTime() > now + settings.maxBookingDaysAhead * 24 * HOUR) throw badRequest(`Appointments can be booked up to ${settings.maxBookingDaysAhead} days ahead.`)
  const slot = findSlot(doctor, startAt)
  if (!slot) throw badRequest('The selected time is outside the doctor\'s available slots.')
  return slot
}

async function assertPatientFree(patientId, slot, excludeId) {
  const clash = await Appointment.exists({
    patientId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    startAt: { $lt: slot.endAt },
    endAt: { $gt: slot.startAt },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
  if (clash) throw conflict('You already have another appointment at this time.')
}

async function userIdsFor(appointment) {
  const [patient, doctor] = await Promise.all([
    Patient.findById(appointment.patientId, { userId: 1, fullName: 1 }).lean(),
    Doctor.findById(appointment.doctorId, { userId: 1, fullName: 1 }).lean(),
  ])
  return { patient, doctor }
}

// Reserve the slot first so the unique index decides between racing requests,
// then write the appointment and notifications in the same transaction.
export async function bookAppointment({ patientId, doctorId, startAt, consultationType, reason, status = 'confirmed' }) {
  const patient = await Patient.findById(patientId).lean()
  if (!patient) throw notFound('Patient not found.')
  const { doctor, settings } = await loadBookableDoctor(doctorId)
  const slot = validateSlot(doctor, settings, startAt)
  await assertPatientFree(patientId, slot)

  const appointmentId = new mongoose.Types.ObjectId()
  try {
    return await runAtomic(async session => {
      await AppointmentSlot.create([{ doctorId, startAt: slot.startAt, appointmentId }], opts(session))
      let appointment
      try {
        [appointment] = await Appointment.create([{ _id: appointmentId, patientId, doctorId, startAt: slot.startAt, endAt: slot.endAt, status, consultationType, reason }], opts(session))
      } catch (error) {
        if (!session) await AppointmentSlot.deleteOne({ appointmentId })
        throw error
      }
      const when = `${slot.startAt.toISOString().slice(0, 10)} ${localTimeString(slot.startAt)}`
      await notify([patient.userId], { type: 'appointment_booked', title: `Appointment booked with ${doctor.fullName} on ${when}`, relatedId: appointmentId }, session)
      await notify([doctor.userId], { type: 'appointment_booked', title: `New appointment with ${patient.fullName} on ${when}`, relatedId: appointmentId }, session)
      return appointment
    })
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('This time slot has just been booked. Please choose another time.')
    throw error
  }
}

export async function rescheduleAppointment(appointment, startAt) {
  if (!ACTIVE_APPOINTMENT_STATUSES.includes(appointment.status) || appointment.status === 'checked_in') throw badRequest(`A ${appointment.status} appointment cannot be rescheduled.`)
  const { doctor, settings } = await loadBookableDoctor(appointment.doctorId)
  const slot = validateSlot(doctor, settings, startAt)
  if (slot.startAt.getTime() === appointment.startAt.getTime()) throw badRequest('The appointment is already booked for this time.')
  await assertPatientFree(appointment.patientId, slot, appointment._id)

  const previousStart = appointment.startAt
  try {
    return await runAtomic(async session => {
      await AppointmentSlot.create([{ doctorId: appointment.doctorId, startAt: slot.startAt, appointmentId: appointment._id }], opts(session))
      try {
        await AppointmentSlot.deleteOne({ doctorId: appointment.doctorId, startAt: previousStart, appointmentId: appointment._id }, opts(session))
        const updated = await Appointment.findOneAndUpdate(
          { _id: appointment._id, startAt: previousStart },
          { $set: { startAt: slot.startAt, endAt: slot.endAt }, $inc: { rescheduleCount: 1 } },
          { returnDocument: 'after', ...opts(session) },
        )
        if (!updated) throw conflict('The appointment was changed by another request. Please refresh and try again.')
        const { patient, doctor: doc } = await userIdsFor(updated)
        await notify([patient?.userId, doc?.userId], { type: 'appointment_rescheduled', title: `Appointment moved to ${slot.startAt.toISOString().slice(0, 10)} ${localTimeString(slot.startAt)}`, relatedId: updated._id }, session)
        return updated
      } catch (error) {
        if (!session) {
          await AppointmentSlot.deleteOne({ doctorId: appointment.doctorId, startAt: slot.startAt, appointmentId: appointment._id })
          await AppointmentSlot.updateOne({ doctorId: appointment.doctorId, startAt: previousStart }, { $setOnInsert: { appointmentId: appointment._id } }, { upsert: true })
        }
        throw error
      }
    })
  } catch (error) {
    if (isDuplicateKey(error)) throw conflict('This time slot has just been booked. Please choose another time.')
    throw error
  }
}

export async function changeAppointmentStatus(appointment, nextStatus, actor, cancellationReason) {
  if (!ROLE_STATUS_CHANGES[actor.role].includes(nextStatus)) throw forbidden(`Your role cannot set an appointment to ${nextStatus}.`)
  if (!STATUS_TRANSITIONS[appointment.status].includes(nextStatus)) throw badRequest(`Cannot change an appointment from ${appointment.status} to ${nextStatus}.`)
  if (['checked_in', 'completed', 'no_show'].includes(nextStatus) && appointment.startAt.getTime() > Date.now() + HOUR) {
    throw badRequest(`An appointment cannot be marked ${nextStatus} before it starts.`)
  }
  if (actor.role === 'patient' && nextStatus === 'cancelled') {
    const { patientCancellationHours } = await getSettings()
    if (appointment.startAt.getTime() - Date.now() < patientCancellationHours * HOUR) throw badRequest(`Appointments can only be cancelled online at least ${patientCancellationHours} hours before they start.`)
  }

  return runAtomic(async session => {
    const update = { status: nextStatus, ...(nextStatus === 'cancelled' ? { cancelledAt: new Date(), cancellationReason } : {}) }
    const updated = await Appointment.findOneAndUpdate({ _id: appointment._id, status: appointment.status }, { $set: update }, { returnDocument: 'after', ...opts(session) })
    if (!updated) throw conflict('The appointment was changed by another request. Please refresh and try again.')
    if (nextStatus === 'cancelled') await AppointmentSlot.deleteOne({ appointmentId: appointment._id }, opts(session))
    const { patient, doctor } = await userIdsFor(updated)
    const recipients = actor.role === 'patient' ? [doctor?.userId] : actor.role === 'doctor' ? [patient?.userId] : [patient?.userId, doctor?.userId]
    await notify(recipients, { type: nextStatus === 'cancelled' ? 'appointment_cancelled' : 'appointment_status', title: `Appointment ${nextStatus.replace('_', ' ')}`, relatedId: updated._id }, session)
    return updated
  })
}

