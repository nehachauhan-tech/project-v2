'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase_client } from '@/lib/supabase_client';
import { Loader2 } from 'lucide-react';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const next = searchParams.get('next');

      // The Supabase client (with detectSessionInUrl: true and flowType: 'pkce')
      // automatically picks up the ?code= param and exchanges it using the
      // code verifier stored in localStorage. We just need to wait for the session.
      const { data: { session }, error: sessionError } = await supabase_client.auth.getSession();

      if (sessionError || !session) {
        // If getSession didn't pick it up yet, listen for the auth state change
        const { data: { subscription } } = supabase_client.auth.onAuthStateChange(
          async (event, newSession) => {
            if (event === 'SIGNED_IN' && newSession) {
              subscription.unsubscribe();
              await redirectUser(newSession.user.id, next);
            }
          }
        );

        // Give it a few seconds, then fail
        setTimeout(() => {
          subscription.unsubscribe();
          setError('Authentication timed out. Please try again.');
        }, 10000);
        return;
      }

      await redirectUser(session.user.id, next);
    };

    const redirectUser = async (userId: string, next: string | null) => {
      if (next) {
        router.replace(next);
        return;
      }

      // Check if user has a profile
      const { data: profile } = await supabase_client
        .from('project_v2_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!profile) {
        router.replace('/profile/setup');
      } else {
        router.replace('/chat');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => router.replace('/login')}
          className="text-emerald-400 hover:text-emerald-300 text-sm font-medium transition-colors"
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
      <p className="text-white/40 text-sm">Signing you in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
          <p className="text-white/40 text-sm">Signing you in...</p>
        </div>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
