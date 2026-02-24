import { Dashboard } from "@/components/Dashboard";
import { scrapeJobs, loadBundledJobs } from "@/lib/scraper";
import { buildLeadsFromJobs, getIndustriesFromLeads } from "@/lib/lead-builder";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow up to 30s for live scraping on Vercel

export default async function Home() {
  // Try to get real scraped data for the initial server render
  let initialData;
  try {
    let jobs = await Promise.race([
      scrapeJobs(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 15000)
      ),
    ]);

    // Fall back to bundled data if scraper returned nothing
    let dataSource: "live" | "bundled" = "live";
    if (jobs.length === 0) {
      jobs = loadBundledJobs();
      dataSource = "bundled";
    }

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
        dataSource,
      };
    }
  } catch (err) {
    console.warn("[page] Server-side scrape failed, trying bundled fallback:", err);
    // If the scraper timed out, still provide bundled data so the page isn't empty
    try {
      const bundledJobs = loadBundledJobs();
      if (bundledJobs.length > 0) {
        const allLeads = await buildLeadsFromJobs(bundledJobs);
        const industries = getIndustriesFromLeads(allLeads);
        const leadsForClient = allLeads.map((lead) => ({
          ...lead,
          signals: lead.signals.map(({ raw, ...rest }) => rest),
        }));
        initialData = {
          leads: leadsForClient,
          total: allLeads.length,
          industries,
          dataSource: "bundled" as const,
        };
      }
    } catch (fallbackErr) {
      console.warn("[page] Bundled fallback also failed:", fallbackErr);
    }
  }

  // If server scrape worked, pass data. Otherwise Dashboard fetches on mount.
  return <Dashboard initialData={initialData} />;
}
