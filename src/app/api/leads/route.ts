import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { applyFilters } from "@/lib/filters";
import { Filters, DEFAULT_FILTERS, Timeframe, SignalSource } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/leads");

export async function GET(request: NextRequest) {
  const requestTimer = log.time("request");

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

    log.info("Request received", {
      timeframe,
      forceRefresh,
      industries: industries.length > 0 ? industries : undefined,
      minScore: minScore > 0 ? minScore : undefined,
    });

    // scrapeJobs() tries live APIs first, falls back to bundled real data
    let scrapedJobs: Awaited<ReturnType<typeof scrapeJobs>> = [];
    let dataSource: "live" | "bundled" = "live";

    try {
      const scrapeTimer = log.time("scrape");
      scrapedJobs = await Promise.race([
        scrapeJobs(forceRefresh),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scraper timeout after 20s")), 20000)
        ),
      ]);
      scrapeTimer.end("Scraping complete", { jobs: scrapedJobs.length });
    } catch (err) {
      log.warn("Scraper failed or timed out", { error: String(err) });
    }

    // Build leads from whatever we got (now async — includes URL validation)
    const buildTimer = log.time("build-leads");
    const allLeads = scrapedJobs.length > 0 ? await buildLeadsFromJobs(scrapedJobs) : [];
    buildTimer.end("Leads built", { count: allLeads.length });

    const availableIndustries = getIndustriesFromLeads(allLeads);

    // Detect if data came from bundled fallback
    if (scrapedJobs.length > 0) {
      const hasBundledOnly = scrapedJobs.every(
        (j) => !["remoteok", "arbeitnow", "jobicy", "himalayas", "indeed", "earnbetter"].includes(j.source) === false
      );
      dataSource = hasBundledOnly ? "live" : "bundled";
    }

    const filtered = applyFilters(allLeads, filters);

    // Strip signal.raw (full JD) from response — client only needs the extracted snippets
    const leadsForClient = filtered.map((lead) => ({
      ...lead,
      signals: lead.signals.map(({ raw, ...rest }) => rest),
    }));

    requestTimer.end("Response ready", {
      total: allLeads.length,
      filtered: filtered.length,
      dataSource,
    });

    return NextResponse.json(
      {
        leads: leadsForClient,
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
    log.error("Unhandled error", { error: String(err), stack: (err as Error)?.stack });
    requestTimer.end("Request failed with error");

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
