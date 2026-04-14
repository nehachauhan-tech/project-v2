import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/login';

  if (code) {
    // Create a server-side Supabase client to exchange the code
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful verification — redirect to login (or wherever `next` points)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If code is missing or exchange failed, redirect to login with an error hint
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
