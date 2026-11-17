# MediMind Backend

Node.js + Express + MongoDB API for **MediMind – AI-Powered Healthcare Intelligence and Patient Management Platform**.

The React frontend calls this API only. This API owns identity, access control, business rules and all MongoDB access, and it calls the internal Python/FastAPI AI service on the frontend's behalf.

```text
React frontend → Express API (this folder) → MongoDB (medimind_db)
                                           → FastAPI AI service (internal)
```

## Run locally

Requirements: Node.js 20.12+ and MongoDB 7+ (a single-node replica set is recommended so multi-document transactions are enabled).

```bash
cp .env.example .env        # then set JWT_SECRET and the other values
npm install
npm run seed -- --reset     # synthetic data: 500 patients, 20 doctors, 2,000 appointments
npm run dev
```

The API listens on `http://localhost:5000/api`, which matches `VITE_API_URL` in `frontend/.env.example`.

### Local replica set

```bash
mongod --replSet rs0 --dbpath ./data/db --port 27017
mongosh --eval "rs.initiate()"
```

Without a replica set the API still works: double booking is still blocked by the unique slot index, and the booking code removes its own slot reservation if a later write fails.

### Demo accounts (after seeding)

| Role | Email |
| --- | --- |
| Patient | `patient@medimind.test` |
| Doctor | `doctor@medimind.test` |
| Administrator | `admin@medimind.test` |

All seeded accounts use the password in `SEED_PASSWORD` (default `MediMind123`).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm start` | Start the API (applies collection validators on startup) |
| `npm run db:setup` | Apply `$jsonSchema` validators and build all indexes |
| `npm run seed -- --reset` | Drop and reseed the database with deterministic synthetic data |
| `npm run aggregations` | Print every analytics pipeline and compare it with independent control totals |
| `npm run explain` | Capture `explain("executionStats")` before and after the `{ doctorId, startAt }` index; saved to `evidence/` |
| `npm run backup [-- <folder>]` | Export every collection (including GridFS files) as Extended JSON to `backups/` |
| `npm run restore -- <folder> --drop` | Restore a backup and print expected vs restored counts |
| `npm test` | Run the API test suite against an in-memory MongoDB replica set |

## Project structure

```text
src/
  app.js            Express app, security middleware and route mounting
  server.js         Process entry point
  config/           Environment variables and MongoDB connection/transactions
  middleware/       Authentication, role checks, validation, input sanitising, errors
  models/           Mongoose models for every collection
  routes/           REST endpoints grouped by resource
  services/         Booking rules, access rules, scheduling, AI client, response shapes
  database/         Validators, aggregations, seed, explain, backup and restore scripts
