import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { supabaseUrl, supabaseKey, isSupabaseConfigured } from "./config";

/**
 * Refreshes the Supabase auth session — but only for visitors who actually
 * have one. Everyone else skips the network round-trip entirely.
 */
export const updateSession = async (request) => {
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!isSupabaseConfigured || !hasAuthCookie) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch (err) {
    console.warn("[middleware] Supabase session refresh failed:", err.message);
  }
  return response;
};
