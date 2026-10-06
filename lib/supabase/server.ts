import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database.types";

// Acts as the signed-in user: every query is filtered by RLS.
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = publicEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only; middleware refreshes them.
        }
      },
    },
  });
}
