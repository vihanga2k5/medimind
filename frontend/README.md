# MediMind Frontend

React + Vite frontend for **MediMind – AI-Powered Healthcare Intelligence and Patient Management Platform**.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Frontend roles

The sign-in page has demonstration role buttons for **Patient**, **Doctor**, and **Administrator**. Each role is routed to its own protected dashboard and navigation menu.

## Project structure

```text
src/
  components/  Reusable interface pieces and dashboard layout
  context/     Authentication state shared across the app
  data/        Sample data used before backend integration
  pages/       Patient, doctor, admin, and authentication pages
  services/    Future API communication through Express
```

## Backend integration

Create a `.env` file from `.env.example` and set `VITE_API_URL` to the Node/Express API base URL. The browser frontend calls **Express only**. Express should handle authentication, MongoDB access, and calls to the Python/FastAPI AI service.

The current dashboards intentionally use sample data. The AI page is visibly marked as demo mode, so it must not be presented as the real AI service until `aiApi.ask()` is connected to the approved backend endpoint.
