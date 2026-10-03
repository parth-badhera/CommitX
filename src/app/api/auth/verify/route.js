import { NextResponse } from "next/server";
import { verifyWalletSignature } from "@/lib/auth";
import { createSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { walletAddress, signature } = await request.json();
    if (!walletAddress || !signature) {
      return NextResponse.json({ error: "Wallet address and signature are required" }, { status: 400 });
    }

    const session = await verifyWalletSignature(walletAddress, signature);
    const res = NextResponse.json({ success: true, session });
    const cookie = createSessionCookie(session.walletAddress);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (error) {
    console.error("Signature verification error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
