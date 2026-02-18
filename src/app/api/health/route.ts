import { NextResponse } from "next/server";
import { checkSourceHealth } from "@/lib/scraper";

export async function GET() {
  const result = await checkSourceHealth();

  const okCount = result.sources.filter((s) => s.status === "ok").length;
  const totalCount = result.sources.filter((s) => s.status !== "skipped").length;

  return NextResponse.json(
    {
      ...result,
      summary: {
        healthy: okCount,
        total: totalCount,
        allHealthy: okCount === totalCount,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
      },
    }
  );
}
