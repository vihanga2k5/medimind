import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { Appointment, Patient } from '../models/index.js'
import * as aggregations from './aggregations.js'

// Prints each analytics pipeline and checks the totals against independent counts.
await connectDatabase()

const byDoctor = await aggregations.appointmentsByDoctor({ limit: 1000 })
const bySpecialty = await aggregations.appointmentsBySpecialty()
const weekday = await aggregations.weekdayActivity()
const overview = await aggregations.platformOverview()
const allergies = await aggregations.allergyPrevalence()

const total = await Appointment.countDocuments()
const checks = [
  ['A appointments by doctor', byDoctor.reduce((sum, row) => sum + row.totalAppointments, 0), total],
  ['B appointments by specialty', bySpecialty.reduce((sum, row) => sum + row.totalAppointments, 0), total],
  ['Weekday activity', weekday.reduce((sum, row) => sum + row.total, 0), total],
  ['Overview by status', overview.totals.totalAppointments, total],
  ['Penicillin allergy (Query C)', allergies.find(row => row.substance === 'Penicillin')?.patientCount || 0, await Patient.countDocuments({ allergies: { $elemMatch: { substance: 'Penicillin' } } })],
]

console.log('\nTop doctors by appointment volume')
console.table(byDoctor.slice(0, 5))
console.log('Appointments by specialty')
console.table(bySpecialty)
console.log('Monthly appointments')
console.table((await aggregations.monthlyAppointments()).map(({ label, year, total: count }) => ({ label, year, total: count })))
console.log('Weekday activity')
console.table(weekday)
console.log('Allergy prevalence')
console.table(allergies)
console.log('Patient growth')
console.table(await aggregations.patientGrowth())
console.log('Control totals')
console.table(checks.map(([name, pipeline, control]) => ({ name, pipeline, control, match: pipeline === control })))

await disconnectDatabase()
process.exit(checks.every(([, pipeline, control]) => pipeline === control) ? 0 : 1)
