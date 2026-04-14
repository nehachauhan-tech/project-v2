'use client';

import React, { useState, useEffect } from 'react';
import { supabase_client } from '@/lib/supabase_client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { MessageCircle, Mail, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect already-authenticated users via AuthContext (no extra lock contention)
  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/chat');
    }
  }, [authLoading, user, router]);

  const checkingAuth = authLoading || !!user;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase_client.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    // Check if profile exists
    const { data: { user: loggedInUser } } = await supabase_client.auth.getUser();
    if (loggedInUser) {
      const { data: profile } = await supabase_client
        .from('project_v2_profiles')
        .select('id')
        .eq('id', loggedInUser.id)
        .single();

      if (!profile) {
        router.push('/profile/setup');
      } else {
        router.push('/chat');
      }
    } else {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    const { error: authError } = await supabase_client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setGoogleLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-7 h-7 text-emerald-400 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.08] to-transparent" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/[0.06] blur-[128px]" />

        <Link href="/" className="relative flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold">Talkr</span>
        </Link>

        <div className="relative">
          <h1 className="text-5xl font-bold tracking-tight leading-tight mb-4">
            Welcome<br />
            <span className="text-white/30">back.</span>
          </h1>
          <p className="text-white/40 text-lg max-w-sm">
            Pick up where you left off. Your conversations and characters are waiting.
          </p>
        </div>

        <p className="relative text-sm text-white/20">&copy; 2026 Talkr</p>
      </div>

      {/* Right: Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold">Talkr</span>
            </Link>
          </div>

          <h2 className="text-3xl font-bold mb-2">Log in</h2>
          <p className="text-white/40 mb-8">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
              Sign up
            </Link>
          </p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 bg-white/[0.06] border border-white/[0.1] rounded-xl py-3.5 text-sm font-medium hover:bg-white/[0.1] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <FcGoogle className="w-5 h-5" />
                Continue with Google
              </>
            )}
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-white/[0.1]" />
            <span className="text-xs text-white/30 uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/[0.1]" />
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-white/[0.06] border border-white/[0.1] rounded-xl pl-12 pr-12 py-3.5 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary !py-4 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Log in <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
