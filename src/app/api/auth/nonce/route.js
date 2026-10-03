import { NextResponse } from "next/server";
import { getOrCreateNonce } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
    }
    const nonce = await getOrCreateNonce(wallet);
    return NextResponse.json({ nonce });
  } catch (error) {
    console.error("Nonce error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
