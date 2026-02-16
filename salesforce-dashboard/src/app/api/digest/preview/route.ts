import { NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs } from "@/lib/lead-builder";
import { generateDigestHtml } from "@/lib/email-digest";

export async function GET() {
  const jobs = await scrapeJobs();
  const leads = buildLeadsFromJobs(jobs);
  const html = generateDigestHtml(leads, new Date());

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
