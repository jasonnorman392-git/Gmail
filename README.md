# Gmail Login App

A Gmail-style React inbox with an Express backend, SQLite persistence, session authentication, signup, password recovery, and compose.

## Requirements

- Node.js 22.9+
- npm

## Install

```powershell
npm install
```

Create a `.env` file in the project root using `.env.example` as a template:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
SESSION_SECRET=replace-with-a-long-random-secret
VITE_API_BASE=http://localhost:3000
```

## Run Locally

Start the backend:

```powershell
npm run server
```

In a second terminal, start the React frontend:

```powershell
npm run dev
```

Open:

```text
http://localhost:5173/login
```

## Local Credentials

The demo account is:

```text
Email: admin@gmail.com
Password: admin123
```

Users can create accounts from the signup screen. The app stores users in SQLite and stores bcrypt password hashes. `php.txt` is a local credential index and is ignored by Git; it must not contain plaintext passwords.

## Password Recovery

Open `/reset` from the login screen to set a new password for an existing local account. The reset updates both SQLite and the bcrypt hash in `php.txt`.

This local reset flow does not send email verification and should be replaced with verified email recovery before public production use.

## Validation

Build the frontend:

```powershell
npm run build
```

Check the backend:

```text
http://localhost:3000/api/health
```

## Deploy

The frontend is deployed to Vercel and the Express API runs as a persistent Render web service. SQLite and `php.txt` must live on Render's persistent disk; they cannot be stored reliably in Vercel's serverless filesystem.

1. Import this repository into Vercel. Vercel uses `vercel.json` to build the Vite app and route client-side paths to `index.html`.
2. Create the Render service from `render.yaml`. Render will prompt for `CLIENT_URL`; set it to the Vercel deployment origin, such as `https://your-project.vercel.app`.
3. In Vercel project settings, set `VITE_API_BASE` to the Render service origin, such as `https://your-api.onrender.com`, then redeploy the frontend.
4. Add your custom domain in Vercel and configure its DNS as instructed by Vercel. Update Render's `CLIENT_URL` to the final frontend origin after the domain is active.

The Render blueprint creates a persistent disk for `app.db` and `php.txt`, and generates `SESSION_SECRET`. Production cookies require HTTPS. Keep the Vercel frontend and API origins configured exactly so credentialed requests pass CORS checks.

## Security Notes

- Never commit `.env`, `php.txt`, or `app.db`.
- Use a long random `SESSION_SECRET` in production.
- Use HTTPS in production so secure cookies are enabled.
- Replace the local reset flow with email-verified recovery for a public deployment.
- Use a persistent production database and session store when deploying beyond local development.
