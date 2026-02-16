import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { applyFilters } from "@/lib/filters";
import { Filters, DEFAULT_FILTERS, Timeframe, SignalSource } from "@/lib/types";
import { writeFileSync, appendFileSync } from "fs";

const DEBUG_LOG = "/tmp/leads-api-debug.log";

function debugLog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    appendFileSync(DEBUG_LOG, line);
  } catch {
    // ignore write errors
  }
  console.log(msg);
}

export async function GET(request: NextRequest) {
  // Start fresh log on each request
  try {
    writeFileSync(DEBUG_LOG, `=== NEW REQUEST at ${new Date().toISOString()} ===\n`);
  } catch { /* ignore */ }

  debugLog(`[route] GET /api/leads called`);
  debugLog(`[route] Full URL: ${request.nextUrl.toString()}`);
  debugLog(`[route] Source file: src/app/api/leads/route.ts (NO mock-data import)`);

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

  debugLog(`[route] Calling scrapeJobs(forceRefresh=${forceRefresh})...`);
  const scrapedJobs = await scrapeJobs(forceRefresh);
  debugLog(`[route] scrapeJobs returned ${scrapedJobs.length} jobs`);

  if (scrapedJobs.length > 0) {
    debugLog(`[route] First 3 scraped jobs: ${JSON.stringify(scrapedJobs.slice(0, 3).map(j => ({ company: j.company, title: j.title, source: j.source })))}`);
  }

  const allLeads = buildLeadsFromJobs(scrapedJobs);
  debugLog(`[route] buildLeadsFromJobs produced ${allLeads.length} leads`);

  if (allLeads.length > 0) {
    debugLog(`[route] Lead companies: ${allLeads.map(l => l.company.name).join(", ")}`);
  }

  const availableIndustries = getIndustriesFromLeads(allLeads);
  const dataSource = scrapedJobs.length > 0 ? "live" : "no_results";

  debugLog(`[route] dataSource=${dataSource}, industries=${JSON.stringify(availableIndustries)}`);

  const filtered = applyFilters(allLeads, filters);
  debugLog(`[route] After filters: ${filtered.length} leads (from ${allLeads.length} total)`);

  const response = {
    leads: filtered,
    total: allLeads.length,
    filtered: filtered.length,
    industries: availableIndustries,
    dataSource,
  };

  debugLog(`[route] FINAL RESPONSE: total=${response.total}, filtered=${response.filtered}, dataSource=${response.dataSource}`);
  debugLog(`=== REQUEST COMPLETE ===`);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
      "Surrogate-Control": "no-store",
    },
  });
}