tests/              node:test + supertest API tests
openapi.yaml        OpenAPI 3.1 specification
```

## MongoDB collections

| Collection | Modelling choice |
| --- | --- |
| `users` | Login identity only. Unique `email` index. Referenced from `patients.userId` and `doctors.userId`. |
| `patients` | Demographics, contact, address, `allergies[]` and `emergencyContact` are embedded because they are small, bounded (max 50 allergies) and always read with the profile. |
| `doctors` | Embedded weekly `availability[]` (max 21 blocks) because the schedule is bounded and read with the profile. |
| `appointments` | Separate referenced collection. Appointments grow without limit, so embedding them in patients or doctors would push documents toward the 16 MB limit and turn every booking into a rewrite of a large document. |
| `appointment_slots` | One document per booked doctor slot with a unique `{ doctorId, startAt }` index. This is the concurrency guard against double booking. Cancelled appointments release their slot. |
| `medical_records` | Separate, sensitive visit records with `diagnoses[]`, `vitals` and `medications[]`. Kept apart so profile reads never load clinical data and access can be checked independently. |
| `medical_documents` | File metadata, SHA-256 checksum and access owner. File bytes live in GridFS (`document_files.*`), never at a public URL. |
| `ai_conversations` | Messages embedded with `$push` + `$slice: -100` so a conversation can never grow unbounded. |
| `notifications` | Separate, growing activity stream per recipient. |
| `settings` | Administrator configuration (doctor verification, booking window, cancellation notice). |

`$jsonSchema` validators are applied to nine collections (`src/database/validators.js`).

### Indexes

- `users { email: 1 }` unique
- `appointments { doctorId: 1, startAt: 1 }` compound – doctor schedule lookups
- `appointments { patientId: 1, startAt: -1 }` – patient history
- `appointments { status: 1, startAt: -1 }` – admin filters and dashboards
- `appointment_slots { doctorId: 1, startAt: 1 }` unique – double-booking guard
- `patients { userId: 1 }` unique, `patients { allergies.substance: 1 }` multikey
- `doctors { specialty: 1, rating: -1 }` – directory filtering and sorting
- `medical_records { patientId: 1, visitAt: -1 }`, `{ doctorId: 1, visitAt: -1 }`
- `medical_documents { patientId: 1, uploadedAt: -1 }`, `{ storageKey: 1 }` unique
- `notifications { recipientId: 1, status: 1, createdAt: -1 }`

### Aggregation pipelines (`src/database/aggregations.js`)

1. Appointment volume by doctor – `$group`, `$sort`, `$lookup`, `$unwind`, `$project`
2. Appointments by specialty – `$lookup`, `$unwind`, `$group`, `$project`, `$sort`
3. Monthly appointments by status – `$match`, `$group` (two stages), `$project`, `$sort`
4. Weekday activity – `$group` on `$dayOfWeek` in clinic time
5. Allergy prevalence – `$unwind` on embedded allergies, `$group`, `$project`, `$sort`
6. Platform overview – single `$facet` pass over appointments
7. Doctor workload – `$match` + `$facet`, including a `$lookup` for visits still missing notes
8. Patient growth, AI engagement and recent activity (`$unionWith`)

### Consistency and conflict handling

Booking runs inside a multi-document transaction: insert the slot reservation, insert the appointment, insert notifications. When two requests race for the same slot, the unique `{ doctorId, startAt }` index lets exactly one commit; the other receives **409 Conflict**. Rescheduling reserves the new slot before releasing the old one, and status changes use optimistic checks on the current status. Writing a consultation record can complete the related appointment in the same transaction.

## API overview

All responses are JSON. Errors always have a `message` field (and `details` for validation errors).

| Method | Endpoint | Roles | Notes |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | public | Creates a **patient** account; client-supplied roles are ignored |
| POST | `/api/auth/login` | public | Returns `{ token, user }` |
| GET | `/api/auth/me` | any | Current user |
| GET | `/api/patients` | doctor, admin | Doctor: assigned patients only. Filters `q`, `allergy`, `city` |
| GET | `/api/patients/me` | patient | Own profile |
| GET / PUT | `/api/patients/:id` | patient (own), doctor (assigned), admin (read) | PUT is patient-only and restricted to profile fields |
| GET | `/api/doctors` | any | Search `q`, `specialty`, `city`, `availableOn`, `minRating`, `sort`, pagination |
| POST | `/api/doctors` | admin | Create doctor account and profile |
| GET | `/api/doctors/me` | doctor | Own profile |
| GET | `/api/doctors/:id` | any | Includes `nextAvailableAt` |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | any | `available` / `booked` / `past` per slot |
| PUT | `/api/doctors/:id` | doctor (own), admin | Profile and availability |
| PATCH | `/api/doctors/:id/verification` | admin | `pending` / `verified` / `rejected` |
| POST | `/api/appointments` | patient, admin | Conflict-free booking |
| GET | `/api/appointments` | any | Role-filtered. `status`, `from`, `to`, `scope=upcoming\|past`, `sort`, pagination |
| GET / PATCH | `/api/appointments/:id` | owner roles | PATCH `{ status }` or `{ startAt }` |
| POST | `/api/medical-records` | doctor | Assigned patients only |
| GET | `/api/medical-records` | patient, doctor | Own records / records authored |
| GET | `/api/medical-records/patient/:id` | patient (own), doctor (assigned) | Admins are denied |
| POST | `/api/documents` | patient, doctor | `multipart/form-data` with `file`; PDF/JPEG/PNG up to 5 MB |
| GET | `/api/documents` | patient, doctor | Metadata list |
| GET | `/api/documents/:id/download` | patient (own), doctor (assigned) | Streams the file from GridFS |
| POST | `/api/ai/chat` | patient | `{ message }` or `{ question }`, optional `conversationId` |
| GET | `/api/ai/conversations[/:id]` | patient | Own conversations |
| POST | `/api/ai/no-show-risk` | doctor, admin | Proxies to FastAPI `/predict/no-show` |
| GET | `/api/analytics/overview` | admin | Totals, monthly trend, specialty, weekday and recent activity |
| GET | `/api/analytics/appointments-by-doctor` etc. | admin | Individual pipelines |
| GET | `/api/analytics/me` | patient, doctor | Personal dashboard figures |
| GET / PATCH | `/api/notifications` | any | Own notifications, mark read |
| GET / PUT | `/api/settings` | admin | Platform configuration |

List endpoints accept `page` (default 1) and `limit` (default 20, maximum 100) and respond with `{ data, pagination: { page, limit, total, totalPages } }`.

The full contract with request and response examples is in `openapi.yaml`.

## FastAPI contract expected by this API

```text
POST {AI_SERVICE_URL}/ai/chat          { question, sessionId }  →  { answer, sources[], disclaimer }
POST {AI_SERVICE_URL}/predict/no-show  { leadTimeDays, priorMissedVisits, priorVisits, consultationType, rescheduleCount }  →  { riskScore, modelVersion }
```

Requests carry the `X-Service-Key` header when `AI_SERVICE_KEY` is set. Calls time out after `AI_TIMEOUT_MS`; if the service is down or returns an invalid response, the chat endpoint returns a safe fallback answer with `fallback: true`. Emergency phrases are answered with an escalation message without calling the model.

## Security notes

- Passwords hashed with bcrypt; JWTs signed with HS256 and expire after `JWT_EXPIRES_IN`.
- Role and profile are loaded from MongoDB on every request, never trusted from the token body or request payload.
- Patients only see their own data; doctors only see patients they share a non-cancelled appointment with; administrators manage the platform but cannot read clinical records or documents.
- Request bodies are validated with zod, `$`-prefixed and dotted keys are stripped, and MongoDB validators enforce the schema at the database level.
- Uploads are checked by MIME type, file signature and size, stored privately in GridFS and only served through an authorised download endpoint.
- Request logs contain only method, path, status and timing.
- Authentication endpoints are rate limited.

MediMind is an educational prototype that works with synthetic data only. It is not a clinically validated product.
