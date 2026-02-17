import { NextRequest, NextResponse } from "next/server";
import { getLogEntries, getLogStats, LogLevel } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const level = searchParams.get("level") as LogLevel | null;
  const tag = searchParams.get("tag") || undefined;
  const limit = searchParams.get("limit")
    ? parseInt(searchParams.get("limit")!, 10)
    : 200;

  const entries = getLogEntries({
    level: level || undefined,
    tag,
    limit,
  });

  const stats = getLogStats();

  return NextResponse.json(
    { entries, stats },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
