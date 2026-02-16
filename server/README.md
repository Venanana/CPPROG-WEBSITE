# Barangay Request Backend (Express + PostgreSQL)

## Run locally

1. Install dependencies:
   - `cd server`
   - `npm install`
2. Copy env file:
   - `copy .env.example .env`
3. Create DB schema:
   - Run SQL in `sql/001_init.sql`
4. Start server:
   - `npm run dev`

## Deploy on Render

1. Create a new Web Service from the `server` directory.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add environment variables from `.env.example`.
5. Provision Render PostgreSQL and set `DATABASE_URL`.
6. This service now serves frontend + API together:
   - Frontend: `https://<your-service>.onrender.com`
   - API: `https://<your-service>.onrender.com/api`

## API base URL

- `http://localhost:4000/api`

## Notes

- Auth uses JWT access + refresh tokens.
- Passwords are hashed with bcrypt.
- Reset code can be emailed via SMTP.
- If SMTP is not configured, reset code is logged to server console in non-production.
- Frontend files from repo root are auto-synced to `server/public` on `npm install`.
