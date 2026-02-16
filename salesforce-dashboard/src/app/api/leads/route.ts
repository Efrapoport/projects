import { NextRequest, NextResponse } from "next/server";
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

  // Scrape real data from multiple job board APIs
  const scrapedJobs = await scrapeJobs(forceRefresh);
  const allLeads = buildLeadsFromJobs(scrapedJobs);
  const availableIndustries = getIndustriesFromLeads(allLeads);

  const dataSource = scrapedJobs.length > 0 ? "live" : "no_results";

  console.log(
    `[api/leads] Serving ${allLeads.length} leads from ${scrapedJobs.length} scraped jobs (source: ${dataSource})`
  );

  const filtered = applyFilters(allLeads, filters);

  return NextResponse.json({
    leads: filtered,
    total: allLeads.length,
    filtered: filtered.length,
    industries: availableIndustries,
    dataSource,
  });
}
