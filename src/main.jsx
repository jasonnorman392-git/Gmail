import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import './styles.css';

const ProtectedRoute = ({ user, children }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ user, children }) => {
  if (user) {
    return <Navigate to="/inbox" replace />;
  }

  return children;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </React.StrictMode>
);

function AppRoutes() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/session', { credentials: 'include' });
        const data = await res.json();
        setUser(data.authenticated ? data.user : null);
      } catch (error) {
        console.error('Session check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  if (loading) {
    return <div className="page"><div className="login-card"><p className="subtitle">Loading...</p></div></div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute user={user}><App mode="login" user={user} setUser={setUser} /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute user={user}><App mode="signup" user={user} setUser={setUser} /></PublicRoute>} />
      <Route path="/inbox" element={<ProtectedRoute user={user}><App mode="inbox" user={user} setUser={setUser} /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to={user ? '/inbox' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/inbox' : '/login'} replace />} />
    </Routes>
  );
}
