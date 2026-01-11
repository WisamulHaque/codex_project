# Netlify Deployment Guide (OKR Tracker)

This project is ready to deploy as a Netlify site (frontend) + Netlify Function (backend API).

## 1) Prerequisites
- GitHub (or GitLab) repo pushed.
- MongoDB Atlas cluster + database name.
- Google OAuth credentials (Client ID/Secret) if Google login is enabled.
- SMTP credentials if you want real emails (verification + password reset).

## 2) Create the Netlify site
1. Go to Netlify → **Add new site** → **Import from Git**.
2. Select this repo.
3. Build settings are auto‑picked from `netlify.toml`.
   - **Build command:** `npm run build --workspace client`
   - **Publish directory:** `client/dist`
   - **Functions directory:** `netlify/functions`

## 3) Environment variables (Netlify → Site settings → Environment variables)
Set these in Netlify (Production scope is fine):

Backend (required):
- `MONGODB_URI` = your Atlas connection string.
- `JWT_SECRET` = long random string.
- `JWT_REFRESH_SECRET` = long random string.

Backend (recommended):
- `MONGODB_DB` = database name (e.g., `okrTracker`)
- `JWT_EXPIRES_IN` = `1h`
- `JWT_REFRESH_EXPIRES_IN` = `7d`
- `APP_BASE_URL` = your Netlify site URL (e.g., `https://your-site.netlify.app`)

Google OAuth (optional):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

SMTP (optional but recommended for email flows):
- `SMTP_HOST`
- `SMTP_PORT` (e.g., `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM` (e.g., `no-reply@yourdomain.com`)

Frontend (optional):
- `VITE_API_BASE_URL` = `/api/v1` (default is already `/api/v1` in production)

## 4) MongoDB Atlas checklist
1. **Network access**: Allow your Netlify IPs, or temporarily allow `0.0.0.0/0` for testing.
2. **Database user**: Ensure the user in `MONGODB_URI` has read/write on your DB.

## 5) Google OAuth checklist (if using Google login)
1. In Google Cloud Console → OAuth consent screen + Credentials:
2. Add **Authorized redirect URI**:
   - `https://your-site.netlify.app` (or your custom domain)
3. Copy Client ID/Secret into Netlify env vars.

## 6) Deploy
1. Trigger a deploy in Netlify (or push to main).
2. Open the site URL and verify login + API calls.

## 7) Notes
- API routes are proxied to Netlify Functions via redirects in `netlify.toml`.
- SPA routing is handled via a catch‑all redirect to `/index.html`.
- If verification emails are not arriving, check SMTP env vars or Netlify function logs.

