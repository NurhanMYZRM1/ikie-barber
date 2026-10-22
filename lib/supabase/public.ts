import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

// Public rendering always uses the anon role—even when the owner visits the shop.
// It also avoids refreshing an owner's cookie in a Server Component, where Next
// cannot persist the replacement cookie. Protected routes use server.ts instead.
export function createPublicClient() {
  const { url, key } = getSupabaseConfig();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
