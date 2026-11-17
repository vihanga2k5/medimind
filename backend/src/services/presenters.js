// Shapes database documents into the fields the React screens display.
export function initialsOf(name = '') {
  return name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join('')
}

export function ageOf(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  let age = now.getUTCFullYear() - dob.getUTCFullYear()
  const beforeBirthday = now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())
  return beforeBirthday ? age - 1 : age
}

const id = value => (value ? String(value) : value)

export function presentDoctor(doctor, extra = {}) {
  if (!doctor) return null
  return {
    id: id(doctor._id),
    userId: id(doctor.userId),
    name: doctor.fullName,
    fullName: doctor.fullName,
    initials: initialsOf(doctor.fullName),
    specialty: doctor.specialty,
    hospital: doctor.hospital,
    city: doctor.city,
    experienceYears: doctor.experienceYears,
    experience: `${doctor.experienceYears ?? 0} years`,
    consultationFee: doctor.consultationFee,
    fee: `Rs. ${Number(doctor.consultationFee || 0).toLocaleString('en-US')}`,
    rating: doctor.rating,
    reviews: doctor.reviewCount,
    about: doctor.about,
    expertise: doctor.expertise || [],
    color: doctor.color,
    verificationStatus: doctor.verificationStatus,
    availability: (doctor.availability || []).map(({ dayOfWeek, startTime, endTime, slotMinutes }) => ({ dayOfWeek, startTime, endTime, slotMinutes })),
    ...extra,
  }
}

export function presentPatient(patient, extra = {}) {
  if (!patient) return null
  return {
    id: id(patient._id),
    userId: id(patient.userId),
    fullName: patient.fullName,
    name: patient.fullName,
    initials: initialsOf(patient.fullName),
    dateOfBirth: patient.dateOfBirth,
    age: ageOf(patient.dateOfBirth),
    gender: patient.gender,
    bloodGroup: patient.bloodGroup,
    contact: patient.contact || {},
    address: patient.address || {},
    allergies: patient.allergies || [],
    emergencyContact: patient.emergencyContact || {},
    createdAt: patient.createdAt,
    updatedAt: patient.updatedAt,
    ...extra,
  }
}

export function presentAppointment(appointment) {
  const doctor = appointment.doctor || (appointment.doctorId?.fullName ? appointment.doctorId : null)
  const patient = appointment.patient || (appointment.patientId?.fullName ? appointment.patientId : null)
  return {
    id: id(appointment._id),
    patientId: id(patient ? patient._id : appointment.patientId),
    doctorId: id(doctor ? doctor._id : appointment.doctorId),
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    status: appointment.status,
    consultationType: appointment.consultationType,
    reason: appointment.reason,
    rescheduleCount: appointment.rescheduleCount || 0,
    cancelledAt: appointment.cancelledAt,
    cancellationReason: appointment.cancellationReason,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
    ...(doctor ? { doctor: { id: id(doctor._id), name: doctor.fullName, initials: initialsOf(doctor.fullName), specialty: doctor.specialty, hospital: doctor.hospital, color: doctor.color } } : {}),
    ...(patient ? { patient: { id: id(patient._id), name: patient.fullName, initials: initialsOf(patient.fullName), age: ageOf(patient.dateOfBirth) } } : {}),
  }
}

export function presentRecord(record) {
  const doctor = record.doctorId?.fullName ? record.doctorId : null
  return {
    id: id(record._id),
    patientId: id(record.patientId?._id || record.patientId),
    doctorId: id(doctor ? doctor._id : record.doctorId),
    appointmentId: id(record.appointmentId),
    visitAt: record.visitAt,
    diagnoses: record.diagnoses || [],
    vitals: record.vitals || {},
    medications: record.medications || [],
    notes: record.notes,
    followUpRequired: record.followUpRequired,
    followUpInDays: record.followUpInDays,
    createdAt: record.createdAt,
    ...(doctor ? { doctor: { id: id(doctor._id), name: doctor.fullName, specialty: doctor.specialty, hospital: doctor.hospital } } : {}),
  }
}

export function presentDocument(document) {
  return {
    id: id(document._id),
    patientId: id(document.patientId),
    name: document.name,
    category: document.category,
    provider: document.provider,
    mimeType: document.mimeType,
    type: document.mimeType === 'application/pdf' ? 'PDF' : document.mimeType === 'image/png' ? 'PNG' : 'JPG',
    sizeBytes: document.sizeBytes,
    checksum: document.checksum,
    uploadedAt: document.uploadedAt,
    uploadedBy: id(document.uploadedBy),
  }
}
