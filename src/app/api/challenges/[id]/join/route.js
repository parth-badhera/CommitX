import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isParticipantOnChain } from "@/lib/chainSync";
import { ensureChallengeRecord, isTxHash } from "@/lib/challengeRecord";
import { defaultName } from "@/lib/identity";

export const dynamic = "force-dynamic";

/**
 * Records an enrolment in the DB. The contract is the only authority on who
 * joined, so the wallet must already be a participant on-chain — this keeps
 * the DB list identical to the contract's and settlement can't be blocked.
 */
export async function POST(request, { params }) {
  try {
    const { walletAddress, txHash, inviteToken } = await request.json();
    if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: "A valid wallet address is required" }, { status: 400 });
    }
    const wallet = walletAddress.toLowerCase();

    const id = params.id;
    let challenge = await prisma.challenge.findFirst({
      where: /^\d+$/.test(id) ? { OR: [{ id }, { contractChallengeId: Number(id) }] } : { id },
      include: { invitations: true },
    });
    if (!challenge && /^\d+$/.test(id)) {
      await ensureChallengeRecord(Number(id));
      challenge = await prisma.challenge.findUnique({
        where: { contractChallengeId: Number(id) },
        include: { invitations: true },
      });
    }
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    if (!(await isParticipantOnChain(challenge.contractChallengeId, wallet))) {
      return NextResponse.json(
        { error: "This wallet hasn't joined on-chain yet. Wait for the transaction to confirm and try again." },
        { status: 409 }
      );
    }

    await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: {},
      create: { walletAddress: wallet, username: defaultName(wallet) },
    });

    const participant = await prisma.participant.upsert({
      where: { challengeId_walletAddress: { challengeId: challenge.id, walletAddress: wallet } },
      update: isTxHash(txHash) ? { joinedTxHash: txHash } : {},
      create: {
        challengeId: challenge.id,
        walletAddress: wallet,
        joinedTxHash: isTxHash(txHash) ? txHash : "on-chain-sync",
      },
    });

    // Mark the matching invitation as accepted
    if (challenge.isPrivate) {
      const invite =
        challenge.invitations.find((inv) => inv.walletAddress?.toLowerCase() === wallet) ||
        (inviteToken && challenge.invitations.find((inv) => inv.inviteToken === inviteToken && !inv.walletAddress));
      if (invite && invite.walletAddress) {
        await prisma.invitation.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } }).catch(() => {});
      }
    }

    if (isTxHash(txHash)) {
      await prisma.transaction
        .upsert({
          where: { txHash },
          update: {},
          create: {
            challengeId: challenge.id,
            walletAddress: wallet,
            txHash,
            type: "JOIN",
            status: "CONFIRMED",
            amountWei: challenge.stakeAmountWei,
          },
        })
        .catch(() => {});
    }

    return NextResponse.json({ success: true, participant });
  } catch (error) {
    console.error("Join challenge error:", error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
