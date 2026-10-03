import { NextResponse } from "next/server";
import { generateSettlementAttestation } from "@/lib/attestation";

export const dynamic = "force-dynamic";

// Anyone may request the attestation: it only encodes peer-verified results,
// and the contract alone decides whether it is valid.
export async function POST(request, { params }) {
  try {
    const attestation = await generateSettlementAttestation(params.id);
    return NextResponse.json({ success: true, attestation });
  } catch (error) {
    console.error("Attestation generation error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
