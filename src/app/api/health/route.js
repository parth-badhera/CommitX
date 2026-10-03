import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Liveness/readiness probe for hosting platforms
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    return NextResponse.json({ ok: false, db: "down", error: err.message }, { status: 503 });
  }
}
