import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs, getSerpApiQuotaStatus, getSourceFailures, loadBundledJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { getLastEnrichmentStats } from "@/lib/data-integrity";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/leads");

export const maxDuration = 30; // Allow up to 30s for live scraping on Vercel

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

    // If scraper returned nothing (timeout or all sources failed),
    // fall back to bundled data so the dashboard is never empty.
    if (scrapedJobs.length === 0) {
      scrapedJobs = loadBundledJobs();
      dataSource = "bundled";
      log.info("Using bundled fallback in API route", { count: scrapedJobs.length });
    }

    // Build leads from whatever we got (now async — includes URL validation).
    // Enrichment (URL validation, employee counts, contact lookup) can be
    // slow, so cap it at 8s.  If it times out, rebuild without enrichment
    // so we never exceed maxDuration and trigger a 504.
    const BUILD_TIMEOUT = 8000;
    const buildTimer = log.time("build-leads");
    let allLeads: Awaited<ReturnType<typeof buildLeadsFromJobs>> = [];
    if (scrapedJobs.length > 0) {
      try {
        allLeads = await Promise.race([
          buildLeadsFromJobs(scrapedJobs),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Lead build timeout after 8s")), BUILD_TIMEOUT)
          ),
        ]);
      } catch (err) {
        log.warn("Lead build timed out — rebuilding without enrichment", { error: String(err) });
        allLeads = await buildLeadsFromJobs(scrapedJobs, { skipEnrichment: true });
      }
    }
    buildTimer.end("Leads built", { count: allLeads.length });

    const availableIndustries = getIndustriesFromLeads(allLeads);

    // Detect if data came from bundled fallback
    if (scrapedJobs.length > 0) {
      const liveSources = ["remoteok", "arbeitnow", "jobicy", "himalayas", "indeed", "earnbetter", "greenhouse", "google_jobs"];
      const hasLiveData = scrapedJobs.some((j) => liveSources.includes(j.source));
      dataSource = hasLiveData ? "live" : "bundled";
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

    // Surface scraper issues as warnings so the client can show them
    const quotaStatus = getSerpApiQuotaStatus();
    const failures = getSourceFailures();
    const warnings: string[] = [];
    if (quotaStatus.exhausted) {
      warnings.push(quotaStatus.error || "SerpAPI quota exhausted — Google Jobs, EarnBetter, contacts, and employee data unavailable");
    }
    for (const f of failures) {
      if (f.consecutive >= 2) {
        warnings.push(`${f.source}: failing (${f.consecutive}x) — ${f.error}`);
      }
    }

    // Include enrichment stats for transparency
    const enrichmentStats = getLastEnrichmentStats();

    return NextResponse.json(
      {
        leads: leadsForClient,
        total: allLeads.length,
        industries: availableIndustries,
        dataSource,
        sourceBreakdown,
        ...(warnings.length > 0 && { warnings }),
        ...(enrichmentStats && { enrichmentStats }),
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
