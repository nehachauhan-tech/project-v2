'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase_client } from '@/lib/supabase_client';
import { Loader2 } from 'lucide-react';

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');
  const handled = useRef(false);

  useEffect(() => {
    // Prevent double-fire in React strict mode
    if (handled.current) return;
    handled.current = true;

    const next = searchParams.get('next');

    const redirectUser = async (userId: string) => {
      if (next) {
        router.replace(next);
        return;
      }

      const { data: profile } = await supabase_client
        .from('project_v2_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      router.replace(profile ? '/chat' : '/profile/setup');
    };

    // With implicit flow, the Supabase client auto-detects the hash fragment
    // (#access_token=...) and establishes the session. We listen for that event.
    const { data: { subscription } } = supabase_client.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
          subscription.unsubscribe();
          await redirectUser(session.user.id);
        }
      }
    );

    // Also check if a session already exists (e.g. hash was already parsed)
    supabase_client.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        redirectUser(session.user.id);
      }
    });

    // Timeout fallback
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      setError('Authentication timed out. Please try again.');
    }, 15000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
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
