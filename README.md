# KHATRA — Industrial AR Safety Training Platform

KHATRA is an offline-first industrial safety training platform for mining and industrial workers. The source is organized into clear frontend, backend, database, AR assets, scripts, and documentation layers for SIH development and demonstration.

## Structure

- `frontend/` — React + Vite + PWA/Capacitor client, training UI, assessments, AR/3D visualization, localization, certificates and admin screens.
- `backend/` — Node.js + Express API, authentication, assessment engine, AI services, certification and inspection APIs.
- `database/` — PostgreSQL schema and seed SQL.
- `ar-assets/` — source/reference AR and 3D model assets.
- `scripts/` — development and test utilities.
- `docs/` — architecture, API, database and SIH documentation.

## Run locally

From the project root:

```bash
npm install
npm run dev:all
```

Frontend: http://localhost:5173  
Backend: http://localhost:4000

Configure `backend/.env` using `backend/.env.example` with PostgreSQL `DATABASE_URL`, `JWT_SECRET`, and the required AI provider key.

## Build

```bash
npm run build
```

The production frontend build is generated in `frontend/dist/`.
