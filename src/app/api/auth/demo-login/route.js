import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = body.email || "alex.rivera@gmail.com";
    const name = body.name || "Alex Rivera";
    const avatar =
      "gen:alexrivera";

    let dbUser = await prisma.user.findFirst({
      where: { email },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email,
          name,
          username: name,
          avatar,
          image: avatar,
          supabaseId: "demo-user-" + Date.now(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatar,
        walletAddress: dbUser.walletAddress,
        isDemo: true,
      },
    });
  } catch (err) {
    console.error("POST /api/auth/demo-login error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
