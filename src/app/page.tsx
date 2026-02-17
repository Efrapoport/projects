import { Dashboard } from "@/components/Dashboard";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Try to get real scraped data for the initial server render
  let initialData;
  try {
    const jobs = await Promise.race([
      scrapeJobs(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000)
      ),
    ]);

    if (jobs.length > 0) {
      const allLeads = await buildLeadsFromJobs(jobs);
      const industries = getIndustriesFromLeads(allLeads);

      // Strip signal.raw (full JD) — client only needs the extracted snippets
      // Send ALL leads — client handles filtering for instant filter response
      const leadsForClient = allLeads.map((lead) => ({
        ...lead,
        signals: lead.signals.map(({ raw, ...rest }) => rest),
      }));

      initialData = {
        leads: leadsForClient,
        total: allLeads.length,
        industries,
        dataSource: "live" as const,
      };
    }
  } catch (err) {
    console.warn("[page] Server-side scrape failed, client will fetch:", err);
  }

  // If server scrape worked, pass data. Otherwise Dashboard fetches on mount.
  return <Dashboard initialData={initialData} />;
}
