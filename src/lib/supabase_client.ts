import { createClient } from '@supabase/supabase-js';

const supabase_url      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase_anon_key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single shared browser client.
// - persistSession: true  — saves JWT to localStorage so reloads don't re-authenticate
// - autoRefreshToken: true — SDK proactively refreshes the JWT before it expires
// - detectSessionInUrl: false — we handle PKCE code exchange manually in /auth/callback
export const supabase_client = createClient(supabase_url, supabase_anon_key, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,
    flowType:          'pkce',                 // PKCE: Supabase sends ?code= to callback, exchanged client-side
    storageKey:        'talkr-auth-token',    // stable key across deploys
  },
});

// ── Background token refresh ──────────────────────────────────────────────────
// The SDK already auto-refreshes near expiry, but if the tab is backgrounded
// for a long time the refresh can be missed. We manually refresh every 5 minutes
// while the page is open so the 7-day idle session never goes stale silently.
if (typeof window !== 'undefined') {
  const FIVE_MINUTES = 5 * 60 * 1000;

  const backgroundRefresh = async () => {
    const { data: { session } } = await supabase_client.auth.getSession();
    if (session) {
      // refreshSession() gets a fresh JWT without a network call if the token
      // is still valid; it hits the server only when the token is close to expiry.
      await supabase_client.auth.refreshSession();
    }
  };

  setInterval(backgroundRefresh, FIVE_MINUTES);
}
