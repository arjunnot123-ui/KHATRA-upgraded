# KHATRA Backend

Node/Express + PostgreSQL API for authentication, progress, certificates, QR verification and admin data.

## Local setup
1. Install PostgreSQL and create a database named `khatra`.
2. Copy `.env.example` to `.env` and update credentials.
3. Run `psql "$DATABASE_URL" -f ../database/schema.sql`.
4. Run `npm install`.
5. Run `npm run dev`.

The frontend can use `VITE_API_URL=http://localhost:4000/api`.
