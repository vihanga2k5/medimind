# MediMind Frontend

React + Vite frontend for **MediMind – AI-Powered Healthcare Intelligence and Patient Management Platform**.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The Express API in `../backend` must be running (see `backend/README.md`).

## Frontend roles

Users sign in with their email and password. The API returns the account's role, and the user is routed to the **Patient**, **Doctor**, or **Administrator** portal with its own protected dashboard and navigation menu. Self-registration always creates a patient account.

After seeding the backend, these accounts use the password `MediMind123`:

| Role | Email |
| --- | --- |
| Patient | `patient@medimind.test` |
| Doctor | `doctor@medimind.test` |
| Administrator | `admin@medimind.test` |

## Project structure

```text
src/
  components/  Reusable interface pieces and dashboard layout
  context/     Authentication state and session token shared across the app
  hooks/       useApi loader for GET endpoints
  pages/       Patient, doctor, admin, and authentication pages
  services/    API communication through Express
  utils/       Date, status, and number formatting
```

## Backend integration

Create a `.env` file from `.env.example` and set `VITE_API_URL` to the Node/Express API base URL. The browser frontend calls **Express only**. Express should handle authentication, MongoDB access, and calls to the Python/FastAPI AI service.

Every screen loads its data from the API. The session token is sent as an `Authorization: Bearer` header, and an expired session returns the user to the sign-in page. Appointment times are shown in clinic time (Asia/Colombo).

The AI assistant sends questions to `POST /api/ai/chat`. If the Python AI service is offline, the API returns a safe standard answer and the chat shows that the service is unavailable.
