import { NextRequest, NextResponse } from "next/server";
import { getAllPipelineEntries, updatePipelineStage } from "@/lib/pipeline-store";
import { addToBlocklist } from "@/lib/feedback-store";
import type { PipelineStage } from "@/lib/pipeline-types";
import { AUTO_BLOCK_REASONS, type IrrelevantReason } from "@/lib/pipeline-types";

const VALID_STAGES: PipelineStage[] = [
  "new",
  "linkedin_requested",
  "outreach_sent",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
  "irrelevant",
];

export async function GET() {
  try {
    const data = await getAllPipelineEntries();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, stage, note, user, companyName } = body as {
      leadId?: string;
      stage?: string;
      note?: string;
      user?: { name?: string; email?: string };
      companyName?: string;
    };

    if (!user?.name || !user?.email) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

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

    const entry = await updatePipelineStage(
      leadId,
      stage as PipelineStage,
      { name: user.name, email: user.email },
      note
    );

    // Auto-block company from future scrapes when marked irrelevant
    // with a blocking reason (e.g. "Not a real company")
    if (stage === "irrelevant" && note && companyName) {
      const isBlockingReason = AUTO_BLOCK_REASONS.some((r) => note.startsWith(r));
      if (isBlockingReason) {
        await addToBlocklist(companyName, note, { name: user.name, email: user.email });
      }
    }

    return NextResponse.json(entry);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
