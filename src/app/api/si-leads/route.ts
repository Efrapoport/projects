import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs, loadBundledJobs } from "@/lib/scraper";
import { buildSILeadsFromJobs, getSIIndustriesFromLeads, getTopSIPartners } from "@/lib/si-lead-builder";
import { loadBundledSIJobs } from "@/lib/si-scraper";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/si-leads");

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const requestTimer = log.time("si-leads-request");

  try {
    const { searchParams } = request.nextUrl;
    const forceRefresh = searchParams.get("refresh") === "true";

    log.info("SI leads request received", { forceRefresh });

    // Scrape jobs from all sources (reuse existing scraper infrastructure)
    let scrapedJobs: Awaited<ReturnType<typeof scrapeJobs>> = [];
    let dataSource: "live" | "bundled" = "live";

    try {
      scrapedJobs = await Promise.race([
        scrapeJobs(forceRefresh),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Scraper timeout")), 20000)
        ),
      ]);
    } catch (err) {
      log.warn("Scraper failed or timed out for SI leads", { error: String(err) });
    }

    // Merge with SI-specific bundled data
    const siBundled = loadBundledSIJobs();

    if (scrapedJobs.length === 0) {
      // Fall back entirely to bundled data
      scrapedJobs = [...loadBundledJobs(), ...siBundled];
      dataSource = "bundled";
      log.info("Using bundled fallback for SI leads", { count: scrapedJobs.length });
    } else {
      // Merge SI bundled data with live data for better coverage
      scrapedJobs = [...scrapedJobs, ...siBundled];
    }

    // Build SI-dependent leads (the SI signal engine filters & scores)
    const leads = await buildSILeadsFromJobs(scrapedJobs);
    const industries = getSIIndustriesFromLeads(leads);
    const topSIPartners = getTopSIPartners(leads);

    requestTimer.end("SI leads response ready", {
      total: leads.length,
      dataSource,
    });

    return NextResponse.json(
      {
        leads,
        total: leads.length,
        industries,
        topSIPartners,
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
    log.error("SI leads error", { error: String(err), stack: (err as Error)?.stack });
    requestTimer.end("SI leads request failed");

    return NextResponse.json(
      {
        leads: [],
        total: 0,
        industries: [],
        topSIPartners: [],
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
