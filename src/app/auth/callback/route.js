import { NextResponse } from "next/server";
import { getServerClient } from "@/utils/supabase/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-site relative paths (no open redirects)
  const rawNext = searchParams.get("next") || "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (code) {
    const supabase = await getServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Supabase code exchange error:", error);
  }

  // Return the user to an error page or home with an alert
  return NextResponse.redirect(`${origin}/?auth_error=true`);
}
