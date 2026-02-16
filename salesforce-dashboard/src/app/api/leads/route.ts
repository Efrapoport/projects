import { NextRequest, NextResponse } from "next/server";
import { getAllLeads, getAvailableIndustries } from "@/lib/mock-data";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { applyFilters } from "@/lib/filters";
import { Filters, DEFAULT_FILTERS, Timeframe, SignalSource } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Parse filter params
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

  // Try scraping real data first, fall back to mock data
  let allLeads;
  let availableIndustries;
  let dataSource: "live" | "mock";

  try {
    const scrapedJobs = await scrapeJobs(forceRefresh);

    if (scrapedJobs.length > 0) {
      allLeads = buildLeadsFromJobs(scrapedJobs);
      availableIndustries = getIndustriesFromLeads(allLeads);
      dataSource = "live";
      console.log(`[api/leads] Serving ${allLeads.length} live leads from ${scrapedJobs.length} scraped jobs`);
    } else {
      throw new Error("No scraped jobs found");
    }
  } catch (error) {
    console.log("[api/leads] Scraping failed or returned no results, falling back to mock data:", error);
    allLeads = getAllLeads();
    availableIndustries = getAvailableIndustries();
    dataSource = "mock";
  }

  const filtered = applyFilters(allLeads, filters);

  return NextResponse.json({
    leads: filtered,
    total: allLeads.length,
    filtered: filtered.length,
    industries: availableIndustries,
    dataSource,
  });
}
