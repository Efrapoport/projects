import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAllPipelineEntries, updatePipelineStage } from "@/lib/pipeline-store";
import type { PipelineStage } from "@/lib/pipeline-types";

const VALID_STAGES: PipelineStage[] = [
  "new",
  "linkedin_requested",
  "outreach_sent",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
];

export async function GET() {
  try {
    const data = getAllPipelineEntries();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.name) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in with Google." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { leadId, stage, note } = body as {
      leadId?: string;
      stage?: string;
      note?: string;
    };

    if (!leadId || typeof leadId !== "string") {
      return NextResponse.json(
        { error: "leadId is required" },
        { status: 400 }
      );
    }

    if (!stage || !VALID_STAGES.includes(stage as PipelineStage)) {
      return NextResponse.json(
        { error: `Invalid stage. Must be one of: ${VALID_STAGES.join(", ")}` },
        { status: 400 }
      );
    }

    const entry = updatePipelineStage(
      leadId,
      stage as PipelineStage,
      { name: session.user.name, email: session.user.email },
      note
    );

    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
