const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const { getAttestorWallet, eip712Domain } = require("@/lib/attestor");
const { assertNotSuspended } = require("@/lib/reputation");

export const dynamic = "force-dynamic";

const invitationTypes = {
  Invitation: [
    { name: "challengeId", type: "uint256" },
    { name: "participant", type: "address" },
  ],
};

export async function POST(request, { params }) {
  try {
    const id = params.id;
    const isNum = !isNaN(Number(id));
    const { walletAddress, inviteToken } = await request.json();

    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }

    const normalized = walletAddress.toLowerCase();
    try {
      await assertNotSuspended(normalized);
    } catch (err) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status || 403 });
    }

    const challenge = await prisma.challenge.findFirst({
      where: isNum
        ? { OR: [{ id }, { contractChallengeId: Number(id) }] }
        : { id },
      include: {
        invitations: true,
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (!challenge.isPrivate) {
      return NextResponse.json({
        isPrivate: false,
        authorized: true,
      });
    }

    // Verify invitation
    const now = new Date();
    const isCreator = normalized === challenge.creatorAddress.toLowerCase();
    let isAuthorized = isCreator;

    if (!isAuthorized) {
      // Check direct wallet invite
      const direct = challenge.invitations.find(
        (inv) =>
          inv.walletAddress &&
          inv.walletAddress.toLowerCase() === normalized &&
          inv.status !== "REVOKED" &&
          new Date(inv.expiresAt) > now
      );
      if (direct) isAuthorized = true;
    }

    if (!isAuthorized && inviteToken) {
      // Check link invite token
      const tokenInvite = challenge.invitations.find(
        (inv) =>
          inv.inviteToken === inviteToken &&
          inv.status !== "REVOKED" &&
          new Date(inv.expiresAt) > now
      );
      if (tokenInvite) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Not authorized. This private challenge requires an active invitation." },
        { status: 403 }
      );
    }

    // EIP-712 invitation signed by the protocol attestor
    const attestorWallet = getAttestorWallet();
    const domain = eip712Domain(challenge.contractChallengeId);

    const value = {
      challengeId: BigInt(challenge.contractChallengeId),
      participant: normalized,
    };

    const signature = await attestorWallet.signTypedData(domain, invitationTypes, value);

    return NextResponse.json({
      success: true,
      authorized: true,
      signature,
      contractChallengeId: challenge.contractChallengeId,
    });
  } catch (error) {
    console.error("Authorize join error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
