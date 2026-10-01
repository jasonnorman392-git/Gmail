import express from 'express';
import session from 'express-session';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ALLOWED_ORIGINS = CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? null : 'local-development-session-secret');
const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const CREDENTIAL_FILE = path.join(DATA_DIR, 'php.txt');
const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super();
    this.database = database;
  }

  get(sessionId, callback) {
    try {
      const row = this.database.prepare('SELECT session_data, expires_at FROM sessions WHERE sid = ?').get(sessionId);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) {
        this.database.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
        return callback(null, null);
      }
      return callback(null, JSON.parse(row.session_data));
    } catch (error) {
      return callback(error);
    }
  }

  set(sessionId, sessionData, callback = () => {}) {
    try {
      const cookie = sessionData.cookie || {};
      const expiration = cookie.expires
        ? new Date(cookie.expires).getTime()
        : Date.now() + (cookie.maxAge || 24 * 60 * 60 * 1000);
      this.database.prepare(`
        INSERT INTO sessions (sid, session_data, expires_at) VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET session_data = excluded.session_data, expires_at = excluded.expires_at
      `).run(sessionId, JSON.stringify(sessionData), expiration);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sessionId, callback = () => {}) {
    try {
      this.database.prepare('DELETE FROM sessions WHERE sid = ?').run(sessionId);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sessionId, sessionData, callback = () => {}) {
    this.set(sessionId, sessionData, callback);
  }
}

if (!SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be configured in production.');
}

const authAttempts = new Map();
const authRateLimit = (req, res, next) => {
  const now = Date.now();
  const key = req.ip;
  const recentAttempts = (authAttempts.get(key) || []).filter((timestamp) => now - timestamp < 15 * 60 * 1000);

  if (recentAttempts.length >= 10) {
    return res.status(429).json({ message: 'Too many authentication attempts. Please try again later.' });
  }

  recentAttempts.push(now);
  authAttempts.set(key, recentAttempts);
  next();
};

const isBcryptHash = (value) => /^\$2[aby]\$\d{2}\$/.test(value);

const readFileCredentials = () => {
  if (!fs.existsSync(CREDENTIAL_FILE)) return [];

  return fs.readFileSync(CREDENTIAL_FILE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const separator = line.indexOf('|');
      if (separator < 1) return null;
      return {
        email: line.slice(0, separator).trim().toLowerCase(),
        passwordHash: line.slice(separator + 1).trim()
      };
    })
    .filter((credential) => credential?.email && credential.passwordHash);
};

const writeFileCredentials = (credentials) => {
  fs.writeFileSync(
    CREDENTIAL_FILE,
    `# One local user per line: email|bcrypt-password-hash\n${credentials.map((credential) => `${credential.email}|${credential.passwordHash}`).join('\n')}\n`,
    'utf8'
  );
};

const appendFileCredential = (email, password) => {
  const credentials = readFileCredentials();
  credentials.push({ email, passwordHash: bcrypt.hashSync(password, 10) });
  writeFileCredentials(credentials);
};

const saveFileCredential = (email, password) => {
  const credentials = readFileCredentials().filter((credential) => credential.email !== email);
  credentials.push({ email, passwordHash: bcrypt.hashSync(password, 10) });
  writeFileCredentials(credentials);
};

const ensureDb = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      sender_email TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      preview TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT PRIMARY KEY,
      session_data TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@gmail.com');
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)').run('Admin User', 'admin@gmail.com', passwordHash);
  }

  const fileCredentials = readFileCredentials();
  const normalizedCredentials = fileCredentials.map((credential) => ({
    email: credential.email,
    passwordHash: isBcryptHash(credential.passwordHash)
      ? credential.passwordHash
      : bcrypt.hashSync(credential.passwordHash, 10)
  }));
  if (normalizedCredentials.some((credential, index) => credential.passwordHash !== fileCredentials[index].passwordHash)) {
    writeFileCredentials(normalizedCredentials);
  }

  for (const credential of normalizedCredentials) {
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(credential.email);
    if (!existingUser) {
      db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)')
        .run(credential.email.split('@')[0], credential.email, credential.passwordHash);
    }
  }

  const messageCount = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;
  if (messageCount === 0) {
    const sampleMessages = [
      {
        user_email: 'admin@gmail.com',
        sender_email: 'googleworkspace-noreply@google.com',
        sender_name: 'Google Workspace',
        subject: 'Your account activity summary',
        preview: 'We noticed a successful sign-in from a new device.',
        body: 'Hi there,\n\nWe noticed a successful sign-in to your account from a new device on a new browser. If this was you, no action is needed. If not, please secure your account immediately.\n\nRegards,\nGoogle Workspace Security Team',
        is_read: 0
      },
      {
        user_email: 'admin@gmail.com',
        sender_email: 'github@notifications.github.com',
        sender_name: 'GitHub',
        subject: 'Your pull request is ready for review',
        preview: 'Code review comments were added to your latest update.',
        body: 'Your recent pull request has been updated with new review comments. Please review the outstanding items and respond when ready.\n\nProject: Gmail Clone App\nStatus: Awaiting review',
        is_read: 0
      },
      {
        user_email: 'admin@gmail.com',
        sender_email: 'alerts@banking.example',
        sender_name: 'Banking Alerts',
        subject: 'Transaction confirmation',
        preview: 'Your recent purchase was successfully processed.',
        body: 'A transaction of $64.20 was successfully processed on your account. The payment details are available in your online banking dashboard.\n\nThank you.',
        is_read: 1
      },
      {
        user_email: 'admin@gmail.com',
        sender_email: 'updates@team.example',
        sender_name: 'Team Updates',
        subject: 'Sprint progress report',
        preview: 'The Q3 team wrap-up is now available for review.',
        body: 'This week, the development team shipped three major improvements and closed six bug fixes. The Q3 wrap-up deck is available in the shared drive.\n\nBest,\nTeam Ops',
        is_read: 1
      }
    ];

    const insertMessage = db.prepare(`
      INSERT INTO messages (user_email, sender_email, sender_name, subject, preview, body, is_read)
      VALUES (@user_email, @sender_email, @sender_name, @subject, @preview, @body, @is_read)
    `);

    for (const message of sampleMessages) {
      insertMessage.run(message);
    }
  }
};

