const { NextResponse } = require("next/server");
const { prisma } = require("@/lib/prisma");
const { syncChallengesWithChain } = require("@/lib/chainSync");
const { ensureChallengeRecord, redactInvitations } = require("@/lib/challengeRecord");
const { getSessionWallet } = require("@/lib/session");

export const dynamic = "force-dynamic";

// Never expose emails, nonces or ids of other users
const PUBLIC_USER = { username: true, avatar: true };

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const visibility = searchParams.get("visibility"); // Public, Private, All
    const userAddress = searchParams.get("userAddress");

    const where = {};

    // Visibility filtering
    if (visibility === "Public") {
      where.isPrivate = false;
    } else if (visibility === "Private") {
      where.isPrivate = true;
      if (userAddress) {
        const norm = userAddress.toLowerCase();
        where.OR = [
          { creatorAddress: norm },
          { participants: { some: { walletAddress: norm } } },
          { invitations: { some: { walletAddress: norm } } },
        ];
      }
    } else if (!visibility || visibility === "All") {
      // By default for public explore: only public challenges
      // unless userAddress requested their created/joined challenges
      if (userAddress) {
        const norm = userAddress.toLowerCase();
        where.OR = [
          { isPrivate: false },
          { creatorAddress: norm },
          { participants: { some: { walletAddress: norm } } },
        ];
      } else {
        where.isPrivate = false;
      }
    }

    if (category && category !== "All") {
      where.category = category;
    }
    if (status && status !== "All") {
      where.status = status;
    }
    if (search) {
      // SQLite's contains is already case-insensitive; Postgres needs mode: "insensitive"
      const ci = /^postgres/.test(process.env.DATABASE_URL || "") ? { mode: "insensitive" } : {};
      const searchCondition = [
        { name: { contains: search, ...ci } },
        { description: { contains: search, ...ci } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    // ?withProgress=1 adds periods, proofs and votes (used by the dashboard's "what to do next")
    const withProgress = searchParams.get("withProgress") === "1";
    const challenges = await prisma.challenge.findMany({
      where,
      include: {
        participants: { include: { user: { select: PUBLIC_USER } } },
        invitations: true,
        _count: { select: { periods: true } },
        ...(withProgress && {
          periods: {
            orderBy: { periodNumber: "asc" },
            select: {
              id: true,
              periodNumber: true,
              startTime: true,
              endTime: true,
              proofs: {
                select: {
                  id: true,
                  participantAddress: true,
                  status: true,
                  verifications: { select: { verifierAddress: true } },
                },
              },
            },
          },
        }),
      },
      orderBy: { createdAt: "desc" },
    });

    await syncChallengesWithChain(challenges);

    const viewer = getSessionWallet(request);
    return NextResponse.json({ challenges: challenges.map((c) => redactInvitations(c, viewer)) });
  } catch (error) {
    console.error("List challenges error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const id = Number(body.contractChallengeId);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "A valid contractChallengeId is required" }, { status: 400 });
    }
    if (!body.name || !String(body.name).trim()) {
      return NextResponse.json({ error: "Challenge name is required" }, { status: 400 });
    }

    // Economic fields are read from the contract inside ensureChallengeRecord
    const { challenge, created } = await ensureChallengeRecord(id, body);
    return NextResponse.json({ success: true, challenge, created }, { status: created ? 201 : 200 });
  } catch (error) {
    console.error("Create challenge error:", error);
    return NextResponse.json({ error: error.message }, { status: error.status || 500 });
  }
}
