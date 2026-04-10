import { createClient } from "@supabase/supabase-js";

// Initialize the Supabase client with the environment variables
const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase_anon_key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// This is the main client used for client-side operations
export const supabase_client = createClient(supabase_url, supabase_anon_key);
