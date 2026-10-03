import { updateSession } from "@/utils/supabase/middleware";

export async function middleware(request) {
  return updateSession(request);
}

export const config = {
  // Pages and auth routes only — data APIs and static files skip the session refresh
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/(?!auth)|.*\.(?:svg|png|jpg|jpeg|gif|webp|pdf|ico|txt|xml)$).*)",
  ],
};
