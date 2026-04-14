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
      const code = searchParams.get('code');
      const next = searchParams.get('next');

      if (code) {
        // Explicitly exchange the PKCE code for a session.
        // The browser client has the code_verifier in localStorage.
        const { data, error: exchangeError } = await supabase_client.auth.exchangeCodeForSession(code);

        if (exchangeError || !data.session) {
          setError(exchangeError?.message ?? 'Failed to sign in. Please try again.');
          return;
        }

        await redirectUser(data.session.user.id, next);
        return;
      }

      // No code param — check if there's already a session (e.g. email verification)
      const { data: { session } } = await supabase_client.auth.getSession();
      if (session) {
        await redirectUser(session.user.id, next);
        return;
      }

      setError('Authentication failed. Please try again.');
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
