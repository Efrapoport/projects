import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/leads");

export async function GET(request: NextRequest) {
  const requestTimer = log.time("request");

  try {
    const { searchParams } = request.nextUrl;
    const forceRefresh = searchParams.get("refresh") === "true";

    log.info("Request received", { forceRefresh });

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

    // Strip signal.raw (full JD) from response — client only needs the extracted snippets
    // Return ALL leads unfiltered — client handles filtering for instant UI response
    const leadsForClient = allLeads.map((lead) => ({
      ...lead,
      signals: lead.signals.map(({ raw, ...rest }) => rest),
    }));

    // Build source breakdown from scraped jobs
    const sourceBreakdown: Record<string, number> = {};
    for (const job of scrapedJobs) {
      sourceBreakdown[job.source] = (sourceBreakdown[job.source] || 0) + 1;
    }

    requestTimer.end("Response ready", {
      total: allLeads.length,
      dataSource,
      sourceBreakdown,
    });

    return NextResponse.json(
      {
        leads: leadsForClient,
        total: allLeads.length,
        industries: availableIndustries,
        dataSource,
        sourceBreakdown,
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
