import { NextResponse } from "next/server";
import { getAllLeads } from "@/lib/mock-data";
import { generateDigestHtml } from "@/lib/email-digest";

export async function GET() {
  const leads = getAllLeads();
  const html = generateDigestHtml(leads, new Date());

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
