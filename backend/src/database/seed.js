import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { ALLERGY_SEVERITIES, BLOOD_GROUPS, SPECIALTIES } from '../models/enums.js'
import { addDays, localDateString, slotsForDate } from '../services/schedule.js'
import { applySchemaValidators, syncAllIndexes } from './setup.js'

// Synthetic data only. A fixed random seed keeps every run identical.
const COUNTS = { patients: 500, doctors: 20, appointments: 2000, conversations: 150 }
const RANDOM_SEED = Number(process.env.SEED_RANDOM || 20261116)
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'MediMind123'

function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const random = mulberry32(RANDOM_SEED)
const int = (min, max) => Math.floor(random() * (max - min + 1)) + min
const pick = list => list[Math.floor(random() * list.length)]
const weighted = entries => {
  let roll = random() * entries.reduce((sum, [, weight]) => sum + weight, 0)
  for (const [value, weight] of entries) { roll -= weight; if (roll <= 0) return value }
  return entries.at(-1)[0]
}
const oid = () => new mongoose.Types.ObjectId()
const DAY = 86400000

const DEMO_NAMES = ['Aminda Kalpage', 'Malitha Bandara', 'Cheveen Ranasinghe', 'Basuru Wijesinghe', 'Shabjan', 'Vihanga A. Hettiarachchi', 'Sudam Rajapakshe', 'Zaheer Abbas', 'Dhanushi Navarathana', 'Lakshitha Banda', 'Dihasa Dihasa', 'Suchith the BugBear', 'Bob Odenkirk']
const CITIES = ['Colombo', 'Kandy', 'Galle', 'Negombo', 'Jaffna', 'Kurunegala', 'Matara', 'Anuradhapura', 'Ratnapura', 'Badulla', 'Gampaha', 'Trincomalee']
const HOSPITALS = ['Colombo Heart Centre', 'MediCare Hospital', 'Skin & Wellness Clinic', 'National Neuro Centre', 'Lanka Family Clinic', 'Hillside Medical Centre', 'Southern Care Hospital', 'City Children\'s Clinic']
const ALLERGENS = ['Penicillin', 'Peanuts', 'Shellfish', 'Dust mites', 'Latex', 'Aspirin', 'Pollen', 'Sulfa drugs', 'Eggs', 'Ibuprofen']
const RELATIONSHIPS = ['Mother', 'Father', 'Brother', 'Sister', 'Spouse', 'Friend']
const REASONS = ['Routine checkup', 'Follow-up consultation', 'Blood pressure review', 'Persistent headache', 'Skin rash', 'Annual review', 'Medication review', 'Chest discomfort assessment', 'Seasonal allergy review', 'Joint pain', 'Sleep difficulties', 'Child vaccination advice']
const DIAGNOSES = [['Z00.0', 'General examination'], ['I10', 'Essential hypertension'], ['J30.2', 'Seasonal allergic rhinitis'], ['L20.9', 'Atopic dermatitis'], ['G43.9', 'Migraine'], ['E11.9', 'Type 2 diabetes without complications'], ['M54.5', 'Low back pain'], ['K21.9', 'Gastro-oesophageal reflux'], ['F41.1', 'Generalised anxiety'], ['J06.9', 'Upper respiratory infection']]
const MEDICATIONS = [['Paracetamol', '500 mg', 'Three times daily'], ['Cetirizine', '10 mg', 'Once daily'], ['Amlodipine', '5 mg', 'Once daily'], ['Metformin', '500 mg', 'Twice daily'], ['Omeprazole', '20 mg', 'Once daily'], ['Hydrocortisone cream', '1%', 'Twice daily']]
const AI_QUESTIONS = ['What is a routine checkup?', 'How can I prepare for my cardiology appointment?', 'What does blood pressure measure?', 'How much water should I drink each day?', 'What are common allergy triggers?', 'How can I improve my sleep routine?']
const COLORS = ['coral', 'blue', 'purple', 'gold', 'teal']

function fullName() { return pick(DEMO_NAMES) }
function phone() { return `+94 7${int(0, 8)} ${int(100, 999)} ${int(1000, 9999)}` }

