import { NextResponse } from "next/server";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs } from "@/lib/lead-builder";
import { getAllLeads } from "@/lib/sample-data";
import { generateDigestHtml } from "@/lib/email-digest";

export async function GET() {
  const jobs = await scrapeJobs();
  const leads = jobs.length > 0 ? buildLeadsFromJobs(jobs) : getAllLeads();
  const html = generateDigestHtml(leads, new Date());

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
