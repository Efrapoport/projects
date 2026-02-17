import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { applyFilters } from "@/lib/filters";
import { Filters, DEFAULT_FILTERS, Timeframe, SignalSource } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const timeframe = (searchParams.get("timeframe") as Timeframe) || DEFAULT_FILTERS.timeframe;
    const companySizeMin = parseInt(searchParams.get("companySizeMin") || String(DEFAULT_FILTERS.companySizeMin), 10);
    const companySizeMax = parseInt(searchParams.get("companySizeMax") || String(DEFAULT_FILTERS.companySizeMax), 10);
    const industriesParam = searchParams.get("industries");
    const industries = industriesParam ? industriesParam.split(",") : [];
    const minScore = parseInt(searchParams.get("minScore") || "0", 10);
    const sourcesParam = searchParams.get("sources");
    const sources = sourcesParam ? (sourcesParam.split(",") as SignalSource[]) : [];
    const forceRefresh = searchParams.get("refresh") === "true";

    const filters: Filters = {
      timeframe,
      companySizeMin,
      companySizeMax,
      industries,
      minScore,
      sources,
    };

    // scrapeJobs() tries live APIs first, falls back to bundled real data
    let scrapedJobs: Awaited<ReturnType<typeof scrapeJobs>> = [];
    let dataSource: "live" | "bundled" = "live";

    try {
      scrapedJobs = await Promise.race([
        scrapeJobs(forceRefresh),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scraper timeout after 20s")), 20000)
        ),
      ]);
    } catch (err) {
      console.warn("[api/leads] Scraper failed or timed out:", err);
    }

    // Build leads from whatever we got
    const allLeads = scrapedJobs.length > 0 ? buildLeadsFromJobs(scrapedJobs) : [];
    const availableIndustries = getIndustriesFromLeads(allLeads);

    // Detect if data came from bundled fallback (scraper logs this)
    if (scrapedJobs.length > 0) {
      // Check if any job has a bundled source indicator
      const hasBundledOnly = scrapedJobs.every(
        (j) => !["remoteok", "arbeitnow", "jobicy", "himalayas", "indeed"].includes(j.source) === false
      );
      dataSource = hasBundledOnly ? "live" : "bundled";
    }

    console.log(`[api/leads] Serving ${allLeads.length} leads (${dataSource}) from ${scrapedJobs.length} scraped jobs`);

    const filtered = applyFilters(allLeads, filters);

    return NextResponse.json(
      {
        leads: filtered,
        total: allLeads.length,
        filtered: filtered.length,
        industries: availableIndustries,
        dataSource,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (err) {
    console.error("[api/leads] Unhandled error:", err);
    return NextResponse.json(
      {
        leads: [],
        total: 0,
        filtered: 0,
        industries: [],
        dataSource: "error",
        error: String(err),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
