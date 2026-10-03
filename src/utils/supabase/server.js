import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseUrl, supabaseKey, isSupabaseConfigured, stubClient } from "./config";

export const createClient = (cookieStore) => {
  if (!isSupabaseConfigured) return stubClient;
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — middleware refreshes the session instead.
        }
      },
    },
  });
};

export const getServerClient = async () => createClient(await cookies());
