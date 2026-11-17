# MediMind frontend viva notes

## Architecture

- **React Router** creates separate client-side URLs for authentication and for patient, doctor, and administrator portals.
- **ProtectedRoute** checks the current signed-in role before rendering a portal. A patient cannot open an admin URL in the interface.
- **AuthContext** signs in through `POST /api/auth/login`, stores the returned JWT (in `localStorage` when "Remember me" is ticked, otherwise `sessionStorage`), and refreshes the user from `GET /api/auth/me`. The role always comes from the server.
- **Reusable components** such as `DashboardLayout`, `PageHeader`, `StatCard`, and `StatusBadge` avoid repeating UI code across roles.
- **services/api.js** is the only place that calls the backend. It adds the token header, sends JSON or `FormData` uploads, and turns API errors into readable messages.
- **useApi** loads a GET endpoint and reloads when the URL changes, so filters, search, and pagination are handled by the API.

## Important data-flow explanation

```text
React frontend → Node/Express API → MongoDB
                               → Python/FastAPI AI service
```

The React app must not connect directly to MongoDB because database credentials must remain private. The AI assistant must call Express, and Express can securely communicate with the Python service.

## Connected behaviour

- Login opens the portal for the account's role; a 401 response signs the user out.
- Booking reads real slots from `GET /api/doctors/:id/slots` and creates appointments with `POST /api/appointments`. A slot taken by someone else returns 409 and the slots reload.
- Uploads send `multipart/form-data` to `POST /api/documents`; downloads use an authorised fetch, never a public file URL.
- Doctors save consultation notes with `POST /api/medical-records`, which also completes the linked appointment.
- Admin dashboards and analytics use the MongoDB aggregation endpoints under `/api/analytics`.
- The AI chat calls `POST /api/ai/chat` and shows when the safe fallback answer is used.
