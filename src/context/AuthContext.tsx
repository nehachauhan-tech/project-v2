'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase_client } from '@/lib/supabase_client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// Module-level promise ensures PKCE code exchange only runs once,
// even when React Strict Mode double-mounts the provider.
let codeExchangePromise: Promise<void> | null = null;

function exchangeCodeOnce() {
  if (codeExchangePromise) return codeExchangePromise;

  codeExchangePromise = (async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && window.location.pathname === '/auth/callback') {
      await supabase_client.auth.exchangeCodeForSession(code);
    }
  })();

  return codeExchangePromise;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase_client
      .from('project_v2_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    setProfile(data);
    return data;
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      // Wait for PKCE exchange if on callback page (runs only once at module level)
      await exchangeCodeOnce();

      const { data: { session } } = await supabase_client.auth.getSession();
      if (session?.user && mounted) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      }
      if (mounted) setLoading(false);
    };
    init();

    const { data: { subscription } } = supabase_client.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase_client.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext>
  );
}

export const useAuth = () => useContext(AuthContext);
