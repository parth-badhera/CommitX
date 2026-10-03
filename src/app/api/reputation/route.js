import { NextResponse } from "next/server";
import { getReputations } from "@/lib/reputation";

export const dynamic = "force-dynamic";

/** GET /api/reputation?wallets=0xa,0xb → { reputations: { [wallet]: {...} } } */
export async function GET(request) {
  const wallets = (new URL(request.url).searchParams.get("wallets") || "").split(",").slice(0, 100);
  return NextResponse.json({ reputations: await getReputations(wallets) });
}
