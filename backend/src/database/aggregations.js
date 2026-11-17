import { env } from '../config/env.js'
import { AiConversation, Appointment, Doctor, Patient, User } from '../models/index.js'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function clinicTimezone() {
  const minutes = env.clinicUtcOffsetMinutes
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

function monthStart(date, monthsBack = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1))
}

function percentChange(current, previous) {
  if (!previous) return current ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

// A: appointment volume by doctor, joined to the doctor directory.
export function appointmentsByDoctor({ limit = 10, from, to } = {}) {
  return Appointment.aggregate([
    ...(from || to ? [{ $match: { startAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) } } }] : []),
    { $group: { _id: '$doctorId', totalAppointments: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }, noShows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } } } },
    { $sort: { totalAppointments: -1, _id: 1 } },
    { $limit: limit },
    { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
    { $unwind: '$doctor' },
    { $project: { _id: 0, doctorId: '$_id', name: '$doctor.fullName', specialty: '$doctor.specialty', totalAppointments: 1, completed: 1, cancelled: 1, noShows: 1 } },
  ])
}

// B: appointments grouped by the joined doctor specialty.
export function appointmentsBySpecialty() {
  return Appointment.aggregate([
    { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' } },
    { $unwind: '$doctor' },
    { $group: { _id: '$doctor.specialty', totalAppointments: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, doctors: { $addToSet: '$doctorId' } } },
    { $project: { _id: 0, specialty: '$_id', totalAppointments: 1, completed: 1, doctorCount: { $size: '$doctors' }, completionRate: { $cond: [{ $gt: ['$totalAppointments', 0] }, { $round: [{ $multiply: [{ $divide: ['$completed', '$totalAppointments'] }, 100] }, 1] }, 0] } } },
    { $sort: { totalAppointments: -1, specialty: 1 } },
  ])
}

export async function monthlyAppointments({ months = 6, now = new Date() } = {}) {
  const start = monthStart(now, months - 1)
  const rows = await Appointment.aggregate([
    { $match: { startAt: { $gte: start, $lt: monthStart(now, -1) } } },
    { $group: { _id: { year: { $year: { date: '$startAt', timezone: clinicTimezone() } }, month: { $month: { date: '$startAt', timezone: clinicTimezone() } }, status: '$status' }, count: { $sum: 1 } } },
    { $group: { _id: { year: '$_id.year', month: '$_id.month' }, total: { $sum: '$count' }, byStatus: { $push: { k: '$_id.status', v: '$count' } } } },
    { $project: { _id: 0, year: '$_id.year', month: '$_id.month', total: 1, byStatus: { $arrayToObject: '$byStatus' } } },
    { $sort: { year: 1, month: 1 } },
  ])
  return Array.from({ length: months }, (_, index) => {
    const date = monthStart(now, months - 1 - index)
    const row = rows.find(item => item.year === date.getUTCFullYear() && item.month === date.getUTCMonth() + 1)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, label: MONTH_NAMES[date.getUTCMonth()], total: row?.total || 0, byStatus: row?.byStatus || {} }
  })
}

export async function weekdayActivity({ from, to } = {}) {
  const rows = await Appointment.aggregate([
    ...(from || to ? [{ $match: { startAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lt: to } : {}) } } }] : []),
    { $group: { _id: { $dayOfWeek: { date: '$startAt', timezone: clinicTimezone() } }, total: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  return [2, 3, 4, 5, 6, 7, 1].map(day => ({ day: WEEKDAY_NAMES[day - 1], total: rows.find(row => row._id === day)?.total || 0 }))
}

export function allergyPrevalence({ limit = 10 } = {}) {
  return Patient.aggregate([
    { $unwind: '$allergies' },
    { $group: { _id: '$allergies.substance', patients: { $addToSet: '$_id' }, severe: { $sum: { $cond: [{ $eq: ['$allergies.severity', 'Severe'] }, 1, 0] } } } },
    { $project: { _id: 0, substance: '$_id', patientCount: { $size: '$patients' }, severe: 1 } },
    { $sort: { patientCount: -1, substance: 1 } },
    { $limit: limit },
  ])
}

export async function patientGrowth({ months = 6, now = new Date() } = {}) {
  const rows = await User.aggregate([
    { $match: { role: 'patient', createdAt: { $gte: monthStart(now, months - 1) } } },
    { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, registrations: { $sum: 1 } } },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ])
  return Array.from({ length: months }, (_, index) => {
    const date = monthStart(now, months - 1 - index)
    const row = rows.find(item => item._id.year === date.getUTCFullYear() && item._id.month === date.getUTCMonth() + 1)
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, label: MONTH_NAMES[date.getUTCMonth()], registrations: row?.registrations || 0 }
  })
}

