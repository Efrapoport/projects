import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { scrapeJobs, loadBundledJobs } from "@/lib/scraper";
import { buildLeadsFromJobs } from "@/lib/lead-builder";
import { generateDailyLeadsEmail, filterLast24Hours } from "@/lib/daily-leads-email";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/digest/daily");

export const maxDuration = 60;

/**
 * GET /api/digest/daily
 *
 * Generates and sends the daily leads digest email via Resend.
 * Called by Vercel Cron (or any external scheduler).
 *
 * Query params:
 *   ?send=true  — send the email to DIGEST_RECIPIENTS via Resend
 *   (default)   — return HTML preview in the browser
 *
 * Auth: Protected by CRON_SECRET when triggered by Vercel Cron.
 *
 * Required env vars for sending:
 *   RESEND_API_KEY      — API key from https://resend.com/api-keys
 *   DIGEST_RECIPIENTS   — comma-separated recipient emails
 *   DIGEST_FROM_EMAIL   — sender address (must be verified domain in Resend,
 *                         or use "onboarding@resend.dev" for testing)
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

    const { searchParams } = request.nextUrl;
    const shouldSend = searchParams.get("send") === "true";
    // preview_all=true skips the 24h filter so you can QA the full email layout
    const previewAll = searchParams.get("preview_all") === "true";

    // 3. Generate the email HTML (filters to last 24h unless preview_all)
    const html = generateDailyLeadsEmail(leads, new Date(), { skipTimeFilter: previewAll });
    const newLeads = previewAll ? leads : filterLast24Hours(leads);

    if (shouldSend) {
      const apiKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.DIGEST_FROM_EMAIL || "SF Radar <onboarding@resend.dev>";
      const recipients = process.env.DIGEST_RECIPIENTS?.split(",").map((addr: string) => addr.trim()).filter(Boolean) || [];

      if (!apiKey) {
        timer.end("Daily digest aborted — missing RESEND_API_KEY");
        return NextResponse.json(
          { error: "RESEND_API_KEY is not configured" },
          { status: 500 }
        );
      }

      if (recipients.length === 0) {
        timer.end("Daily digest aborted — no recipients");
        return NextResponse.json(
          { error: "DIGEST_RECIPIENTS is not configured" },
          { status: 500 }
        );
      }

      const resend = new Resend(apiKey);
      const today = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject: `SF Radar: ${newLeads.length} new lead${newLeads.length !== 1 ? "s" : ""} — ${today}`,
        html,
      });

      if (error) {
        log.error("Resend delivery failed", { error });
        timer.end("Daily digest send failed");
        return NextResponse.json(
          { error: "Email delivery failed", details: error },
          { status: 500 }
        );
      }

      log.info("Daily digest sent", {
        emailId: data?.id,
        recipients,
        leadCount: newLeads.length,
      });
      timer.end("Daily digest sent successfully");

      return NextResponse.json({
        success: true,
        emailId: data?.id,
        leadCount: newLeads.length,
        recipientCount: recipients.length,
      });
    }

    // Default: return HTML preview
    timer.end("Daily digest preview generated", { leadCount: newLeads.length });

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
