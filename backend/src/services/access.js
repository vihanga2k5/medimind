import { Appointment } from '../models/index.js'
import { forbidden } from '../utils/httpError.js'

// A doctor is authorised for a patient only when they share a non-cancelled appointment.
export async function doctorCanAccessPatient(doctorId, patientId) {
  if (!doctorId) return false
  return Boolean(await Appointment.exists({ doctorId, patientId, status: { $ne: 'cancelled' } }))
}

export async function assertProfileAccess(user, patientId) {
  if (user.role === 'admin') return
  if (user.role === 'patient' && String(user.profileId) === String(patientId)) return
  if (user.role === 'doctor' && await doctorCanAccessPatient(user.profileId, patientId)) return
  throw forbidden('You are not authorised to view this patient.')
}

// Administrators manage the platform but do not get blanket access to clinical data.
export async function assertClinicalAccess(user, patientId) {
  if (user.role === 'patient' && String(user.profileId) === String(patientId)) return
  if (user.role === 'doctor' && await doctorCanAccessPatient(user.profileId, patientId)) return
  throw forbidden('You are not authorised to view this patient\'s clinical records.')
}