ensureDb();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed.'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}
app.use(
  session({
    store: new SQLiteSessionStore(db),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use(express.static(path.join(__dirname)));

const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized. Please log in.' });
  }
  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running.' });
});

app.get('/api/session', (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }

  const user = db.prepare('SELECT id, full_name, email FROM users WHERE id = ?').get(req.session.userId);
  return res.json({ authenticated: true, user });
});

app.post('/api/signup', authRateLimit, (req, res) => {
  const { fullName, email, password } = req.body || {};

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: 'Full name, email, and password are required.' });
  }

  const cleanName = String(fullName).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  if (!cleanEmail.includes('@')) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (existingUser) {
    return res.status(409).json({ message: 'An account already exists with that email.' });
  }

  const passwordHash = bcrypt.hashSync(cleanPassword, 10);
  const insertResult = db.prepare('INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)')
    .run(cleanName, cleanEmail, passwordHash);
  appendFileCredential(cleanEmail, cleanPassword);

  req.session.userId = insertResult.lastInsertRowid;

  return res.status(201).json({
    message: 'Signup successful',
    user: {
      id: insertResult.lastInsertRowid,
      full_name: cleanName,
      email: cleanEmail
    }
  });
});

app.post('/api/login', authRateLimit, (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanPassword = String(password).trim();

  const fileCredential = readFileCredentials().find((credential) => credential.email === cleanEmail);
  if (!fileCredential || !bcrypt.compareSync(cleanPassword, fileCredential.passwordHash)) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isValidPassword = bcrypt.compareSync(cleanPassword, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  req.session.userId = user.id;

  return res.json({
    message: 'Login successful',
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email
    }
  });
});

app.post('/api/reset-password', authRateLimit, (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();

  if (!cleanEmail || !cleanPassword) {
    return res.status(400).json({ message: 'Email and new password are required.' });
  }

  if (cleanPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
  if (!user) {
    return res.status(404).json({ message: 'No account exists with that email.' });
  }

  const passwordHash = bcrypt.hashSync(cleanPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
  saveFileCredential(cleanEmail, cleanPassword);

  return res.json({ message: 'Password reset successful. You can now sign in.' });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logged out successfully.' });
  });
});

app.get('/api/inbox', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email, full_name FROM users WHERE id = ?').get(req.session.userId);
  const messages = db.prepare(`
    SELECT id, user_email, sender_email, sender_name, subject, preview, body, is_read, created_at
    FROM messages
    WHERE user_email = ?
    ORDER BY created_at DESC
  `).all(user.email);

  return res.json({ user, messages });
});

app.post('/api/messages', requireAuth, (req, res) => {
  const { to, subject, body } = req.body || {};
  const user = db.prepare('SELECT email, full_name FROM users WHERE id = ?').get(req.session.userId);

  if (!to || !subject || !body) {
    return res.status(400).json({ message: 'Recipient, subject, and message are required.' });
  }

  const preview = String(body).trim().slice(0, 80) || 'No message content';
  const insertResult = db.prepare(`
    INSERT INTO messages (user_email, sender_email, sender_name, subject, preview, body, is_read)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `).run(user.email, user.email, user.full_name, String(subject).trim(), preview, String(body).trim());

  const created = db.prepare('SELECT * FROM messages WHERE id = ?').get(insertResult.lastInsertRowid);
  return res.status(201).json({ message: created });
});

app.get('/api/messages/:id', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ? AND user_email = ?').get(Number(req.params.id), user.email);

  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  return res.json({ message });
});

app.post('/api/messages/:id/read', requireAuth, (req, res) => {
  const user = db.prepare('SELECT email FROM users WHERE id = ?').get(req.session.userId);
  const message = db.prepare('SELECT * FROM messages WHERE id = ? AND user_email = ?').get(Number(req.params.id), user.email);

  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(Number(req.params.id));
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  return res.json({ message: updated });
});

app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.get('/signup', (req, res) => {
  return res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('*', (req, res) => {
  const currentPath = req.path || '/';
  if (currentPath === '/dashboard') {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