function weeklySchedule() {
  const days = [1, 2, 3, 4, 5, 6].filter(() => random() < 0.7)
  if (!days.length) days.push(int(1, 5))
  const morning = random() < 0.5
  return days.map(dayOfWeek => ({ dayOfWeek, startTime: morning ? '08:30' : '13:00', endTime: morning ? '12:30' : '17:00', slotMinutes: 30 }))
}

async function main() {
  const reset = process.argv.includes('--reset')
  await connectDatabase()
  const db = mongoose.connection.db
  if (await db.collection('users').estimatedDocumentCount() > 0 && !reset) {
    console.error('The database already contains data. Run "npm run seed -- --reset" to drop it and reseed.')
    await disconnectDatabase()
    process.exit(1)
  }
  if (reset) await db.dropDatabase()
  await applySchemaValidators()
  await syncAllIndexes()

  const now = new Date()
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, env.bcryptRounds)
  const users = []
  const userDate = () => new Date(now.getTime() - int(1, 365) * DAY - int(0, DAY - 1))

  const adminId = oid()
  users.push({ _id: adminId, email: 'admin@medimind.test', passwordHash, role: 'admin', status: 'active', createdAt: new Date(now.getTime() - 400 * DAY), updatedAt: now })

  const doctors = []
  for (let index = 0; index < COUNTS.doctors; index += 1) {
    const userId = oid()
    const demo = index === 0
    const name = demo ? 'Aminda Kalpage' : fullName()
    const createdAt = demo ? new Date(now.getTime() - 380 * DAY) : userDate()
    users.push({ _id: userId, email: demo ? 'doctor@medimind.test' : `doctor${index}@medimind.test`, passwordHash, role: 'doctor', status: 'active', createdAt, updatedAt: createdAt })
    doctors.push({
      _id: oid(),
      userId,
      fullName: `Dr. ${name}`,
      specialty: demo ? 'Cardiologist' : SPECIALTIES[index % SPECIALTIES.length],
      hospital: demo ? 'Colombo Heart Centre' : pick(HOSPITALS),
      city: demo ? 'Colombo' : pick(CITIES),
      experienceYears: int(3, 25),
      consultationFee: int(20, 45) * 100,
      rating: Math.round((3.8 + random() * 1.2) * 10) / 10,
      reviewCount: int(10, 180),
      about: 'Synthetic doctor profile created for the MediMind educational prototype.',
      expertise: ['Preventive care', 'Consultations', 'Patient education'],
      color: COLORS[index % COLORS.length],
      verificationStatus: index === COUNTS.doctors - 1 ? 'pending' : 'verified',
      availability: demo ? [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({ dayOfWeek, startTime: '09:00', endTime: '17:00', slotMinutes: 30 })) : weeklySchedule(),
      createdAt,
      updatedAt: createdAt,
    })
  }

  const patients = []
  for (let index = 0; index < COUNTS.patients; index += 1) {
    const userId = oid()
    const demo = index === 0
    const name = demo ? 'Vihanga A. Hettiarachchi' : fullName()
    const email = demo ? 'patient@medimind.test' : `patient${index}@medimind.test`
    const createdAt = demo ? new Date(now.getTime() - 200 * DAY) : userDate()
    users.push({ _id: userId, email, passwordHash, role: 'patient', status: 'active', createdAt, updatedAt: createdAt })
    const allergyCount = demo ? 1 : weighted([[0, 55], [1, 30], [2, 12], [3, 3]])
    const allergies = demo ? [{ substance: 'Penicillin', severity: 'Moderate' }] : [...new Set(Array.from({ length: allergyCount }, () => pick(ALLERGENS)))].map(substance => ({ substance, severity: pick(ALLERGY_SEVERITIES) }))
    patients.push({
      _id: oid(),
      userId,
      fullName: name,
      dateOfBirth: demo ? new Date('1999-05-14T00:00:00Z') : new Date(Date.UTC(int(1945, 2018), int(0, 11), int(1, 28))),
      gender: pick(['female', 'male']),
      bloodGroup: demo ? 'O+' : pick(BLOOD_GROUPS),
      contact: { email, phone: phone() },
      address: { city: demo ? 'Colombo' : pick(CITIES), country: 'Sri Lanka' },
      allergies,
      emergencyContact: { name: fullName(), relationship: pick(RELATIONSHIPS), phone: phone() },
      createdAt,
      updatedAt: createdAt,
    })
  }

  const verifiedDoctors = doctors.filter(doctor => doctor.verificationStatus === 'verified')
  const appointments = []
  const takenDoctor = new Set()
  const takenPatient = new Set()
  const today = localDateString(now)

  function addAppointment(patient, doctor, slot, status, extra = {}) {
    const doctorKey = `${doctor._id}|${slot.startAt.getTime()}`
    const patientKey = `${patient._id}|${slot.startAt.getTime()}`
    if (takenDoctor.has(doctorKey) || takenPatient.has(patientKey)) return null
    takenDoctor.add(doctorKey)
    takenPatient.add(patientKey)
    const bookedAt = new Date(Math.min(slot.startAt.getTime() - int(1, 30) * DAY, now.getTime() - int(1, 48) * 3600000))
    const appointment = {
      _id: oid(),
      patientId: patient._id,
      doctorId: doctor._id,
      startAt: slot.startAt,
      endAt: slot.endAt,
      status,
      consultationType: random() < 0.35 ? 'online' : 'in_person',
      reason: pick(REASONS),
      bookedAt,
      rescheduleCount: random() < 0.08 ? 1 : 0,
      createdAt: bookedAt,
      updatedAt: bookedAt,
      ...(status === 'cancelled' ? { cancelledAt: new Date(Math.min(slot.startAt.getTime() - DAY, now.getTime())), cancellationReason: 'Patient requested cancellation' } : {}),
      ...extra,
    }
    appointments.push(appointment)
    return appointment
  }

  const [demoPatient] = patients
  const [demoDoctor] = doctors
  const demoTodaySlots = slotsForDate(demoDoctor, today)
  const firstPastSlot = (doctor, daysAgo) => {
    for (let day = daysAgo; day < daysAgo + 7; day += 1) {
      const found = slotsForDate(doctor, addDays(today, -day))
      if (found.length) return found[0]
    }
    return null
  }
  for (const [index, slotIndex] of [0, 3, 8, 12].entries()) {
    const slot = demoTodaySlots[slotIndex]
    const status = slot.startAt < now ? (index === 0 ? 'completed' : 'checked_in') : 'confirmed'
    addAppointment(index === 0 ? demoPatient : patients[index + 1], demoDoctor, slot, status)
  }
  addAppointment(demoPatient, demoDoctor, slotsForDate(demoDoctor, addDays(today, 3))[14], 'confirmed', { consultationType: 'online', reason: 'Routine cardiac check-up' })
  addAppointment(demoPatient, doctors[1], firstPastSlot(doctors[1], 14), 'completed', { reason: 'Seasonal allergy review' })
  addAppointment(demoPatient, demoDoctor, slotsForDate(demoDoctor, addDays(today, -30))[4], 'completed', { reason: 'Follow-up consultation' })

  let attempts = 0
  while (appointments.length < COUNTS.appointments && attempts < COUNTS.appointments * 20) {
    attempts += 1
    const doctor = pick(verifiedDoctors)
    const offsetDays = int(-180, 30)
    const slots = slotsForDate(doctor, addDays(today, offsetDays))
    if (!slots.length) continue
    const slot = pick(slots)
    const past = slot.startAt < now
    const status = past
      ? weighted([['completed', 72], ['no_show', 9], ['cancelled', 14], ['confirmed', 5]])
      : weighted([['confirmed', 75], ['pending', 15], ['cancelled', 10]])
    addAppointment(pick(patients), doctor, slot, past && status === 'confirmed' ? 'completed' : status)
  }

  const slots = appointments.filter(item => item.status !== 'cancelled').map(item => ({ _id: oid(), doctorId: item.doctorId, startAt: item.startAt, appointmentId: item._id, createdAt: item.createdAt }))

  const records = []
  for (const appointment of appointments.filter(item => item.status === 'completed')) {
    if (random() > 0.8 && appointment.patientId !== demoPatient._id) continue
    const diagnosis = pick(DIAGNOSES)
    const medication = random() < 0.6 ? [pick(MEDICATIONS)] : []
    records.push({
      _id: oid(),
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      appointmentId: appointment._id,
      visitAt: appointment.startAt,
      diagnoses: [{ code: diagnosis[0], description: diagnosis[1] }],
      vitals: { systolicBP: int(105, 150), diastolicBP: int(65, 95), heartRate: int(58, 100), temperatureC: Math.round((36.2 + random() * 1.4) * 10) / 10 },
      medications: medication.map(([name, dosage, frequency]) => ({ name, dosage, frequency, durationDays: int(5, 30) })),
      notes: 'Synthetic consultation summary for demonstration purposes.',
      followUpRequired: random() < 0.3,
      createdAt: appointment.endAt,
      updatedAt: appointment.endAt,
    })
  }

  const conversations = []
  for (let index = 0; index < COUNTS.conversations; index += 1) {
    const patient = index === 0 ? demoPatient : pick(patients)
    const createdAt = new Date(now.getTime() - int(0, 150) * DAY)
    const question = pick(AI_QUESTIONS)
    conversations.push({
      _id: oid(),
      patientId: patient._id,
      title: question,
      messages: [
        { sender: 'user', text: question, createdAt },
        { sender: 'ai', text: 'General educational information from the seeded demo conversation. This is not medical advice.', sources: ['approved-health-reference'], fallback: false, createdAt },
      ],
      messageCount: 2,
      createdAt,
      updatedAt: createdAt,
    })
  }

  const patientUser = new Map(patients.map(patient => [String(patient._id), patient.userId]))
  const doctorUser = new Map(doctors.map(doctor => [String(doctor._id), doctor.userId]))
  const notifications = appointments.filter(item => item.startAt > new Date(now.getTime() - 30 * DAY)).flatMap(item => [
    { _id: oid(), recipientId: patientUser.get(String(item.patientId)), type: item.status === 'cancelled' ? 'appointment_cancelled' : 'appointment_booked', title: item.status === 'cancelled' ? 'Appointment cancelled' : 'Appointment booked', status: item.startAt < now ? 'read' : 'unread', relatedId: item._id, createdAt: item.createdAt },
    { _id: oid(), recipientId: doctorUser.get(String(item.doctorId)), type: 'appointment_booked', title: 'New appointment booked', status: item.startAt < now ? 'read' : 'unread', relatedId: item._id, createdAt: item.createdAt },
  ])

  await db.collection('users').insertMany(users)
  await db.collection('doctors').insertMany(doctors)
  await db.collection('patients').insertMany(patients)
  await db.collection('appointments').insertMany(appointments)
  await db.collection('appointment_slots').insertMany(slots)
  await db.collection('medical_records').insertMany(records)
  await db.collection('ai_conversations').insertMany(conversations)
  await db.collection('notifications').insertMany(notifications)
  await db.collection('settings').insertMany(Object.entries({ requireDoctorVerification: true, maxBookingDaysAhead: 90, patientCancellationHours: 2 }).map(([key, value]) => ({ key, value, createdAt: now, updatedAt: now })))

  const statusCounts = appointments.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] || 0) + 1 }), {})
  console.log(`Seeded with random seed ${RANDOM_SEED}:`)
  console.log(`  users ${users.length}, patients ${patients.length}, doctors ${doctors.length}`)
  console.log(`  appointments ${appointments.length} ${JSON.stringify(statusCounts)}`)
  console.log(`  slot reservations ${slots.length}, medical records ${records.length}, AI conversations ${conversations.length}, notifications ${notifications.length}`)
  console.log(`Demo accounts (password from SEED_PASSWORD): admin@medimind.test, doctor@medimind.test, patient@medimind.test`)
  await disconnectDatabase()
}

await main()
