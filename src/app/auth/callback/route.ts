import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    // Create a server-side Supabase client to exchange the code
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Check if the user already has a profile
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const { data: profile } = await serviceClient
        .from('project_v2_profiles')
        .select('id')
        .eq('id', data.session.user.id)
        .single();

      if (next) {
        // Honour explicit `next` param (e.g. email verification → /login)
        return NextResponse.redirect(`${origin}${next}`);
      }

      // OAuth sign-in: send to profile setup if no profile, otherwise chat
      if (!profile) {
        return NextResponse.redirect(`${origin}/profile/setup`);
      }
      return NextResponse.redirect(`${origin}/chat`);
    }
  }

  // If code is missing or exchange failed, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
