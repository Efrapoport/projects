import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { getAllLeads, getAvailableIndustries } from "@/lib/sample-data";
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

    let allLeads;
    let availableIndustries;
    let dataSource: "live" | "demo";

    // Try scraping real data first, with a safety timeout
    let scrapedJobs: Awaited<ReturnType<typeof scrapeJobs>> = [];
    try {
      scrapedJobs = await Promise.race([
        scrapeJobs(forceRefresh),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scraper timeout")), 20000)
        ),
      ]);
    } catch (err) {
      console.warn("[api/leads] Scraper failed or timed out, falling back to sample data:", err);
    }

    if (scrapedJobs.length > 0) {
      allLeads = buildLeadsFromJobs(scrapedJobs);
      availableIndustries = getIndustriesFromLeads(allLeads);
      dataSource = "live";
      console.log(`[api/leads] Serving ${allLeads.length} live leads from ${scrapedJobs.length} scraped jobs`);
    } else {
      allLeads = getAllLeads();
      availableIndustries = getAvailableIndustries();
      dataSource = "demo";
      console.log(`[api/leads] Serving ${allLeads.length} sample leads (demo mode)`);
    }

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
    // Last-resort fallback: return sample data even if something unexpected broke
    const allLeads = getAllLeads();
    const filtered = applyFilters(allLeads, {
      ...DEFAULT_FILTERS,
    });
    return NextResponse.json(
      {
        leads: filtered,
        total: allLeads.length,
        filtered: filtered.length,
        industries: getAvailableIndustries(),
        dataSource: "demo" as const,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  }
}
