import React, { useState } from 'react';
import { getOrCreateLocalKeys } from '../crypto/keyManager.js';
import { API_URL } from '../config.js';

interface LoginRegisterProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function LoginRegister({ onAuthSuccess }: LoginRegisterProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    if (!username || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const endpoint = isLogin ? `${API_URL}/api/auth/login` : `${API_URL}/api/auth/register`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.status === 'pending') {
          setIsPendingApproval(true);
        } else {
          setError(data.error || 'Something went wrong');
        }
        setLoading(false);
        return;
      }

      if (isLogin) {
        // Success login
        const token = data.token;
        const user = data.user;

        // E2EE Key Initialization
        try {
          const keys = await getOrCreateLocalKeys(user.username);
          // If server doesn't have the public key yet, upload it
          if (!user.hasPublicKey) {
            const uploadRes = await fetch(`${API_URL}/api/crypto/keys`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ publicKeyBundle: keys.publicKeyJwk })
            });
            if (!uploadRes.ok) {
              console.error('Failed to upload public key to server');
            } else {
              user.hasPublicKey = true;
            }
          }
        } catch (keyErr) {
          console.error('Error generating/uploading crypto keys:', keyErr);
        }

        onAuthSuccess(token, user);
      } else {
        // Successful register
        if (data.user.status === 'approved') {
          setMessage('First user registered and automatically approved as admin! You can now log in.');
        } else {
          setMessage('Registration request submitted! Please wait for the administrator to approve your account.');
          setIsPendingApproval(true);
        }
        setIsLogin(true);
      }
    } catch (err) {
      setError('Connection to server failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setError('');
    setLoading(true);
    try {
      // Attempt login to check if approved
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok) {
        // Approved! Let's log in
        const token = data.token;
        const user = data.user;

        // E2EE Key setup
        const keys = await getOrCreateLocalKeys(user.username);
        if (!user.hasPublicKey) {
          await fetch(`${API_URL}/api/crypto/keys`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ publicKeyBundle: keys.publicKeyJwk })
          });
          user.hasPublicKey = true;
        }

        onAuthSuccess(token, user);
      } else {
        if (data.status === 'pending') {
          setError('Still pending approval. Please ask the administrator.');
        } else {
          setError(data.error || 'Failed to authenticate');
          setIsPendingApproval(false); // Reset back to screen
        }
      }
    } catch (e) {
      setError('Failed to reach server.');
    } finally {
      setLoading(false);
    }
  };

  if (isPendingApproval) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card pending-card">
          <div className="pending-icon">⏳</div>
          <h2>Pending Approval</h2>
          <p>Your user profile <strong>{username}</strong> has been registered. You must be approved by the administrator before accessing the chatroom.</p>
          
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '15px' }}>{error}</div>}

          <button className="btn btn-primary" onClick={checkStatus} disabled={loading}>
            {loading ? 'Checking...' : 'Check Approval Status'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: '10px' }} 
            onClick={() => {
              setIsPendingApproval(false);
              setUsername('');
              setPassword('');
              setError('');
            }}
            disabled={loading}
          >
            Cancel / Register Different User
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>{isLogin ? 'Welcome Back' : 'Create Chat Request'}</h2>
        <p>{isLogin ? 'Enter details to enter your DuoChat room' : 'Submit a request to chat in the room'}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. alice"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>{error}</div>}
          {message && <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '15px', textAlign: 'center' }}>{message}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : isLogin ? 'Log In' : 'Request Access'}
          </button>
        </form>

        <div className="auth-toggle">
          {isLogin ? (
            <>
              New to this room? <span onClick={() => { setIsLogin(false); setError(''); setMessage(''); }}>Register Request</span>
            </>
          ) : (
            <>
              Already have an approved account? <span onClick={() => { setIsLogin(true); setError(''); setMessage(''); }}>Log In</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
