import { ALLERGY_SEVERITIES, APPOINTMENT_STATUSES, CONSULTATION_TYPES, DOCUMENT_CATEGORIES, DOCUMENT_MIME_TYPES, NOTIFICATION_STATUSES, NOTIFICATION_TYPES, ROLES, USER_STATUSES, VERIFICATION_STATUSES } from '../models/enums.js'

// MongoDB-side $jsonSchema rules. They protect the data even if a script bypasses the API.
const optional = type => ({ bsonType: [type, 'null'] })

export const collectionValidators = {
  users: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'passwordHash', 'role', 'status', 'createdAt'],
      properties: {
        email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', maxLength: 254 },
        passwordHash: { bsonType: 'string', minLength: 20 },
        role: { enum: ROLES },
        status: { enum: USER_STATUSES },
        createdAt: { bsonType: 'date' },
        lastLoginAt: optional('date'),
      },
    },
  },
  patients: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'fullName'],
      properties: {
        userId: { bsonType: 'objectId' },
        fullName: { bsonType: 'string', minLength: 2, maxLength: 120 },
        dateOfBirth: optional('date'),
        allergies: {
          bsonType: 'array',
          maxItems: 50,
          items: { bsonType: 'object', required: ['substance'], properties: { substance: { bsonType: 'string' }, severity: { enum: ALLERGY_SEVERITIES } } },
        },
        emergencyContact: { bsonType: 'object' },
        contact: { bsonType: 'object' },
        address: { bsonType: 'object' },
      },
    },
  },
  doctors: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'fullName', 'specialty', 'verificationStatus'],
      properties: {
        userId: { bsonType: 'objectId' },
        fullName: { bsonType: 'string', minLength: 2 },
        specialty: { bsonType: 'string', minLength: 2 },
        rating: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0, maximum: 5 },
        consultationFee: { bsonType: ['double', 'int', 'long', 'decimal'], minimum: 0 },
        verificationStatus: { enum: VERIFICATION_STATUSES },
        availability: {
          bsonType: 'array',
          maxItems: 21,
          items: {
            bsonType: 'object',
            required: ['dayOfWeek', 'startTime', 'endTime'],
            properties: {
              dayOfWeek: { bsonType: ['int', 'long', 'double'], minimum: 0, maximum: 6 },
              startTime: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
              endTime: { bsonType: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
            },
          },
        },
      },
    },
  },
  appointments: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patientId', 'doctorId', 'startAt', 'endAt', 'status'],
      properties: {
        patientId: { bsonType: 'objectId' },
        doctorId: { bsonType: 'objectId' },
        startAt: { bsonType: 'date' },
        endAt: { bsonType: 'date' },
        status: { enum: APPOINTMENT_STATUSES },
        consultationType: { enum: CONSULTATION_TYPES },
        reason: { bsonType: 'string', maxLength: 500 },
      },
    },
    $expr: { $lt: ['$startAt', '$endAt'] },
  },
  appointment_slots: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['doctorId', 'startAt', 'appointmentId'],
      properties: { doctorId: { bsonType: 'objectId' }, startAt: { bsonType: 'date' }, appointmentId: { bsonType: 'objectId' } },
    },
  },
  medical_records: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patientId', 'doctorId', 'visitAt'],
      properties: {
        patientId: { bsonType: 'objectId' },
        doctorId: { bsonType: 'objectId' },
        appointmentId: optional('objectId'),
        visitAt: { bsonType: 'date' },
        diagnoses: { bsonType: 'array', items: { bsonType: 'object', required: ['description'] } },
        medications: { bsonType: 'array', items: { bsonType: 'object', required: ['name'] } },
        vitals: { bsonType: 'object' },
        followUpRequired: { bsonType: 'bool' },
      },
    },
  },
  medical_documents: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patientId', 'uploadedBy', 'name', 'storageKey', 'mimeType', 'sizeBytes', 'checksum', 'uploadedAt'],
      properties: {
        patientId: { bsonType: 'objectId' },
        uploadedBy: { bsonType: 'objectId' },
        storageKey: { bsonType: 'objectId' },
        mimeType: { enum: DOCUMENT_MIME_TYPES },
        category: { enum: DOCUMENT_CATEGORIES },
        sizeBytes: { bsonType: ['int', 'long', 'double'], minimum: 1 },
        checksum: { bsonType: 'string', pattern: '^[a-f0-9]{64}$' },
        uploadedAt: { bsonType: 'date' },
      },
    },
  },
  ai_conversations: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['patientId', 'messages'],
      properties: { patientId: { bsonType: 'objectId' }, messages: { bsonType: 'array', maxItems: 100 } },
    },
  },
  notifications: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['recipientId', 'type', 'status', 'createdAt'],
      properties: { recipientId: { bsonType: 'objectId' }, type: { enum: NOTIFICATION_TYPES }, status: { enum: NOTIFICATION_STATUSES }, createdAt: { bsonType: 'date' } },
    },
  },
}
