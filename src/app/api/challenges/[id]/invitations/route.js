const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const crypto = require("crypto");
const { requireWallet } = require("@/lib/session");

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  try {
    const id = params.id;
    const isNum = !isNaN(Number(id));

    const challenge = await prisma.challenge.findFirst({
      where: isNum
        ? { OR: [{ id }, { contractChallengeId: Number(id) }] }
        : { id },
      include: {
        invitations: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    const auth = requireWallet(request, challenge.creatorAddress, NextResponse);
    if (auth.response) return auth.response;

    return NextResponse.json({
      invitations: challenge.invitations,
      isPrivate: challenge.isPrivate,
    });
  } catch (error) {
    console.error("Get invitations error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const id = params.id;
    const isNum = !isNaN(Number(id));
    const body = await request.json();
    const { creatorAddress, walletAddress, generateLink } = body;

    if (!creatorAddress) {
      return NextResponse.json({ error: "Creator wallet address required" }, { status: 400 });
    }

    const challenge = await prisma.challenge.findFirst({
      where: isNum
        ? { OR: [{ id }, { contractChallengeId: Number(id) }] }
        : { id },
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (challenge.creatorAddress.toLowerCase() !== creatorAddress.toLowerCase()) {
      return NextResponse.json({ error: "Only challenge creator can manage invitations" }, { status: 403 });
    }
    const auth = requireWallet(request, challenge.creatorAddress, NextResponse);
    if (auth.response) return auth.response;

    // Check if challenge already started
    if (new Date() >= new Date(challenge.startTime)) {
      return NextResponse.json({ error: "Cannot invite after challenge has started" }, { status: 400 });
    }

    let invitation;

    if (generateLink) {
      const inviteToken = `invite-${challenge.contractChallengeId}-${crypto.randomBytes(8).toString("hex")}`;
      invitation = await prisma.invitation.create({
        data: {
          challengeId: challenge.id,
          inviteToken,
          status: "PENDING",
          invitedBy: creatorAddress.toLowerCase(),
          expiresAt: challenge.startTime,
        },
      });
    } else if (walletAddress) {
      const norm = walletAddress.trim().toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(norm)) {
        return NextResponse.json({ error: "Invalid Ethereum wallet address format" }, { status: 400 });
      }

      invitation = await prisma.invitation.upsert({
        where: {
          challengeId_walletAddress: {
            challengeId: challenge.id,
            walletAddress: norm,
          },
        },
        update: {
          status: "PENDING",
          expiresAt: challenge.startTime,
        },
        create: {
          challengeId: challenge.id,
          walletAddress: norm,
          inviteToken: `invite-${crypto.randomBytes(12).toString("hex")}`,
          status: "PENDING",
          invitedBy: creatorAddress.toLowerCase(),
          expiresAt: challenge.startTime,
        },
      });
    } else {
      return NextResponse.json({ error: "Must specify walletAddress or generateLink" }, { status: 400 });
    }

    return NextResponse.json({ success: true, invitation });
  } catch (error) {
    console.error("Create invitation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
