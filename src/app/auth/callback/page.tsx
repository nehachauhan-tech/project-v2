'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // AuthProvider handles the code exchange. Once it finishes loading,
    // we just check the result and redirect.
    if (loading) return;

    if (user) {
      router.replace(profile ? '/chat' : '/profile/setup');
    } else {
      setTimedOut(true);
    }
  }, [loading, user, profile, router]);

  // Safety timeout in case AuthProvider takes too long
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut && !user) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <p className="text-red-400 text-sm">Sign-in failed. Please try again.</p>
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
