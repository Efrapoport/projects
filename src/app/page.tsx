import { Dashboard } from "@/components/Dashboard";
import { scrapeJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";
import { applyFilters } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/types";

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
      const filtered = applyFilters(allLeads, DEFAULT_FILTERS);

      // Strip signal.raw (full JD) — client only needs the extracted snippets
      const leadsForClient = filtered.map((lead) => ({
        ...lead,
        signals: lead.signals.map(({ raw, ...rest }) => rest),
      }));

      initialData = {
        leads: leadsForClient,
        total: allLeads.length,
        filtered: leadsForClient.length,
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
