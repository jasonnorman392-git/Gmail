import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const Icon = ({ name, className = '' }) => {
  const paths = {
    menu: 'M4 7h16v2H4zm0 5h16v2H4zm0 5h16v2H4z',
    search: 'M10.5 3a7.5 7.5 0 015.9 12.8l4.4 4.4 1.4-1.4-4.4-4.4A7.5 7.5 0 1110.5 3zm0 2a5.5 5.5 0 104.7 9.4A5.5 5.5 0 0010.5 5z',
    inbox: 'M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5zm2.5-.5h11a.5.5 0 01.5.5v6.2L16.3 13a2 2 0 00-1.5-.7H9.2a2 2 0 00-1.5.7L6.5 12.7V6.5a.5.5 0 01.5-.5zm.8 10.5h10.4l-2.1-2.1a.5.5 0 00-.3-.2H9.7a.5.5 0 00-.3.2L7.3 16.5z',
    star: 'M12 2.5l2.73 5.53 6.1.89-4.42 4.3 1.04 6.08L12 0l-5.45 2.86 1.04-6.08L3.17 8.92l6.1-.89L12 2.5z',
    clock: 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm1 5h-2v5.5l4.5 2.5 1-1.7-3.5-1.8z',
    send: 'M3 20.5l18-8.5L3 3.5l2.5 7.5L3 20.5zm3.7-7.5l.8 2.7 7.4-2.7-7.4-2.7-.8 2.7z',
    compose: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm13.71-9.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.34 1.34 3.75 3.75 1.34-1.34z',
    reply: 'M10 9V5l-7 7 7 7v-4c5 0 8.5 1.5 11 5-1-5-4-10-11-10z',
    back: 'M15.5 5l-7 7 7 7 1.4-1.4L11.3 12l5.6-5.6L15.5 5z'
  };

  return (
    <svg viewBox="0 0 24 24" className={`icon ${className}`} aria-hidden="true" focusable="false">
      <path d={paths[name] || paths.menu} fill="currentColor" />
    </svg>
  );
};

