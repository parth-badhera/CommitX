import { NextResponse } from "next/server";
import { getServerClient } from "@/utils/supabase/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const supabase = await getServerClient();
    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    const body = await request.json().catch(() => ({}));
    const { demoUserId } = body;

    let targetUserId = null;

    if (supabaseUser) {
      const dbUser = await prisma.user.findFirst({
        where: {
          OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email }],
        },
      });
      if (dbUser) targetUserId = dbUser.id;
    } else if (demoUserId) {
      const demo = await prisma.user.findUnique({ where: { id: demoUserId } });
      if (demo?.supabaseId?.startsWith("demo-user-")) targetUserId = demo.id;
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { walletAddress: null },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("POST /api/auth/unlink-wallet error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
