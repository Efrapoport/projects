import { NextResponse } from "next/server";
import { scrapeJobs, loadBundledJobs } from "@/lib/scraper";
import { buildLeadsFromJobs } from "@/lib/lead-builder";
import { generateDigestHtml } from "@/lib/email-digest";

export const maxDuration = 30; // Allow up to 30s on Vercel

export async function GET() {
  try {
    // Try live scraping with a timeout
    let jobs = await Promise.race([
      scrapeJobs(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Scraper timeout")), 20000)
      ),
    ]).catch(() => [] as Awaited<ReturnType<typeof scrapeJobs>>);

    // Fall back to bundled data if scraper returned nothing
    if (jobs.length === 0) {
      jobs = loadBundledJobs();
    }

    // Build leads with a timeout; fall back to skip enrichment on timeout
    let leads = await Promise.race([
      buildLeadsFromJobs(jobs),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Build timeout")), 8000)
      ),
    ]).catch(() => buildLeadsFromJobs(jobs, { skipEnrichment: true }));

    // If still no leads, try building without enrichment
    if (leads.length === 0) {
      leads = await buildLeadsFromJobs(loadBundledJobs(), { skipEnrichment: true });
    }

    const html = generateDigestHtml(leads, new Date());

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (err) {
    return new NextResponse(
      `<html><body><h1>Digest Error</h1><p>${String(err)}</p></body></html>`,
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    );
  }
}
