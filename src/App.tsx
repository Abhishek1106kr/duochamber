import { useState, useEffect } from 'react';
import LoginRegister from './auth/LoginRegister.js';
import ChatWindow from './chat/ChatWindow.js';

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  status: string;
  hasPublicKey: boolean;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('duochat_token'));
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          // Token expired or invalid
          handleLogout();
        }
      } catch (err) {
        console.error('Auth verification check failed:', err);
        // We do not log out immediately on simple connection failure, only if status code is explicit
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const handleAuthSuccess = (newToken: string, authenticatedUser: UserProfile) => {
    localStorage.setItem('duochat_token', newToken);
    setToken(newToken);
    setUser(authenticatedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('duochat_token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="auth-wrapper" style={{ flexDirection: 'column', gap: '20px' }}>
        <div className="typing-dots" style={{ transform: 'scale(2)' }}>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', letterSpacing: '1px' }}>SECURE CHANNEL INITIALIZING...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {token && user ? (
        <ChatWindow token={token} currentUser={user} onLogout={handleLogout} />
      ) : (
        <LoginRegister onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}