export async function aiEngagement() {
  const [row] = await AiConversation.aggregate([
    { $group: { _id: null, conversations: { $sum: 1 }, messages: { $sum: '$messageCount' }, patients: { $addToSet: '$patientId' } } },
    { $project: { _id: 0, conversations: 1, messages: 1, patientsUsingAi: { $size: '$patients' } } },
  ])
  return row || { conversations: 0, messages: 0, patientsUsingAi: 0 }
}

// Dashboard summary built from one $facet pass over appointments plus cheap counts.
export async function platformOverview({ now = new Date() } = {}) {
  const thisMonth = monthStart(now)
  const lastMonth = monthStart(now, 1)
  const dayStart = new Date(Math.floor((now.getTime() + env.clinicUtcOffsetMinutes * 60000) / 86400000) * 86400000 - env.clinicUtcOffsetMinutes * 60000)
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  const [facets] = await Appointment.aggregate([
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
        thisMonth: [{ $match: { startAt: { $gte: thisMonth, $lt: monthStart(now, -1) } } }, { $count: 'count' }],
        lastMonth: [{ $match: { startAt: { $gte: lastMonth, $lt: thisMonth } } }, { $count: 'count' }],
        today: [{ $match: { startAt: { $gte: dayStart, $lt: dayEnd } } }, { $count: 'count' }],
        attendance: [
          { $match: { status: { $in: ['completed', 'no_show'] } } },
          { $group: { _id: null, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }, total: { $sum: 1 } } },
        ],
        byConsultationType: [{ $group: { _id: '$consultationType', count: { $sum: 1 } } }],
      },
    },
  ])

  const [patients, patientsLastMonth, activeDoctors, pendingDoctors, newDoctorsThisMonth, ai, aiThisMonth, aiLastMonth] = await Promise.all([
    Patient.countDocuments(),
    Patient.countDocuments({ createdAt: { $lt: thisMonth } }),
    Doctor.countDocuments({ verificationStatus: 'verified' }),
    Doctor.countDocuments({ verificationStatus: 'pending' }),
    Doctor.countDocuments({ createdAt: { $gte: thisMonth } }),
    aiEngagement(),
    AiConversation.countDocuments({ createdAt: { $gte: thisMonth } }),
    AiConversation.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
  ])

  const appointmentsThisMonth = facets.thisMonth[0]?.count || 0
  const appointmentsLastMonth = facets.lastMonth[0]?.count || 0
  const attendance = facets.attendance[0]
  const statusCounts = Object.fromEntries(facets.byStatus.map(row => [row._id, row.count]))

  return {
    totals: {
      registeredPatients: patients,
      activeDoctors,
      pendingDoctorVerifications: pendingDoctors,
      appointmentsThisMonth,
      appointmentsToday: facets.today[0]?.count || 0,
      totalAppointments: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      aiConversations: ai.conversations,
    },
    changes: {
      patientGrowthPercent: percentChange(patients, patientsLastMonth),
      newDoctorsThisMonth,
      appointmentsPercent: percentChange(appointmentsThisMonth, appointmentsLastMonth),
      aiConversationsPercent: percentChange(aiThisMonth, aiLastMonth),
    },
    attendanceRate: attendance?.total ? Math.round((attendance.completed / attendance.total) * 1000) / 10 : null,
    aiEngagementPercent: patients ? Math.round((ai.patientsUsingAi / patients) * 1000) / 10 : 0,
    appointmentsByStatus: statusCounts,
    appointmentsByConsultationType: Object.fromEntries(facets.byConsultationType.map(row => [row._id, row.count])),
  }
}

