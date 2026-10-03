const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const { requireWallet } = require("@/lib/session");

export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  try {
    const inviteId = params.id;
    const body = await request.json();
    const { walletAddress } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "walletAddress required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: inviteId },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    // Only wallet-specific invitations can be declined, and only by that wallet
    if (!invitation.walletAddress || invitation.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return NextResponse.json({ error: "This invitation isn't addressed to your wallet" }, { status: 403 });
    }
    const auth = requireWallet(request, walletAddress, NextResponse);
    if (auth.response) return auth.response;

    const updated = await prisma.invitation.update({
      where: { id: inviteId },
      data: { status: "DECLINED" },
    });

    return NextResponse.json({ success: true, invitation: updated });
  } catch (error) {
    console.error("Error declining invitation:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
