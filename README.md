# Gmail Login App

A Gmail-style React inbox with an Express backend, SQLite persistence, session authentication, signup, password recovery, compose, and optional Google OAuth login.

## Requirements

- Node.js 22+
- npm

## Install

```powershell
npm install
```

Create a `.env` file in the project root. Start with `.env.example`:

```env
PORT=3000
CLIENT_URL=http://localhost:5173
SESSION_SECRET=replace-with-a-long-random-secret
VITE_API_BASE=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`GOOGLE_*` values are optional for local email/password login. They are required for the **Continue with Google** button.

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

## Google OAuth

Create an OAuth 2.0 Web application client in Google Cloud and add this redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

Set the client ID and secret in `.env`, restart the backend, and use **Continue with Google**. A successful OAuth flow redirects to the real Gmail inbox.

## Validation

Build the frontend:

```powershell
npm run build
```

Check the backend:

```text
http://localhost:3000/api/health
```

## Security Notes

- Never commit `.env`, `php.txt`, or `app.db`.
- Use a long random `SESSION_SECRET` in production.
- Use HTTPS in production so secure cookies are enabled.
- Replace the local reset flow with email-verified recovery for a public deployment.
- Use a persistent production database and session store when deploying beyond local development.
