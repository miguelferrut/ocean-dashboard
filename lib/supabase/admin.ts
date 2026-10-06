import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

// Bypasses RLS. Only for Auth admin operations (invite, ban) after the caller has been
// verified as an admin with requireRole("admin"). Never import from client code.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient<Database>(publicEnv().url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
