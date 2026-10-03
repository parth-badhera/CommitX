import { NextResponse } from "next/server";
import { getServerClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user: supabaseUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !supabaseUser) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const email = supabaseUser.email;
    const name =
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      email?.split("@")[0] ||
      "Google User";
    const avatar =
      supabaseUser.user_metadata?.avatar_url ||
      supabaseUser.user_metadata?.picture ||
      `gen:${String(email).replace(/[^a-z0-9]/gi, "").slice(0, 40).toLowerCase()}`;

    // Find or create in local Prisma database
    let dbUser = await prisma.user.findFirst({
      where: {
        OR: [{ supabaseId: supabaseUser.id }, { email: email }],
      },
    });

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email,
          name,
          username: name,
          avatar,
          image: avatar,
        },
      });
    } else {
      // Update with any updated info if missing
      dbUser = await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          supabaseId: supabaseUser.id,
          name: dbUser.name || name,
          avatar: dbUser.avatar || avatar,
          image: dbUser.image || avatar,
        },
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: dbUser.id,
        supabaseId: dbUser.supabaseId,
        email: dbUser.email,
        name: dbUser.name,
        username: dbUser.username,
        avatar: dbUser.avatar,
        walletAddress: dbUser.walletAddress,
        createdAt: dbUser.createdAt,
      },
    });
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
