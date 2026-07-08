import { useState, useEffect } from 'react';
import LoginRegister from './auth/LoginRegister.js';
import ChatWindow from './chat/ChatWindow.js';
import { supabase } from './supabaseClient.js';

export interface UserProfile {
  id: string;
  username: string;
  role: string;
  status: string;
  hasPublicKey: boolean;
}

export default function App() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session and get user profile
    async function initSession() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (initialSession?.user) {
          setSessionToken(initialSession.access_token);
          await loadProfile(initialSession.user.id);
        }
      } catch (err) {
        console.error('Failed to get Supabase session:', err);
      } finally {
        setLoading(false);
      }
    }

    initSession();

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        setSessionToken(newSession.access_token);
        await loadProfile(newSession.user.id);
      } else {
        setSessionToken(null);
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId: string) {
    try {
      let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching public user record:', error.message);
      }

      if (!data) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const email = authUser.email || '';
          const newUsername = email.split('@')[0] || 'user';
          const isAbhishek = email.startsWith('abhishek') || email.startsWith('chauhanabhishekkr');
          
          const { data: newProfile, error: insertErr } = await supabase
            .from('users')
            .insert({
              id: userId,
              username: newUsername,
              role: isAbhishek ? 'admin' : 'user',
              status: 'approved',
              mood: ''
            })
            .select()
            .single();

          if (!insertErr && newProfile) {
            data = newProfile;
          }
        }
      }

      if (data) {
        setUser({
          id: data.id,
          username: data.username,
          role: data.role,
          status: data.status,
          hasPublicKey: !!data.public_key
        });
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }

  const handleAuthSuccess = (newToken: string, profile: UserProfile) => {
    setSessionToken(newToken);
    setUser(profile);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSessionToken(null);
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
      {sessionToken && user ? (
        <ChatWindow token={sessionToken} currentUser={user} onLogout={handleLogout} />
      ) : (
        <LoginRegister onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}
