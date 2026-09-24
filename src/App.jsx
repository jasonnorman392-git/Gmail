import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:3000';

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

    const endpoint = mode === 'login' ? '/api/login' : '/api/signup';
    const payload = mode === 'login'
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

          <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
          <p className="subtitle">{mode === 'login' ? 'Use your Google Account' : 'Sign up for your Google Account'}</p>

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
                {mode === 'login' ? 'Create account' : 'Already have an account?'}
              </button>
              <button type="submit" className="primary-btn" disabled={isSubmitting}>
                {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Next' : 'Sign up'}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="menu-btn">☰</div>
          <div className="gmail-brand">
            <span className="g blue">M</span>
            <span className="g red">a</span>
            <span className="g yellow">i</span>
            <span className="g blue">l</span>
          </div>
        </div>

        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Search mail" />
        </div>

        <div className="profile-wrap">
          <button className="logout-btn" onClick={handleLogout}>Sign out</button>
        </div>
      </header>

      <main className="content-area">
        <aside className="sidebar">
          <button className="compose-btn" onClick={() => setSelectedMessage(null)}>Compose</button>
          <nav className="nav-menu">
            <div className="nav-item active">Inbox</div>
            <div className="nav-item">Starred</div>
            <div className="nav-item">Snoozed</div>
            <div className="nav-item">Sent</div>
          </nav>
        </aside>

        <section className="inbox-panel">
          <div className="inbox-header">
            <h1>Inbox</h1>
            <span className="welcome-text">Welcome, {user?.full_name || user?.email}</span>
          </div>

          <div className="inbox-layout">
            <div className="mail-list">
              {inbox.map((mail) => (
                <article
                  key={mail.id}
                  className={`mail-item ${mail.is_read ? '' : 'unread'}`}
                  onClick={() => setSelectedMessage(mail)}
                >
                  <div className="sender">{mail.sender_name}</div>
                  <div className="subject">{mail.subject}</div>
                  <div className="preview">{mail.preview}</div>
                  <div className="time">{new Date(mail.created_at).toLocaleDateString()}</div>
                </article>
              ))}
            </div>

            <div className="detail-column">
              {selectedMessage ? (
                <div className="message-detail">
                  <h2>{selectedMessage.subject}</h2>
                  <div className="message-meta">From: {selectedMessage.sender_name} ({selectedMessage.sender_email})</div>
                  <div className="message-body">{selectedMessage.body}</div>
                </div>
              ) : (
                <form className="compose-form" onSubmit={handleComposeSubmit}>
                  <h2>Compose</h2>
                  <input type="text" placeholder="To" value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} />
                  <input type="text" placeholder="Subject" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} />
                  <textarea rows="8" placeholder="Message" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} />
                  <button type="submit" className="primary-btn">Send</button>
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
