import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireWallet, getSessionWallet } from "@/lib/session";
import { assertNotSuspended } from "@/lib/reputation";
import { defaultName } from "@/lib/identity";

export const dynamic = "force-dynamic";

// Small grace so a proof sent seconds before the deadline isn't lost to latency
const GRACE_MS = 5 * 60 * 1000;

const isHttpUrl = (s) => {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

export async function POST(request) {
  try {
    const { periodId, participantAddress, contentUri, note } = await request.json();

    if (!periodId || !participantAddress) {
      return NextResponse.json({ error: "periodId and participantAddress are required" }, { status: 400 });
    }
    if (!contentUri || !isHttpUrl(contentUri)) {
      return NextResponse.json({ error: "Add a link (starting with https://) that shows your proof." }, { status: 400 });
    }

    const auth = requireWallet(request, participantAddress, NextResponse);
    if (auth.response) return auth.response;
    const wallet = auth.wallet;

    const period = await prisma.period.findUnique({
      where: { id: periodId },
      include: { challenge: { include: { participants: true } } },
    });
    if (!period) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 });
    }

    const { challenge } = period;
    const me = challenge.participants.find((p) => p.walletAddress.toLowerCase() === wallet);
    if (!me) {
      return NextResponse.json({ error: "Only participants of this challenge can submit proof." }, { status: 403 });
    }
    if (me.disqualifiedAt) {
      return NextResponse.json(
        { error: "You were removed from this challenge by the admin, so you can't submit proof for it." },
        { status: 403 }
      );
    }
    try {
      await assertNotSuspended(wallet);
    } catch (err) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status || 403 });
    }
    if (challenge.status === "FINALIZED" || challenge.status === "CANCELLED") {
      return NextResponse.json({ error: "This challenge is closed — proofs can no longer be submitted." }, { status: 400 });
    }

    const now = Date.now();
    if (now < new Date(period.startTime).getTime()) {
      return NextResponse.json({ error: `Period ${period.periodNumber} hasn't started yet.` }, { status: 400 });
    }
    if (now > new Date(period.endTime).getTime() + GRACE_MS) {
      return NextResponse.json({ error: `Period ${period.periodNumber} has ended — its deadline has passed.` }, { status: 400 });
    }

    const existing = await prisma.proof.findFirst({ where: { periodId, participantAddress: wallet } });
    if (existing) {
      return NextResponse.json({ error: `You've already submitted proof for period ${period.periodNumber}.` }, { status: 409 });
    }

    const cleanNote = String(note || "").slice(0, 1000);
    const contentHash = crypto.createHash("sha256").update(`${contentUri}\n${cleanNote}`).digest("hex");

    await prisma.user.upsert({
      where: { walletAddress: wallet },
      update: {},
      create: { walletAddress: wallet, username: defaultName(wallet) },
    });

    const proof = await prisma.proof.create({
      data: {
        periodId,
        participantAddress: wallet,
        contentUri: contentUri.slice(0, 2000),
        contentHash,
        proofType: "link",
        note: cleanNote,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, proof });
  } catch (error) {
    console.error("Submit proof error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const viewer = getSessionWallet(request);

    const where = {};
    if (status && status !== "all") where.status = status;

    // Private challenges' proofs are visible to their participants only
    where.period = {
      challenge: viewer
        ? { OR: [{ isPrivate: false }, { participants: { some: { walletAddress: viewer } } }] }
        : { isPrivate: false },
    };

    const proofs = await prisma.proof.findMany({
      where,
      include: {
        user: { select: { username: true, avatar: true } },
        period: {
          select: {
            periodNumber: true,
            challenge: {
              select: {
                id: true,
                contractChallengeId: true,
                name: true,
                status: true,
                participants: { select: { walletAddress: true } },
              },
            },
          },
        },
        verifications: { select: { verifierAddress: true, decision: true, voided: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ proofs });
  } catch (error) {
    console.error("List proofs error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
