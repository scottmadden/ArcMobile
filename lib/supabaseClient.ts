/* lib/supabaseClient.ts - minimal supabase client used by the app */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  // Avoid throwing during build — warn so logs show the env problem.
  // In production, set these in Vercel dashboard.
  // eslint-disable-next-line no-console
  console.warn("Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set.");
}

export const supabase = createClient(url, anonKey);
