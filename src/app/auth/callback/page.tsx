'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase_client } from '@/lib/supabase_client';
import { Loader2 } from 'lucide-react';

// Module-level flag prevents double-exchange in React strict mode.
// The PKCE code is single-use — exchanging it twice causes the second call to fail.
let exchangeInProgress = false;

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    if (exchangeInProgress) return;
    exchangeInProgress = true;

    const run = async () => {
      const code = searchParams.get('code');
      const next = searchParams.get('next') ?? null;

      const redirectUser = async (userId: string) => {
        if (next) { router.replace(next); return; }
        const { data: profile } = await supabase_client
          .from('project_v2_profiles')
          .select('id')
          .eq('id', userId)
          .single();
        router.replace(profile ? '/chat' : '/profile/setup');
      };

      if (code) {
        const { data, error: err } = await supabase_client.auth.exchangeCodeForSession(code);
        if (err || !data.session) {
          exchangeInProgress = false;
          setError(err?.message ?? 'Sign-in failed. Please try again.');
          return;
        }
        await redirectUser(data.session.user.id);
        return;
      }

      // No code — check for an existing session (e.g. coming back after email verify)
      const { data: { session } } = await supabase_client.auth.getSession();
      if (session) {
        await redirectUser(session.user.id);
        return;
      }

      exchangeInProgress = false;
      setError('No authentication code found. Please try again.');
    };

    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => { exchangeInProgress = false; router.replace('/login'); }}
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
