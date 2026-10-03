import { NextResponse } from "next/server";
import { COOKIE, getSessionWallet } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return NextResponse.json({ wallet: getSessionWallet(request) });
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
