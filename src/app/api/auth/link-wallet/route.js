import { NextResponse } from "next/server";
import { getServerClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";
import { ethers } from "ethers";
import { createSessionCookie } from "@/lib/session";
import { defaultName } from "@/lib/identity";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser();

    // Check if session exists (or accept userId from request in demo mode)
    const body = await request.json();
    const { walletAddress, signature, nonce, demoUserId } = body;

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    const normalizedAddress = walletAddress.toLowerCase();

    // Ownership proof is mandatory: the signed message must name this wallet and be recent
    if (!signature || !nonce) {
      return NextResponse.json({ error: "Please sign the message in MetaMask to link your wallet." }, { status: 400 });
    }
    const issued = Date.parse(String(nonce).split(" at ").pop());
    if (!String(nonce).toLowerCase().includes(normalizedAddress) || !issued || Math.abs(Date.now() - issued) > 10 * 60 * 1000) {
      return NextResponse.json({ error: "This link request expired. Please try again." }, { status: 400 });
    }
    try {
      if (ethers.verifyMessage(nonce, signature).toLowerCase() !== normalizedAddress) {
        return NextResponse.json({ error: "The signature doesn't match this wallet." }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    let targetUserId = null;

    if (supabaseUser) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email }],
        },
      });
      if (dbUser) targetUserId = dbUser.id;
    } else if (demoUserId) {
      // Demo accounts only — never an arbitrary real user id
      const demo = await prisma.user.findUnique({ where: { id: demoUserId } });
      if (demo?.supabaseId?.startsWith("demo-user-")) targetUserId = demo.id;
    }

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Must be signed in with Google to link a wallet" },
        { status: 401 }
      );
    }

    // Check if another user currently holds this wallet address
    const existingWithWallet = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (existingWithWallet && existingWithWallet.id !== targetUserId) {
      // Re-assign the wallet to this active Google account
      await prisma.user.update({
        where: { id: existingWithWallet.id },
        data: { walletAddress: null },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        walletAddress: normalizedAddress,
        username: (await prisma.user.findUnique({ where: { id: targetUserId } }))?.name || defaultName(normalizedAddress),
      },
    });

    const res = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        avatar: updatedUser.avatar,
        walletAddress: updatedUser.walletAddress,
      },
    });
    // The signature above proves wallet ownership — start a wallet session too
    const cookie = createSessionCookie(normalizedAddress);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (err) {
    console.error("POST /api/auth/link-wallet error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