function App({ mode = 'login', user, setUser }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inbox, setInbox] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [compose, setCompose] = useState({ to: '', subject: '', body: '' });

  const loadInbox = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inbox`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setInbox(data.messages || []);
      if (data.messages && data.messages.length > 0) {
        setSelectedMessage(data.messages[0]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (user && mode === 'inbox') {
      loadInbox();
    }
  }, [user, mode]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage('');

    const endpoint = mode === 'login' ? '/api/login' : mode === 'reset' ? '/api/reset-password' : '/api/signup';
    const payload = mode === 'login' || mode === 'reset'
      ? { email: form.email, password: form.password }
      : { fullName: form.fullName, email: form.email, password: form.password };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      if (mode === 'reset') {
        setMessage(data.message);
        navigate('/login');
        return;
      }

      setUser(data.user);
      setForm({ fullName: '', email: '', password: '' });
      navigate('/inbox');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE}/api/logout`, {
      method: 'POST',
      credentials: 'include',
    });

    setUser(null);
    setInbox([]);
    setSelectedMessage(null);
    navigate('/login');
  };

  const handleComposeSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compose),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send message');
      }

      setCompose({ to: '', subject: '', body: '' });
      await loadInbox();
      setSelectedMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const formatMailboxTime = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (mode !== 'inbox') {
    return (
      <main className="page">
        <section className="login-card">
          <div className="logo" aria-label="Google logo">
            <span className="g blue">G</span>
            <span className="g red">o</span>
            <span className="g yellow">o</span>
            <span className="g blue">g</span>
            <span className="g green">l</span>
            <span className="g red">e</span>
          </div>

          <h1>{mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Reset password' : 'Create account'}</h1>
          <p className="subtitle">{mode === 'login' ? 'Use your Google Account' : mode === 'reset' ? 'Choose a new password for your account' : 'Sign up for your Google Account'}</p>

          <form onSubmit={handleAuthSubmit}>
            {mode === 'signup' && (
              <label className="input-group">
                <input name="fullName" value={form.fullName} onChange={handleChange} placeholder="Full name" />
              </label>
            )}

            <label className="input-group">
              <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" autoComplete="username" />
            </label>

            <div className="password-wrap">
              <label className="input-group password-group">
                <input name="password" type="password" value={form.password} onChange={handleChange} placeholder="Password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </label>
            </div>

            {message && <p className="form-message error">{message}</p>}

            <div className="actions">
              <button type="button" className="link-button" onClick={() => navigate(mode === 'login' ? '/signup' : '/login')}>
                {mode === 'login' ? 'Create account' : 'Back to sign in'}
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Next' : mode === 'reset' ? 'Reset password' : 'Sign up'}
              </button>
            </div>
          </form>

          {mode === 'login' && (
            <button type="button" className="link-button recovery-link" onClick={() => navigate('/reset')}>
              Forgot password?
            </button>
          )}

          {mode === 'login' && (
            <>
              <div className="auth-divider"><span>or</span></div>
              <a className="google-login-btn" href="http://localhost:3000/api/auth/google">
                <span className="google-mark">G</span>
                Continue with Google
              </a>
            </>
          )}
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
          <div className="brand-wrap">
            <button type="button" className="icon-button menu-button" aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <div className="gmail-brand" aria-label="Gmail logo">
              <span className="g blue">M</span>
              <span className="g red">a</span>
              <span className="g yellow">i</span>
              <span className="g blue">l</span>
            </div>
          </div>

          <div className="search-wrap">
            <span className="search-icon"><Icon name="search" /></span>
            <input type="text" placeholder="Search mail" />
          </div>

          <div className="profile-wrap">
            <div className="user-pill">{(user?.full_name || user?.email || 'User').charAt(0).toUpperCase()}</div>
            <button className="logout-btn" onClick={handleLogout}>Sign out</button>
          </div>
        </header>

        <main className="content-area">
          <aside className="sidebar">
            <button className="compose-btn" onClick={() => setSelectedMessage(null)}>
              <span className="compose-icon"><Icon name="compose" /></span>
              Compose
            </button>
            <nav className="nav-menu" aria-label="Mail folders">
              <div className="nav-item active"><span className="nav-label"><Icon name="inbox" />Inbox</span><span className="count-pill">{inbox.length}</span></div>
              <div className="nav-item"><span className="nav-label"><Icon name="star" />Starred</span></div>
              <div className="nav-item"><span className="nav-label"><Icon name="clock" />Snoozed</span></div>
              <div className="nav-item"><span className="nav-label"><Icon name="send" />Sent</span></div>
            </nav>
          </aside>

          <section className="inbox-panel">
            <div className="inbox-header">
              <h1>Inbox</h1>
              <span className="welcome-text">{user?.full_name || user?.email}</span>
            </div>

            <div className="inbox-layout">
              <div className="mail-list">
                {inbox.map((mail) => (
                  <article
                    key={mail.id}
                    className={`mail-item ${mail.is_read ? 'read' : 'unread'}`}
                    onClick={() => setSelectedMessage(mail)}
                  >
                    <div className="sender">{mail.sender_name}</div>
                    <div className="subject-row">
                      <span className="subject">{mail.subject}</span>
                      <span className="preview">{mail.preview}</span>
                    </div>
                    <div className="time">{formatMailboxTime(mail.created_at)}</div>
                  </article>
                ))}
              </div>

              <div className="detail-column">
                {selectedMessage ? (
                  <div className="message-detail">
                    <div className="message-toolbar">
                      <button type="button" className="mini-btn" onClick={() => setSelectedMessage(null)}>
                        <span className="mini-icon"><Icon name="back" /></span>
                        Back
                      </button>
                      <button type="button" className="mini-btn soft">
                        <span className="mini-icon"><Icon name="reply" /></span>
                        Reply
                      </button>
                    </div>
                    <h2>{selectedMessage.subject}</h2>
                    <div className="message-meta">
                      <strong>{selectedMessage.sender_name}</strong>
                      <span>({selectedMessage.sender_email})</span>
                    </div>
                    <div className="message-body">{selectedMessage.body}</div>
                  </div>
                ) : (
                  <form className="compose-form" onSubmit={handleComposeSubmit}>
                    <h2>Compose</h2>
                    <input type="text" placeholder="To" value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} />
                    <input type="text" placeholder="Subject" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} />
                    <textarea rows="8" placeholder="Message" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} />
                    <div className="compose-actions">
                      <button type="submit" className="primary-btn">Send</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
}

export default App;
