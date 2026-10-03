import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireWallet } from "@/lib/session";
import { defaultName, displayName, isValidAvatar } from "@/lib/identity";

export const dynamic = "force-dynamic";

const isWallet = (w) => /^0x[0-9a-fA-F]{40}$/.test(w || "");
const shape = (wallet, u) => ({
  wallet,
  name: displayName(u, wallet),
  avatar: u?.avatar || null,
  hasCustomName: Boolean(u?.username && u.username !== defaultName(wallet) && !/^\w+_[0-9a-f]{4}$/i.test(u.username)),
});

/** Public profile (display name + avatar) for a wallet. */
export async function GET(request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.toLowerCase();
  if (!isWallet(wallet)) return NextResponse.json({ error: "A valid wallet is required" }, { status: 400 });
  const user = await prisma.user.findUnique({
    where: { walletAddress: wallet },
    select: { username: true, name: true, avatar: true },
  });
  return NextResponse.json({ profile: shape(wallet, user) });
}

/** Update your own display name and/or avatar (wallet session required). */
export async function POST(request) {
  try {
    const { walletAddress, name, avatar } = await request.json();
    if (!isWallet(walletAddress)) return NextResponse.json({ error: "A valid wallet is required" }, { status: 400 });
    const auth = requireWallet(request, walletAddress, NextResponse);
    if (auth.response) return auth.response;

    const data = {};
    if (name !== undefined) {
      const clean = String(name).trim().replace(/\s+/g, " ");
      if (clean.length < 2 || clean.length > 24 || !/^[\p{L}\p{N} ._'-]+$/u.test(clean)) {
        return NextResponse.json({ error: "Use 2–24 letters, numbers or spaces for your name." }, { status: 400 });
      }
      data.username = clean;
    }
    if (avatar !== undefined) {
      if (!isValidAvatar(avatar)) return NextResponse.json({ error: "That avatar isn't valid." }, { status: 400 });
      data.avatar = avatar;
    }

    const user = await prisma.user.upsert({
      where: { walletAddress: auth.wallet },
      update: data,
      create: { walletAddress: auth.wallet, username: data.username || defaultName(auth.wallet), avatar: data.avatar },
      select: { username: true, name: true, avatar: true },
    });
    return NextResponse.json({ success: true, profile: shape(auth.wallet, user) });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
