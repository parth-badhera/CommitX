const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const { requireWallet } = require("@/lib/session");

export const dynamic = "force-dynamic";

export async function DELETE(request, { params }) {
  try {
    const { id, inviteId } = params;
    const { searchParams } = new URL(request.url);
    const creatorAddress = searchParams.get("creatorAddress");

    if (!creatorAddress) {
      return NextResponse.json({ error: "Creator address is required" }, { status: 400 });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id: inviteId },
      include: { challenge: true },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.challenge.creatorAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
      return NextResponse.json({ error: "Only challenge creator can revoke invitations" }, { status: 403 });
    }
    const auth = requireWallet(request, invitation.challenge.creatorAddress, NextResponse);
    if (auth.response) return auth.response;
    if (new Date() >= new Date(invitation.challenge.startTime)) {
      return NextResponse.json({ error: "The challenge has started — invitations can no longer be revoked." }, { status: 400 });
    }

    const updated = await prisma.invitation.update({
      where: { id: inviteId },
      data: { status: "REVOKED" },
    });

    return NextResponse.json({ success: true, invitation: updated });
  } catch (error) {
    console.error("Revoke invitation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
