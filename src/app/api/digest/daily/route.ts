import { NextRequest, NextResponse } from "next/server";
import { scrapeJobs, loadBundledJobs } from "@/lib/scraper";
import { buildLeadsFromJobs } from "@/lib/lead-builder";
import { generateDailyLeadsEmail } from "@/lib/daily-leads-email";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/digest/daily");

export const maxDuration = 60;

/**
 * GET /api/digest/daily
 *
 * Generates and returns the daily leads digest email.
 * Designed to be called by Vercel Cron (or any external scheduler).
 *
 * Query params:
 *   ?send=true  — (future) actually send via email provider
 *   ?preview=true — return HTML for browser preview (default)
 *
 * Auth: Protected by CRON_SECRET when triggered by Vercel Cron.
 */
export async function GET(request: NextRequest) {
  const timer = log.time("daily-digest");

  try {
    // Verify cron secret when set (Vercel Cron sends this automatically)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 1. Scrape fresh jobs
    let jobs = await scrapeJobs().catch(() => []);
    if (jobs.length === 0) {
      jobs = loadBundledJobs();
      log.info("Using bundled fallback for daily digest");
    }

    // 2. Build leads (with enrichment)
    const leads = await buildLeadsFromJobs(jobs).catch(async () => {
      log.warn("Enriched build failed, retrying without enrichment");
      return buildLeadsFromJobs(jobs, { skipEnrichment: true });
    });

    // 3. Generate the email HTML (filters to last 24h internally)
    const html = generateDailyLeadsEmail(leads, new Date());

    const { searchParams } = request.nextUrl;
    const shouldSend = searchParams.get("send") === "true";

    if (shouldSend) {
      // Future: integrate with email provider (SendGrid, Resend, etc.)
      // For now, log intent and return the HTML
      const recipients = process.env.DIGEST_RECIPIENTS?.split(",").map((addr: string) => addr.trim()) || [];
      log.info("Daily digest ready to send", {
        leadCount: leads.length,
        recipients: recipients.length,
      });

      timer.end("Daily digest generated (send=true, delivery pending provider integration)");

      return NextResponse.json({
        success: true,
        message: "Digest generated. Email delivery requires provider configuration (DIGEST_RECIPIENTS, email provider API key).",
        leadCount: leads.length,
        recipientCount: recipients.length,
      });
    }

    // Default: return HTML preview
    timer.end("Daily digest preview generated", { leadCount: leads.length });

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html" },
    });
  } catch (err) {
    log.error("Daily digest failed", { error: String(err), stack: (err as Error)?.stack });
    timer.end("Daily digest failed");

    return NextResponse.json(
      { error: "Failed to generate daily digest", details: String(err) },
      { status: 500 }
    );
  }
}
