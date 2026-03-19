import type { ScrapedJob } from "./scraper";
import { SI_SCRAPED_JOBS, SIScrapedJobRecord } from "./si-dependent-data";

/** Load SI-specific bundled jobs as ScrapedJob format for the lead builder. */
export function loadBundledSIJobs(): ScrapedJob[] {
  return SI_SCRAPED_JOBS.map((record: SIScrapedJobRecord) => ({
    title: record.title,
    company: record.company,
    location: record.location,
    description: record.description,
    url: record.url,
    source: record.source,
    detectedAt: record.detectedAt,
  }));
}
