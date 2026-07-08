import React, { useState } from 'react';
import { getOrCreateLocalKeys } from '../crypto/keyManager.js';
import { supabase } from '../supabaseClient.js';

interface LoginRegisterProps {
  onAuthSuccess: (token: string, user: any) => void;
}

export default function LoginRegister({ onAuthSuccess }: LoginRegisterProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
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

    if (!email || !password) {
      setError('Please fill in all fields.');
      setLoading(false);
      return;
    }

    try {
      const trimmedEmail = email.toLowerCase().trim();
      
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' ? 'Invalid email or password.' : authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        // Load the public profile status
        let { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (!profile) {
          const newUsername = authData.user.email ? authData.user.email.split('@')[0] : 'user';
          const isAbhishek = trimmedEmail.startsWith('abhishek') || trimmedEmail.startsWith('chauhanabhishekkr');
          
          const { data: newProfile, error: insertErr } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              username: newUsername,
              role: isAbhishek ? 'admin' : 'user',
              status: 'approved',
              mood: ''
            })
            .select()
            .single();

          if (insertErr || !newProfile) {
            console.error('Failed to auto-create user profile:', insertErr?.message);
            setError('Failed to load user profile record.');
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
          profile = newProfile;
        }

        if (profile.status !== 'approved') {
          if (profile.status === 'pending') {
            setIsPendingApproval(true);
          } else {
            setError('Access has been rejected by the administrator.');
          }
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // E2EE Key Initialization
        try {
          const keys = await getOrCreateLocalKeys(profile.username);
          // If server doesn't have the public key yet, upload it
          if (!profile.public_key) {
            const { error: keyUpdateErr } = await supabase
              .from('users')
              .update({ public_key: JSON.stringify(keys.publicKeyJwk) })
              .eq('id', profile.id);
              
            if (keyUpdateErr) {
              console.error('Failed to upload public key to Supabase:', keyUpdateErr.message);
            } else {
              profile.public_key = JSON.stringify(keys.publicKeyJwk);
            }
          }
        } catch (keyErr) {
          console.error('Error generating/uploading crypto keys:', keyErr);
        }

        setError('');
        onAuthSuccess(authData.session!.access_token, {
          id: profile.id,
          username: profile.username,
          role: profile.role,
          status: profile.status,
          hasPublicKey: !!profile.public_key
        });
      }
    } catch (err: any) {
      setError('Connection to auth database failed.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setError('');
    setLoading(true);
    try {
      const trimmedEmail = email.toLowerCase().trim();
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        let { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (!profile) {
          const newUsername = authData.user.email ? authData.user.email.split('@')[0] : 'user';
          const isAbhishek = trimmedEmail.startsWith('abhishek') || trimmedEmail.startsWith('chauhanabhishekkr');
          
          const { data: newProfile } = await supabase
            .from('users')
            .insert({
              id: authData.user.id,
              username: newUsername,
              role: isAbhishek ? 'admin' : 'user',
              status: 'approved',
              mood: ''
            })
            .select()
            .single();
          profile = newProfile;
        }

        if (profile && profile.status === 'approved') {
          // E2EE Key setup
          const keys = await getOrCreateLocalKeys(profile.username);
          if (!profile.public_key) {
            await supabase
              .from('users')
              .update({ public_key: JSON.stringify(keys.publicKeyJwk) })
              .eq('id', profile.id);
            profile.public_key = JSON.stringify(keys.publicKeyJwk);
          }

          setError('');
          onAuthSuccess(authData.session!.access_token, {
            id: profile.id,
            username: profile.username,
            role: profile.role,
            status: profile.status,
            hasPublicKey: !!profile.public_key
          });
        } else if (profile && profile.status === 'pending') {
          setError('Still pending approval. Please ask the administrator.');
          await supabase.auth.signOut();
        } else {
          setError('Access rejected.');
          await supabase.auth.signOut();
          setIsPendingApproval(false);
        }
      }
    } catch (e) {
      setError('Failed to reach authentication server.');
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
          <p>Your user profile <strong>{email}</strong> has been registered. You must be approved by the administrator before accessing the chatroom.</p>
          
          {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '15px' }}>{error}</div>}

          <button className="btn btn-primary" onClick={checkStatus} disabled={loading}>
            {loading ? 'Checking...' : 'Check Approval Status'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            style={{ marginTop: '10px' }} 
            onClick={() => {
              setIsPendingApproval(false);
              setEmail('');
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
        <p>{isLogin ? 'Enter credentials to enter your DuoChat room' : 'Submit a request to chat in the room'}</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. abhishek@duochat.local"
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
