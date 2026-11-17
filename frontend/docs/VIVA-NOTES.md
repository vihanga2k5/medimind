# MediMind frontend viva notes

## Architecture

- **React Router** creates separate client-side URLs for authentication and for patient, doctor, and administrator portals.
- **ProtectedRoute** checks the current signed-in role before rendering a portal. A patient cannot open an admin URL in the interface.
- **AuthContext** stores the demonstration session in React state and browser `localStorage`. The real version will receive a token from Express and use secure authentication practices defined by the backend team.
- **Reusable components** such as `DashboardLayout`, `PageHeader`, `StatCard`, and `StatusBadge` avoid repeating UI code across roles.
- **mockData.js** allows the interface to be developed before the database APIs are ready. It should be replaced by API responses, not copied into MongoDB code.

## Important data-flow explanation

```text
React frontend → Node/Express API → MongoDB
                               → Python/FastAPI AI service
```

The React app must not connect directly to MongoDB because database credentials must remain private. The AI assistant must call Express, and Express can securely communicate with the Python service.

## Current demonstration behaviour

- Login selects a role and opens the matching portal.
- Booking, upload, consultation-note, and profile-save actions update visible demonstration state.
- The AI chat clearly displays a demonstration response. It is not the completed AI feature until the backend endpoint is integrated.