export async function doctorWorkload(doctorId, { now = new Date() } = {}) {
  const dayStart = new Date(Math.floor((now.getTime() + env.clinicUtcOffsetMinutes * 60000) / 86400000) * 86400000 - env.clinicUtcOffsetMinutes * 60000)
  const dayEnd = new Date(dayStart.getTime() + 86400000)
  const [result] = await Appointment.aggregate([
    { $match: { doctorId } },
    {
      $facet: {
        today: [{ $match: { startAt: { $gte: dayStart, $lt: dayEnd }, status: { $ne: 'cancelled' } } }, { $group: { _id: '$consultationType', count: { $sum: 1 } } }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        patients: [{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$patientId' } }, { $count: 'count' }],
        newPatientsThisMonth: [{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$patientId', first: { $min: '$startAt' } } }, { $match: { first: { $gte: monthStart(now) } } }, { $count: 'count' }],
        upcoming: [{ $match: { startAt: { $gte: now }, status: { $in: ['pending', 'confirmed', 'checked_in'] } } }, { $count: 'count' }],
        completedWithoutRecord: [
          { $match: { status: 'completed' } },
          { $lookup: { from: 'medical_records', localField: '_id', foreignField: 'appointmentId', as: 'records' } },
          { $match: { records: { $size: 0 } } },
          { $count: 'count' },
        ],
      },
    },
  ])
  const todayByType = Object.fromEntries(result.today.map(row => [row._id, row.count]))
  return {
    appointmentsToday: Object.values(todayByType).reduce((sum, count) => sum + count, 0),
    onlineToday: todayByType.online || 0,
    activePatients: result.patients[0]?.count || 0,
    newPatientsThisMonth: result.newPatientsThisMonth[0]?.count || 0,
    upcomingAppointments: result.upcoming[0]?.count || 0,
    pendingNotes: result.completedWithoutRecord[0]?.count || 0,
    appointmentsByStatus: Object.fromEntries(result.byStatus.map(row => [row._id, row.count])),
  }
}

export async function patientSummary(patientId, { now = new Date() } = {}) {
  const [result] = await Appointment.aggregate([
    { $match: { patientId } },
    {
      $facet: {
        upcoming: [{ $match: { startAt: { $gte: now }, status: { $in: ['pending', 'confirmed'] } } }, { $sort: { startAt: 1 } }, { $limit: 1 }, { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' } }, { $unwind: '$doctor' }],
        upcomingCount: [{ $match: { startAt: { $gte: now }, status: { $in: ['pending', 'confirmed'] } } }, { $count: 'count' }],
        completed: [{ $match: { status: 'completed' } }, { $count: 'count' }],
      },
    },
  ])
  return { nextAppointment: result.upcoming[0] || null, upcomingAppointments: result.upcomingCount[0]?.count || 0, completedAppointments: result.completed[0]?.count || 0 }
}

export function recentActivity({ limit = 8 } = {}) {
  return Appointment.aggregate([
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'doctors', localField: 'doctorId', foreignField: '_id', as: 'doctor' } },
    { $unwind: '$doctor' },
    { $project: { _id: 0, type: 'appointment', title: { $concat: ['New appointment booked with ', '$doctor.fullName'] }, at: '$createdAt' } },
    { $unionWith: { coll: 'doctors', pipeline: [{ $sort: { createdAt: -1 } }, { $limit: limit }, { $project: { _id: 0, type: 'doctor', title: { $concat: ['$fullName', ' joined the platform'] }, at: '$createdAt' } }] } },
    { $unionWith: { coll: 'medical_documents', pipeline: [{ $sort: { uploadedAt: -1 } }, { $limit: limit }, { $project: { _id: 0, type: 'record', title: 'A medical document was securely uploaded', at: '$uploadedAt' } }] } },
    { $sort: { at: -1 } },
    { $limit: limit },
  ])
}
