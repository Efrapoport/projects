import * as cheerio from "cheerio";
import { SignalSource } from "./types";
import { SCRAPED_JOBS, ScrapedJobRecord } from "./scraped-jobs-data";
import { createLogger } from "./logger";

const log = createLogger("scraper");

// ── Types ───────────────────────────────────────────────────────────

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: SignalSource;
  detectedAt: string;
}

// ── In-Memory Cache + Persistent Accumulator ────────────────────────
// Instead of replacing the job list on every scrape, we ACCUMULATE
// jobs across scrapes so that leads don't disappear when an API is
// temporarily down or returns different results.  Jobs expire after
// JOB_MAX_AGE_MS (30 days) to keep the dataset from growing forever.

let cachedJobs: ScrapedJob[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const jobStore = new Map<string, ScrapedJob & { lastSeen: number }>();
const JOB_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function jobStoreKey(job: ScrapedJob): string {
  return `${job.company.toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
}

// ── Pre-seed store with bundled data on cold start ─────────────────
// Vercel serverless functions lose in-memory state between invocations.
// By seeding the store eagerly, the health check always shows baseline
// data and the dashboard is never empty on first load.
(function seedStore() {
  const now = Date.now();
  const bundled = SCRAPED_JOBS.map((r: ScrapedJobRecord) => ({
    title: r.title,
    company: r.company,
    location: r.location,
    description: r.description,
    url: r.url,
    source: r.source,
    detectedAt: r.detectedAt,
  }));
  for (const job of bundled) {
    const key = jobStoreKey(job);
    if (!jobStore.has(key)) {
      jobStore.set(key, { ...job, lastSeen: now });
    }
  }
})();

/** Merge freshly scraped jobs into the persistent store, then return all non-expired jobs. */
function mergeIntoStore(freshJobs: ScrapedJob[]): ScrapedJob[] {
  const now = Date.now();

  // Upsert fresh jobs
  for (const job of freshJobs) {
    const key = jobStoreKey(job);
    const existing = jobStore.get(key);
    if (existing) {
      // Keep the earlier detectedAt but update lastSeen
      existing.lastSeen = now;
    } else {
      jobStore.set(key, { ...job, lastSeen: now });
    }
  }

  // Evict expired jobs (not seen in any scrape for 30 days)
  for (const [key, entry] of jobStore) {
    if (now - entry.lastSeen > JOB_MAX_AGE_MS) {
      jobStore.delete(key);
    }
  }

  // Return all live jobs (strip the lastSeen field)
  return Array.from(jobStore.values()).map(({ lastSeen: _, ...job }) => job);
}

// ── SerpAPI Quota Tracking ───────────────────────────────────────────
// Detects 429 (rate limit) responses from SerpAPI and surfaces them
// as visible errors in the health check and logs.

let serpApiQuotaExhausted = false;
let serpApiQuotaError: string | null = null;
let serpApiQuotaDetectedAt: number | null = null;

export function getSerpApiQuotaStatus(): { exhausted: boolean; error: string | null; detectedAt: number | null } {
  return { exhausted: serpApiQuotaExhausted, error: serpApiQuotaError, detectedAt: serpApiQuotaDetectedAt };
}

/** Reset the quota flag (e.g. at the start of a new month or after key rotation). */
export function resetSerpApiQuotaFlag(): void {
  serpApiQuotaExhausted = false;
  serpApiQuotaError = null;
  serpApiQuotaDetectedAt = null;
}

// ── Shared fetch helper ─────────────────────────────────────────────

async function fetchJSON(url: string, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    // Detect SerpAPI quota exhaustion
    if (response.status === 429 && url.includes("serpapi.com")) {
      serpApiQuotaExhausted = true;
      serpApiQuotaDetectedAt = Date.now();
      let detail = "SerpAPI monthly quota exhausted (HTTP 429)";
      try {
        const body = await response.json() as Record<string, unknown>;
        if (body.error) detail = `SerpAPI: ${body.error}`;
      } catch { /* use default message */ }
      serpApiQuotaError = detail;
      log.error(detail, { url: url.replace(/api_key=[^&]+/, "api_key=***") });
      throw new Error(detail);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Source 1: RemoteOK ──────────────────────────────────────────────

async function fetchRemoteOK(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const timer = log.time("remoteok");

  try {
    const data = await fetchJSON(
      "https://remoteok.com/api?tag=salesforce&api=1"
    );

    if (!Array.isArray(data)) return [];

    for (let i = 1; i < data.length; i++) {
      const item = data[i] as Record<string, unknown>;
      const company = String(item.company || "").trim();
      const title = String(item.position || "").trim();

      if (!company || !title) continue;

      jobs.push({
        title,
        company,
        location: String(item.location || "Remote"),
        description: stripHTML(String(item.description || "")),
        url: String(item.url || `https://remoteok.com/remote-jobs/${item.id || ""}`),
        source: "remoteok",
        detectedAt: item.date
          ? String(item.date)
          : new Date((item.epoch as number) * 1000 || Date.now()).toISOString(),
      });
    }

    timer.end(`Found ${jobs.length} jobs`, { count: jobs.length });
  } catch (error) {
    log.warn("RemoteOK failed", { error: String(error) });
  }

  return jobs;
}

// ── Source 2: Arbeitnow ─────────────────────────────────────────────

async function fetchArbeitnow(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const timer = log.time("arbeitnow");

  try {
    const data = (await fetchJSON(
      "https://www.arbeitnow.com/api/job-board-api?search=salesforce"
    )) as Record<string, unknown>;

    const items = (data?.data || []) as Record<string, unknown>[];

    for (const item of items) {
      const company = String(item.company_name || "").trim();
      const title = String(item.title || "").trim();

      if (!company || !title) continue;

      jobs.push({
        title,
        company,
        location: String(item.location || (item.remote ? "Remote" : "")),
        description: stripHTML(String(item.description || "")),
        url: item.url
          ? String(item.url)
          : `https://www.arbeitnow.com/${item.slug || ""}`,
        source: "arbeitnow",
        detectedAt: String(item.created_at || new Date().toISOString()),
      });
    }

    timer.end(`Found ${jobs.length} jobs`, { count: jobs.length });
  } catch (error) {
    log.warn("Arbeitnow failed", { error: String(error) });
  }

  return jobs;
}

// ── Source 3: Jobicy ────────────────────────────────────────────────

async function fetchJobicy(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const timer = log.time("jobicy");

  try {
    const data = (await fetchJSON(
      "https://jobicy.com/api/v2/remote-jobs?tag=salesforce&count=50"
    )) as Record<string, unknown>;

    const items = (data?.jobs || []) as Record<string, unknown>[];

    for (const item of items) {
      const company = String(item.companyName || "").trim();
      const title = String(item.jobTitle || "").trim();

      if (!company || !title) continue;

      jobs.push({
        title,
        company,
        location: String(item.jobGeo || "Remote"),
        description: stripHTML(String(item.jobExcerpt || "")),
        url: String(item.url || ""),
        source: "jobicy",
        detectedAt: String(item.pubDate || new Date().toISOString()),
      });
    }

    timer.end(`Found ${jobs.length} jobs`, { count: jobs.length });
  } catch (error) {
    log.warn("Jobicy failed", { error: String(error) });
  }

  return jobs;
}

// ── Source 4: Himalayas ─────────────────────────────────────────────

async function fetchHimalayas(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const timer = log.time("himalayas");

  try {
    const data = (await fetchJSON(
      "https://himalayas.app/jobs/api?q=salesforce&limit=50"
    )) as Record<string, unknown>;

    const items = (data?.jobs || []) as Record<string, unknown>[];

    for (const item of items) {
      const company = String(item.companyName || "").trim();
      const title = String(item.title || "").trim();

      if (!company || !title) continue;

      jobs.push({
        title,
        company,
        location: String(item.location || "Remote"),
        description: stripHTML(String(item.excerpt || item.description || "")),
        url: String(item.url || item.applicationLink || ""),
        source: "himalayas",
        detectedAt: String(item.pubDate || new Date().toISOString()),
      });
    }

    timer.end(`Found ${jobs.length} jobs`, { count: jobs.length });
  } catch (error) {
    log.warn("Himalayas failed", { error: String(error) });
  }

  return jobs;
}

// ── Source 5: SerpAPI Google Jobs ────────────────────────────────────
// Aggregates results from Google Jobs (which pulls from LinkedIn, Indeed,
// Glassdoor, ZipRecruiter, and more) via the SerpAPI service.
// Requires SERPAPI_KEY env var. Skipped gracefully if not set.

async function fetchGoogleJobs(): Promise<ScrapedJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    log.info("No SERPAPI_KEY set — skipping Google Jobs");
    return [];
  }

  const jobs: ScrapedJob[] = [];
  const timer = log.time("google_jobs");
  const queries = [
    "salesforce administrator",
    "salesforce developer",
    "first salesforce admin",
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q: query,
        api_key: apiKey,
      });

      const data = (await fetchJSON(
        `https://serpapi.com/search.json?${params.toString()}`,
        20000
      )) as Record<string, unknown>;

      const results = (data?.jobs_results || []) as Record<string, unknown>[];

      for (const item of results) {
        const company = String(item.company_name || "").trim();
        const title = String(item.title || "").trim();

        if (!company || !title) continue;

        // Extract the "via" source (e.g. "via LinkedIn", "via Indeed")
        const via = String(item.via || "").replace(/^via\s+/i, "");

        // Build description from highlights if available
        let description = String(item.description || "");
        const highlights = item.job_highlights as Record<string, unknown>[] | undefined;
        if (highlights && Array.isArray(highlights)) {
          const snippets = highlights
            .flatMap((h) => (h.items as string[]) || [])
            .join(" ");
          if (snippets) {
            description = description || snippets;
          }
        }

        // Extract apply link if available
        const applyOptions = (item.apply_options || []) as Record<string, unknown>[];
        const applyLink = applyOptions[0]?.link
          ? String(applyOptions[0].link)
          : "";

        // Detect posting age from extensions (e.g. "3 days ago")
        const extensions = (item.detected_extensions || {}) as Record<string, unknown>;
        const postedAt = extensions.posted_at
          ? String(extensions.posted_at)
          : "";

        jobs.push({
          title,
          company,
          location: String(item.location || ""),
          description: stripHTML(description).slice(0, 1000),
          url: applyLink || `https://www.google.com/search?q=${encodeURIComponent(`${title} ${company} jobs`)}`,
          source: "google_jobs",
          detectedAt: postedAtToISO(postedAt),
        });
      }

      log.info(`Google Jobs query "${query}"`, {
        results: results.length,
      });
    } catch (error) {
      log.warn(`Google Jobs query "${query}" failed`, { error: String(error) });
    }
  }

  // Deduplicate within Google Jobs results (same title+company from different queries)
  const seen = new Set<string>();
  const unique = jobs.filter((job) => {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  timer.end(`Google Jobs total`, { raw: jobs.length, unique: unique.length });
  return unique;
}

// ── Source 6: EarnBetter ─────────────────────────────────────────────
// EarnBetter.com has SEO-rendered search pages at known URL patterns:
//   /app/job/s/s-Salesforce+Administrator/ws-remote/
// We scrape those directly. If blocked, we fall back to SerpAPI Google
// Web Search with site:earnbetter.com, which finds their indexed pages.
// Job titles follow the pattern: "Job Title in City, State, ZIP | EarnBetter"

const EARNBETTER_SEARCH_URLS = [
  "https://earnbetter.com/app/job/s/s-Salesforce+Administrator/",
  "https://earnbetter.com/app/job/s/s-Salesforce+Developer/",
  "https://earnbetter.com/app/job/s/s-Salesforce+Administrator/ws-remote/",
  "https://earnbetter.com/app/job/s/s-Salesforce+Architect/",
  "https://earnbetter.com/app/job/s/s-Salesforce+Engineer/",
];

async function fetchEarnBetter(): Promise<ScrapedJob[]> {
  const timer = log.time("earnbetter");

  // Run all 3 strategies in PARALLEL and merge results.
  // Strategy 3 (Google Jobs) has the best company names, so we use those
  // to fill in missing company names from other strategies.

  const [directResults, googleWebResults, googleJobsResults] = await Promise.all([
    earnbetterStrategy1_DirectScrape(),
    earnbetterStrategy2_GoogleWeb(),
    earnbetterStrategy3_GoogleJobs(),
  ]);

  log.info("EarnBetter strategy results", {
    direct: directResults.length,
    googleWeb: googleWebResults.length,
    googleJobs: googleJobsResults.length,
  });

  // Build a lookup: normalized job title → company name from the best sources.
  // Strategy 3 (Google Jobs) has reliable company_name from Google's index.
  // Strategy 1 (direct scrape) may also have good data from JSON-LD.
  const companyLookup = new Map<string, string>(); // normalized title → company
  const urlToCompany = new Map<string, string>();   // job URL → company

  // Index from best sources first
  for (const job of [...googleJobsResults, ...directResults]) {
    if (job.company && !job.company.includes("Unknown")) {
      const titleKey = job.title.toLowerCase().trim();
      if (!companyLookup.has(titleKey)) {
        companyLookup.set(titleKey, job.company);
      }
      if (job.url) {
        urlToCompany.set(job.url, job.company);
      }
    }
  }

  // Merge all results, resolving "Unknown" company names
  const allJobs = [...directResults, ...googleWebResults, ...googleJobsResults];

  for (const job of allJobs) {
    if (job.company.includes("Unknown")) {
      // Try URL match first, then title match
      const fromUrl = job.url ? urlToCompany.get(job.url) : undefined;
      const fromTitle = companyLookup.get(job.title.toLowerCase().trim());
      if (fromUrl) {
        job.company = fromUrl;
      } else if (fromTitle) {
        job.company = fromTitle;
      }
    }
  }

  // For any remaining "Unknown" companies, try fetching the individual job page
  const unknowns = allJobs.filter(
    (j) => j.company.includes("Unknown") && j.url && j.url.includes("earnbetter.com/app/job/")
  );

  if (unknowns.length > 0) {
    log.info(`Resolving ${unknowns.length} unknown company names from job pages`);
    const resolutions = await Promise.allSettled(
      unknowns.slice(0, 10).map((job) => resolveEarnBetterCompany(job.url))
    );

    resolutions.forEach((result, i) => {
      if (result.status === "fulfilled" && result.value) {
        const resolved = result.value;
        unknowns[i].company = resolved;
        // Also update lookup for future matches
        urlToCompany.set(unknowns[i].url, resolved);
        companyLookup.set(unknowns[i].title.toLowerCase().trim(), resolved);
        log.debug(`Resolved company: ${resolved}`, { url: unknowns[i].url });
      }
    });
  }

  // For remaining unknowns, derive a company name from the URL or title
  // instead of silently dropping them (which caused 0-result issues).
  for (const job of allJobs) {
    if (job.company.includes("Unknown")) {
      // Try to extract from URL slug: /app/job/ULID/company-name-title
      const slugMatch = job.url?.match(/earnbetter\.com\/app\/job\/[A-Z0-9]+\/([a-z0-9-]+)/i);
      if (slugMatch) {
        const words = slugMatch[1].split("-").slice(0, 3).join(" ");
        if (words.length > 2) {
          job.company = words.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        }
      }
    }
  }

  // Dedup by URL first (most reliable), then by company+title
  const seen = new Set<string>();
  const unique = allJobs.filter((j) => {
    // Still skip if truly unresolvable (no URL, no title clue)
    if (j.company.includes("Unknown") && !j.url) return false;

    const urlKey = j.url ? j.url.replace(/\/$/, "") : "";
    if (urlKey && seen.has(urlKey)) return false;
    if (urlKey) seen.add(urlKey);

    const titleKey = `${j.company.toLowerCase()}|${j.title.toLowerCase()}`;
    if (seen.has(titleKey)) return false;
    seen.add(titleKey);

    return true;
  });

  const stillUnknown = unique.filter((j) => j.company.includes("Unknown")).length;
  timer.end("EarnBetter merged", {
    total: allJobs.length,
    unique: unique.length,
    unknownsResolved: unknowns.filter((j) => !j.company.includes("Unknown")).length,
    unknownsRemaining: stillUnknown,
  });

  return unique;
}

// ── EarnBetter Strategy 1: Direct scrape of SEO pages ─────────────

async function earnbetterStrategy1_DirectScrape(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

  for (const searchUrl of EARNBETTER_SEARCH_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });

      clearTimeout(timeout);

      if (response.ok) {
        const html = await response.text();
        const parsed = parseEarnBetterHTML(html);
        if (parsed.length > 0) {
          jobs.push(...parsed);
          log.info(`EarnBetter direct scrape: ${searchUrl}`, { count: parsed.length });
        }
      } else {
        log.debug(`EarnBetter ${response.status} for ${searchUrl}`);
      }
    } catch (error) {
      log.debug(`EarnBetter direct fetch failed for ${searchUrl}`, { error: String(error) });
    }

    // Small delay between requests to be polite
    if (EARNBETTER_SEARCH_URLS.indexOf(searchUrl) < EARNBETTER_SEARCH_URLS.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return jobs;
}

// ── EarnBetter Strategy 2: SerpAPI Google Web Search ──────────────

async function earnbetterStrategy2_GoogleWeb(): Promise<ScrapedJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const jobs: ScrapedJob[] = [];
  const queries = [
    "site:earnbetter.com salesforce administrator",
    "site:earnbetter.com salesforce developer",
  ];

  for (const query of queries) {
    try {
      const params = new URLSearchParams({
        engine: "google",
        q: query,
        api_key: apiKey,
        num: "20",
      });

      const data = (await fetchJSON(
        `https://serpapi.com/search.json?${params.toString()}`,
        20000
      )) as Record<string, unknown>;

      const results = (data?.organic_results || []) as Record<string, unknown>[];

      for (const item of results) {
        const link = String(item.link || "");
        const snippetText = String(item.snippet || "");
        const titleText = String(item.title || "");

        // Only process individual job pages (ULID pattern: /app/job/01...)
        if (!link.includes("earnbetter.com/app/job/") || link.includes("/s/") || link.includes("/browse")) {
          continue;
        }

        // Parse title: "Salesforce Admin in Austin, TX, 78701 | EarnBetter"
        const titleMatch = titleText.match(/^(.+?)\s+in\s+(.+?)\s*\|\s*EarnBetter/i);
        const jobTitle = titleMatch ? titleMatch[1].trim() : titleText.replace(/\s*\|\s*EarnBetter.*/, "").trim();
        const locationStr = titleMatch ? titleMatch[2].replace(/,?\s*\d{5}(-\d{4})?$/, "").trim() : "";

        if (!jobTitle) continue;

        // Try to extract company from snippet — multiple patterns
        const company = extractCompanyFromSnippet(snippetText);

        jobs.push({
          title: jobTitle,
          company: company || "Unknown (via EarnBetter)",
          location: locationStr,
          description: stripHTML(snippetText).slice(0, 500),
          url: link,
          source: "earnbetter",
          detectedAt: new Date().toISOString(),
        });
      }

      log.info(`EarnBetter Google search "${query}"`, {
        googleResults: results.length,
        earnbetterJobs: jobs.length,
      });
    } catch (error) {
      log.warn(`EarnBetter Google search failed: "${query}"`, { error: String(error) });
    }
  }

  return jobs;
}

// ── EarnBetter Strategy 3: SerpAPI Google Jobs ────────────────────

async function earnbetterStrategy3_GoogleJobs(): Promise<ScrapedJob[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  const jobs: ScrapedJob[] = [];

  // Run multiple queries to maximize coverage
  const queries = ["salesforce administrator", "salesforce developer", "salesforce engineer"];

  for (const q of queries) {
    try {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q,
        api_key: apiKey,
        chips: "date_posted:month",
      });

      const data = (await fetchJSON(
        `https://serpapi.com/search.json?${params.toString()}`,
        20000
      )) as Record<string, unknown>;

      const results = (data?.jobs_results || []) as Record<string, unknown>[];

      for (const item of results) {
        const via = String(item.via || "").toLowerCase();
        // Only keep results sourced from EarnBetter
        if (!via.includes("earnbetter")) continue;

        const company = String(item.company_name || "").trim();
        const title = String(item.title || "").trim();
        if (!company || !title) continue;

        let description = String(item.description || "");
        const highlights = item.job_highlights as Record<string, unknown>[] | undefined;
        if (highlights && Array.isArray(highlights)) {
          const snippets = highlights.flatMap((h) => (h.items as string[]) || []).join(" ");
          if (snippets) description = description || snippets;
        }

        const applyOptions = (item.apply_options || []) as Record<string, unknown>[];
        const earnbetterLink = applyOptions.find((o) =>
          String(o.title || "").toLowerCase().includes("earnbetter")
        );
        const applyLink = earnbetterLink
          ? String(earnbetterLink.link)
          : applyOptions[0]?.link
            ? String(applyOptions[0].link)
            : "";

        const extensions = (item.detected_extensions || {}) as Record<string, unknown>;
        const postedAt = extensions.posted_at ? String(extensions.posted_at) : "";

        jobs.push({
          title,
          company,
          location: String(item.location || ""),
          description: stripHTML(description).slice(0, 1000),
          url: applyLink,
          source: "earnbetter",
          detectedAt: postedAtToISO(postedAt),
        });
      }

      log.info(`EarnBetter Google Jobs "${q}"`, {
        totalResults: results.length,
        earnbetterResults: jobs.length,
      });
    } catch (error) {
      log.warn(`EarnBetter Google Jobs failed: "${q}"`, { error: String(error) });
    }
  }

  return jobs;
}

// ── EarnBetter: Extract company name from Google snippet ──────────

function extractCompanyFromSnippet(snippet: string): string {
  if (!snippet) return "";

  // Pattern 1: "Company Name - description..."
  const dashMatch = snippet.match(/^([A-Z][A-Za-z0-9\s&.,'()-]+?)\s*[-–—]\s/);
  if (dashMatch && dashMatch[1].trim().length <= 60 && dashMatch[1].trim().split(" ").length <= 6) {
    return dashMatch[1].trim();
  }

  // Pattern 2: "Company Name is hiring/looking/seeking..."
  const hiringMatch = snippet.match(/^([A-Z][A-Za-z0-9\s&.,'()-]+?)\s+is\s+(?:hiring|looking|seeking)/i);
  if (hiringMatch && hiringMatch[1].trim().length <= 60 && hiringMatch[1].trim().split(" ").length <= 6) {
    return hiringMatch[1].trim();
  }

  // Pattern 3: "Company Name posted..." or "Company Name has..."
  const postedMatch = snippet.match(/^([A-Z][A-Za-z0-9\s&.,'()-]+?)\s+(?:posted|has|recently|just)\s/i);
  if (postedMatch && postedMatch[1].trim().length <= 60 && postedMatch[1].trim().split(" ").length <= 6) {
    return postedMatch[1].trim();
  }

  // Pattern 4: "Apply for Job Title at Company Name" or "... at Company Name."
  const atMatch = snippet.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,'()-]+?)(?:\.|,|\s+in\s|\s+with\s|\s+and\s|$)/);
  if (atMatch && atMatch[1].trim().length <= 60 && atMatch[1].trim().split(" ").length <= 6) {
    return atMatch[1].trim();
  }

  // Pattern 5: "Join Company Name as..." or "Join Company Name's..."
  const joinMatch = snippet.match(/\b[Jj]oin\s+([A-Z][A-Za-z0-9\s&.,'()-]+?)\s+(?:as|'s|team)/);
  if (joinMatch && joinMatch[1].trim().length <= 60 && joinMatch[1].trim().split(" ").length <= 6) {
    return joinMatch[1].trim();
  }

  return "";
}

// ── EarnBetter: Resolve company name from individual job page ─────

async function resolveEarnBetterCompany(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try JSON-LD first
    let company: string | null = null;
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const data = JSON.parse($(el).html() || "");
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item["@type"] === "JobPosting" && item.hiringOrganization?.name) {
            company = String(item.hiringOrganization.name).trim();
          }
        }
      } catch { /* ignore */ }
    });
    if (company) return company;

    // Try __NEXT_DATA__
    $("script").each((_, el) => {
      const content = $(el).html() || "";
      if (!content.includes("__NEXT_DATA__")) return;
      try {
        const dataMatch = content.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?})\s*;?\s*$/m);
        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);
          const props = data?.props?.pageProps || {};
          const job = props.job || props.listing || props.data?.job || {};
          const name = String(job.company || job.companyName || job.employer || job.organization || "").trim();
          if (name) company = name;
        }
      } catch { /* ignore */ }
    });
    if (company) return company;

    // Try meta tags
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogDesc = $('meta[property="og:description"]').attr("content") || "";
    // Look for "at Company" in meta description
    const atMatch = ogDesc.match(/\bat\s+([A-Z][A-Za-z0-9\s&.,'()-]+?)(?:\.|,|\s+in\s|$)/);
    if (atMatch) return atMatch[1].trim();

    // Look for "Company | Job Title" or "Job Title | Company" patterns in og:title
    const pipeparts = ogTitle.split("|").map((s) => s.trim());
    if (pipeparts.length >= 2) {
      // The part that doesn't contain "EarnBetter" and doesn't look like a job title
      for (const part of pipeparts) {
        if (part.toLowerCase().includes("earnbetter")) continue;
        if (/(?:admin|developer|engineer|architect|analyst|consultant|manager|specialist)/i.test(part)) continue;
        if (part.length > 3 && part.length < 60) return part;
      }
    }

    return null;
  } catch {
    return null;
  }
}

function parseEarnBetterHTML(html: string): ScrapedJob[] {
  const $ = cheerio.load(html);
  const jobs: ScrapedJob[] = [];

  // Strategy A: Look for __NEXT_DATA__ or embedded JSON
  $("script").each((_, el) => {
    const content = $(el).html() || "";
    if (content.includes("__NEXT_DATA__")) {
      try {
        const dataMatch = content.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?})\s*;?\s*$/m);
        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);
          const pageProps = data?.props?.pageProps || {};
          // Try multiple possible field names for job listings
          const jobList = pageProps.jobs || pageProps.results || pageProps.listings ||
            pageProps.searchResults || pageProps.data?.jobs || [];

          for (const job of (Array.isArray(jobList) ? jobList : [])) {
            const title = String(job.title || job.jobTitle || job.name || "").trim();
            const company = String(job.company || job.companyName || job.employer || job.organization || "").trim();

            if (title && company) {
              jobs.push({
                title,
                company,
                location: String(job.location || job.city || ""),
                description: stripHTML(String(job.description || job.snippet || job.summary || "")),
                url: job.url || job.applyUrl || job.link || "",
                source: "earnbetter",
                detectedAt: String(job.postedAt || job.createdAt || job.datePosted || new Date().toISOString()),
              });
            }
          }
        }
      } catch {
        // JSON parsing failed
      }
    }
  });

  if (jobs.length > 0) return jobs;

  // Strategy B: Parse structured data (JSON-LD)
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item["@type"] === "JobPosting") {
          const org = item.hiringOrganization || {};
          const loc = item.jobLocation?.address || {};
          const title = String(item.title || "").trim();
          const company = String(org.name || "").trim();

          if (title) {
            jobs.push({
              title,
              company: company || "Unknown (via EarnBetter)",
              location: [loc.addressLocality, loc.addressRegion].filter(Boolean).join(", "),
              description: stripHTML(String(item.description || "")),
              url: String(item.url || ""),
              source: "earnbetter",
              detectedAt: String(item.datePosted || new Date().toISOString()),
            });
          }
        }

        // Handle ItemList of JobPostings
        if (item["@type"] === "ItemList" && item.itemListElement) {
          for (const entry of item.itemListElement) {
            const posting = entry.item || entry;
            if (posting["@type"] === "JobPosting") {
              const org = posting.hiringOrganization || {};
              const title = String(posting.title || "").trim();
              if (title) {
                jobs.push({
                  title,
                  company: String(org.name || "Unknown (via EarnBetter)"),
                  location: "",
                  description: stripHTML(String(posting.description || "")),
                  url: String(posting.url || ""),
                  source: "earnbetter",
                  detectedAt: String(posting.datePosted || new Date().toISOString()),
                });
              }
            }
          }
        }
      }
    } catch {
      // JSON-LD parsing failed
    }
  });

  if (jobs.length > 0) return jobs;

  // Strategy C: Parse visible DOM elements (job cards / links)
  // EarnBetter job links follow pattern: /app/job/{ULID}/
  const jobLinkPattern = /\/app\/job\/([A-Z0-9]{26})\//;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (!jobLinkPattern.test(href)) return;

    const $el = $(el);
    // Get the closest container that holds job info
    const $card = $el.closest("[class*='job'], [class*='Job'], [class*='card'], [class*='Card'], li, article, div").first();
    const container = $card.length ? $card : $el;

    const title = container.find("h2, h3, [class*='title'], [class*='Title']").first().text().trim()
      || $el.text().trim();
    const company = container.find("[class*='company'], [class*='Company'], [class*='employer']").first().text().trim();
    const location = container.find("[class*='location'], [class*='Location'], [class*='city']").first().text().trim();

    if (title && title.length > 3) {
      const fullUrl = href.startsWith("http") ? href : `https://earnbetter.com${href}`;
      jobs.push({
        title,
        company: company || "Unknown (via EarnBetter)",
        location,
        description: container.find("[class*='description'], [class*='snippet']").first().text().trim(),
        url: fullUrl,
        source: "earnbetter",
        detectedAt: new Date().toISOString(),
      });
    }
  });

  return jobs;
}

/** Convert relative time strings like "3 days ago" to ISO dates */
function postedAtToISO(postedAt: string): string {
  if (!postedAt) return new Date().toISOString();

  const now = Date.now();
  const match = postedAt.match(/(\d+)\s*(hour|day|week|month)/i);
  if (!match) return new Date().toISOString();

  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const ms: Record<string, number> = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
  };

  return new Date(now - amount * (ms[unit] || 0)).toISOString();
}

// ── Source 7: Indeed (HTML scraping) ─────────────────────────────────

async function fetchIndeed(): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
  const timer = log.time("indeed");
  const queries = ["salesforce administrator", "first salesforce admin"];

  for (const query of queries) {
    try {
      const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(query)}&sort=date&limit=25`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
          },
        });

        if (response.ok) {
          const html = await response.text();
          allJobs.push(...parseIndeedHTML(html));
        }
      } finally {
        clearTimeout(timeout);
      }

      if (queries.indexOf(query) < queries.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      log.warn(`Indeed query "${query}" failed`, { error: String(error) });
    }
  }

  timer.end(`Found ${allJobs.length} jobs`, { count: allJobs.length });
  return allJobs;
}

function parseIndeedHTML(html: string): ScrapedJob[] {
  const $ = cheerio.load(html);
  const jobs: ScrapedJob[] = [];

  $("script").each((_, el) => {
    const content = $(el).html() || "";
    if (
      content.includes("mosaic-provider-jobcards") ||
      content.includes("jobcards")
    ) {
      try {
        const patterns = [
          /window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*({[\s\S]+?});\s*$/m,
          /mosaic-provider-jobcards["\s]*[=:]\s*({[\s\S]+?});\s*$/m,
        ];

        for (const pattern of patterns) {
          const match = content.match(pattern);
          if (match) {
            const data = JSON.parse(match[1]);
            const results =
              data?.metaData?.mosaicProviderJobCardsModel?.results ||
              data?.results ||
              [];
            for (const result of results) {
              if (result.company && result.title) {
                jobs.push({
                  title: stripHTML(result.title || ""),
                  company: stripHTML(result.company || ""),
                  location: stripHTML(
                    result.formattedLocation || result.location || ""
                  ),
                  description: stripHTML(
                    result.snippet ||
                      result.jobSnippet?.text ||
                      result.description ||
                      ""
                  ),
                  url: result.jobkey
                    ? `https://www.indeed.com/viewjob?jk=${result.jobkey}`
                    : "",
                  source: "indeed",
                  detectedAt: result.pubDate || new Date().toISOString(),
                });
              }
            }
            if (jobs.length > 0) return false;
          }
        }
      } catch {
        // JSON parsing failed
      }
    }
  });

  if (jobs.length > 0) return jobs;

  const cardSelectors = [
    "[data-jk]",
    ".job_seen_beacon",
    ".cardOutline",
    ".resultContent",
    'div[class*="jobCard"]',
  ];

  for (const selector of cardSelectors) {
    $(selector).each((_, el) => {
      const $el = $(el);
      const jobKey =
        $el.attr("data-jk") ||
        $el.closest("[data-jk]").attr("data-jk") ||
        "";

      const title =
        $el.find(".jobTitle span").first().text().trim() ||
        $el.find("h2 span").first().text().trim() ||
        $el.find("h2 a").first().text().trim() ||
        $el.find("h2").first().text().trim();

      const company =
        $el.find('[data-testid="company-name"]').text().trim() ||
        $el.find(".companyName").text().trim() ||
        $el.find('[class*="company"]').first().text().trim();

      const location =
        $el.find('[data-testid="text-location"]').text().trim() ||
        $el.find(".companyLocation").text().trim() ||
        $el.find('[class*="location"]').first().text().trim();

      const description =
        $el.find(".job-snippet").text().trim() ||
        $el.find('[class*="snippet"]').first().text().trim() ||
        $el.find(".underShelfFooter").text().trim();

      if (title && company) {
        jobs.push({
          title,
          company,
          location,
          description,
          url: jobKey
            ? `https://www.indeed.com/viewjob?jk=${jobKey}`
            : "",
          source: "indeed",
          detectedAt: new Date().toISOString(),
        });
      }
    });

    if (jobs.length > 0) break;
  }

  if (jobs.length > 0) return jobs;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        if (item["@type"] === "ItemList" && item.itemListElement) {
          for (const entry of item.itemListElement) {
            const posting = entry.item || entry;
            if (posting["@type"] === "JobPosting") {
              pushJobPosting(jobs, posting);
            }
          }
        }
        if (item["@type"] === "JobPosting") {
          pushJobPosting(jobs, item);
        }
      }
    } catch {
      // JSON-LD parsing failed
    }
  });

  return jobs;
}

function pushJobPosting(
  jobs: ScrapedJob[],
  posting: Record<string, unknown>
): void {
  const org = posting.hiringOrganization as
    | Record<string, unknown>
    | undefined;
  const loc = posting.jobLocation as Record<string, unknown> | undefined;
  const addr = loc?.address as Record<string, unknown> | undefined;

  const company = (org?.name as string) || "";
  const title = (posting.title as string) || "";

  if (company && title) {
    jobs.push({
      title,
      company,
      location: [addr?.addressLocality, addr?.addressRegion]
        .filter(Boolean)
        .join(", "),
      description: stripHTML((posting.description as string) || ""),
      url: (posting.url as string) || "",
      source: "indeed",
      detectedAt:
        (posting.datePosted as string) || new Date().toISOString(),
    });
  }
}

// ── Bundled data loader ─────────────────────────────────────────────
// Loads pre-scraped real job data from bundled file.
// Used as primary source when live API calls are blocked by network proxy.

function loadBundledJobs(): ScrapedJob[] {
  return SCRAPED_JOBS.map((record: ScrapedJobRecord) => ({
    title: record.title,
    company: record.company,
    location: record.location,
    description: record.description,
    url: record.url,
    source: record.source,
    detectedAt: record.detectedAt,
  }));
}

// ── Salesforce Relevance Filter ──────────────────────────────────────
// Ensures only jobs where Salesforce is a PRIMARY requirement make it through.
// Filters out jobs where Salesforce is just a "bonus", "nice-to-have", etc.

const DISQUALIFYING_PATTERNS = [
  // "Salesforce experience is a bonus/plus/nice-to-have/not required/not mandatory/..."
  /salesforce\s+(?:experience|knowledge|skills?|certification|familiarity|expertise)?\s*(?:(?:is|would\s+be|are)\s+)?(?:a\s+)?(?:bonus|plus|nice[- ]to[- ]have|preferred|optional|helpful|desirable|an?\s+(?:advantage|asset)|not\s+(?:required|mandatory|necessary|essential))/i,
  // "bonus/plus/nice-to-have: ... Salesforce"
  /(?:bonus|plus|nice[- ]to[- ]have|preferred(?:\s+but\s+not\s+required)?|optional|helpful|desirable|ideally)[:\s,][^.;]*salesforce/i,
  // "Salesforce ... [but] not required/mandatory/necessary/essential" (with or without "but")
  /salesforce[^.;]{0,80}\bnot\s+(?:required|necessary|essential|mandatory)\b/i,
  // Weak mention: "exposure to / familiarity with Salesforce" as a bonus
  /(?:exposure|familiarity)\s+(?:to|with)\s+[^.;]*salesforce[^.;]*(?:(?:is|would\s+be)\s+)?(?:a\s+)?(?:bonus|plus|helpful|preferred|nice[- ]to[- ]have)/i,
];

const QUALIFYING_PATTERNS = [
  // Role-specific: "Salesforce admin/developer/engineer"
  /salesforce\s+(?:admin|administrator|developer|engineer|architect|consultant|specialist|analyst)/i,
  // Platform ownership: "manage/own/administer ... Salesforce"
  /(?:manage|administer|own|maintain|build|implement|configure|customize|optimize|oversee)\s+[^.;]*salesforce/i,
  // Salesforce platform context
  /salesforce\s+(?:platform|instance|environment|ecosystem|org\b|organization|deployment|implementation|migration|integration|configuration)/i,
  // Required experience: "X+ years Salesforce"
  /\d+\+?\s*years?\s+(?:of\s+)?salesforce/i,
  // Explicit requirement: "Salesforce experience required"
  /salesforce\s+(?:experience|knowledge|expertise)\s+(?:is\s+)?(?:required|essential|mandatory|necessary)/i,
  // Certification
  /salesforce\s+certif/i,
  // Core tools: "Sales Cloud, Apex, Lightning"
  /(?:sales\s+cloud|service\s+cloud|apex|lightning|soql|visualforce|flow\s+builder)/i,
];

// Dedicated Salesforce role titles — these are what we want
const DEDICATED_SF_TITLE = /\b(?:salesforce|sfdc)\s+(?:admin|administrator|developer|engineer|architect|consultant|specialist|analyst|manager|lead|coordinator)\b/i;

// Roles where "Salesforce" appears in the title but the job is NOT a dedicated SF role.
// e.g. "AWS Solutions Architect (Salesforce Integration)" or "Java Developer - Salesforce Team"
const NON_SF_PRIMARY_TITLE = /\b(?:aws|azure|gcp|java|\.net|python|ruby|php|angular|react|node\.?js|devops|data\s+(?:engineer|scientist)|machine\s+learning|security|network|infrastructure|support\s+(?:engineer|specialist)|help\s+desk|desktop|hardware)\b/i;

export function isSalesforcePrimaryRole(job: ScrapedJob): boolean {
  const title = job.title.toLowerCase();
  const desc = (job.description || "").toLowerCase();

  // Title explicitly mentions Salesforce or SFDC
  if (title.includes("salesforce") || title.includes("sfdc")) {
    // Check if it's a dedicated SF role title (e.g. "Salesforce Admin", "SFDC Developer")
    if (DEDICATED_SF_TITLE.test(title)) {
      return true;
    }
    // Title contains "Salesforce" but is actually a non-SF role → reject
    // e.g. "AWS Solutions Architect (Salesforce Integration)"
    if (NON_SF_PRIMARY_TITLE.test(title)) {
      return false;
    }
    // Ambiguous title with "Salesforce" — fall through to description checks
  }

  const text = `${title} ${desc}`;

  // Salesforce not mentioned at all → not relevant
  if (!text.includes("salesforce") && !text.includes("sfdc")) {
    return false;
  }

  // Salesforce is in the description but not a clear title match.
  // High bar: must have qualifying context AND no disqualifying context.
  const hasDisqualifying = DISQUALIFYING_PATTERNS.some((p) => p.test(desc));
  const qualifyingCount = QUALIFYING_PATTERNS.filter((p) => p.test(desc)).length;

  // Disqualifying language present → require strong qualifying evidence
  // (at least 2 independent qualifying signals to override the negative)
  if (hasDisqualifying) {
    return qualifyingCount >= 2;
  }

  // No qualifying context at all (just a passing mention) → reject
  if (qualifyingCount === 0) {
    return false;
  }

  return true;
}

// ── Public API ──────────────────────────────────────────────────────

export async function scrapeJobs(
  forceRefresh = false
): Promise<ScrapedJob[]> {
  // Return cached results if fresh
  if (
    !forceRefresh &&
    cachedJobs &&
    Date.now() - cacheTimestamp < CACHE_TTL
  ) {
    log.info("Returning cached results", { count: cachedJobs.length });
    return cachedJobs;
  }

  const timer = log.time("scrape-all");
  log.info("Starting multi-source job scrape");

  // Run ALL live sources in parallel (including EarnBetter)
  const results = await Promise.allSettled([
    fetchRemoteOK(),
    fetchArbeitnow(),
    fetchJobicy(),
    fetchHimalayas(),
    fetchGoogleJobs(),
    fetchEarnBetter(),
    fetchIndeed(),
  ]);

  const sourceNames = ["RemoteOK", "Arbeitnow", "Jobicy", "Himalayas", "Google Jobs", "EarnBetter", "Indeed"];
  const allJobs: ScrapedJob[] = [];
  const sourceCounts: Record<string, number> = {};

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allJobs.push(...result.value);
      sourceCounts[sourceNames[i]] = result.value.length;
    } else if (result.status === "rejected") {
      log.warn(`${sourceNames[i]} rejected`, { error: String(result.reason) });
    }
  });

  // ALWAYS merge bundled data so we have a solid baseline even when
  // live APIs return partial results.  Dedup below handles overlaps.
  const bundled = loadBundledJobs();
  const liveCount = allJobs.length;
  allJobs.push(...bundled);
  sourceCounts["bundled"] = bundled.length;

  if (liveCount === 0) {
    log.info("Live APIs returned 0 — using bundled data only", { bundled: bundled.length });
  } else {
    log.info("Merging live + bundled data", { live: liveCount, bundled: bundled.length });
  }

  // ── Accumulate into persistent store ────────────────────────────
  // Instead of replacing the dataset, merge fresh jobs with previously
  // seen ones.  This prevents leads from vanishing when a source is
  // temporarily down or returns different results between scrapes.
  const accumulated = mergeIntoStore(allJobs);

  // Filter: only keep jobs where Salesforce is a PRIMARY requirement
  const relevant = accumulated.filter((job) => {
    const pass = isSalesforcePrimaryRole(job);
    if (!pass) {
      log.debug(`Rejected (not primary SF role)`, {
        title: job.title,
        company: job.company,
      });
    }
    return pass;
  });

  timer.end("Scrape complete", {
    sources: sourceCounts,
    freshJobs: allJobs.length,
    accumulated: accumulated.length,
    relevant: relevant.length,
    filtered: accumulated.length - relevant.length,
    storeSize: jobStore.size,
  });

  // Cache results
  if (relevant.length > 0) {
    cachedJobs = relevant;
    cacheTimestamp = Date.now();
  }

  return relevant;
}

// ── Health Check ────────────────────────────────────────────────────
// Free APIs get an actual data fetch to verify they return results.
// SerpAPI sources get an account check only (no quota burn).
// Scraped sites (Indeed, EarnBetter) get a reachability probe only.

export interface SourceHealthResult {
  name: string;
  status: "ok" | "warn" | "error" | "skipped";
  latencyMs: number;
  jobCount: number;
  error?: string;
  details?: string;
}

/** Lightweight HEAD/GET probe — just checks if the host is reachable. */
async function probeUrl(url: string, timeoutMs = 6000): Promise<{ ok: boolean; status: number; ms: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HealthCheck/1.0)" },
    });
    clearTimeout(timeout);
    return { ok: resp.status < 400, status: resp.status, ms: Date.now() - start };
  } catch {
    clearTimeout(timeout);
    return { ok: false, status: 0, ms: Date.now() - start };
  }
}

/** Count jobs in the persistent store matching a given source key. */
function countStoreJobs(sourceKey: string): number {
  return Array.from(jobStore.values()).filter((j) =>
    j.source.toLowerCase().replace(/[^a-z]/g, "").includes(sourceKey)
  ).length;
}

export async function checkSourceHealth(): Promise<{
  sources: SourceHealthResult[];
  storeSize: number;
  cacheAge: number | null;
  serpApiQuota: { exhausted: boolean; error: string | null; detectedAt: number | null };
}> {
  // For free APIs, actually fetch data to verify they return results.
  // For paid APIs (SerpAPI), only check the account endpoint (no quota burn).
  // For scraped sites (Indeed), just probe reachability.

  type Probe = {
    name: string;
    url: string;
    storeSourceKey: string;
    mode: "fetch-json" | "serpapi-account" | "probe-only";
    countFn?: (data: unknown) => number;
  };

  const probes: Probe[] = [
    {
      name: "RemoteOK",
      url: "https://remoteok.com/api?tag=salesforce&api=1",
      storeSourceKey: "remoteok",
      mode: "fetch-json",
      countFn: (data) => (Array.isArray(data) ? Math.max(0, data.length - 1) : 0),
    },
    {
      name: "Arbeitnow",
      url: "https://www.arbeitnow.com/api/job-board-api?search=salesforce",
      storeSourceKey: "arbeitnow",
      mode: "fetch-json",
      countFn: (data) => {
        const d = data as Record<string, unknown>;
        return Array.isArray(d?.data) ? d.data.length : 0;
      },
    },
    {
      name: "Jobicy",
      url: "https://jobicy.com/api/v2/remote-jobs?tag=salesforce&count=50",
      storeSourceKey: "jobicy",
      mode: "fetch-json",
      countFn: (data) => {
        const d = data as Record<string, unknown>;
        return Array.isArray(d?.jobs) ? d.jobs.length : 0;
      },
    },
    {
      name: "Himalayas",
      url: "https://himalayas.app/jobs/api?q=salesforce&limit=50",
      storeSourceKey: "himalayas",
      mode: "fetch-json",
      countFn: (data) => {
        const d = data as Record<string, unknown>;
        return Array.isArray(d?.jobs) ? d.jobs.length : 0;
      },
    },
    {
      name: "Google Jobs (SerpAPI)",
      url: "https://serpapi.com/account.json",
      storeSourceKey: "googlejobs",
      mode: "serpapi-account",
    },
    {
      name: "EarnBetter",
      url: "https://earnbetter.com/",
      storeSourceKey: "earnbetter",
      mode: "probe-only",
    },
    {
      name: "Indeed",
      url: "https://www.indeed.com/",
      storeSourceKey: "indeed",
      mode: "probe-only",
    },
  ];

  const results = await Promise.allSettled(
    probes.map(async (probe): Promise<SourceHealthResult> => {
      // ── SerpAPI account check (free, no search cost) ──────────
      if (probe.mode === "serpapi-account") {
        if (!process.env.SERPAPI_KEY) {
          return { name: probe.name, status: "skipped", latencyMs: 0, jobCount: 0, error: "No SERPAPI_KEY configured" };
        }
        const url = `${probe.url}?api_key=${process.env.SERPAPI_KEY}`;
        const start = Date.now();
        try {
          const resp = await fetch(url, {
            headers: { Accept: "application/json" },
            signal: AbortSignal.timeout(6000),
          });
          const ms = Date.now() - start;
          if (!resp.ok) {
            return { name: probe.name, status: "error", latencyMs: ms, jobCount: 0, error: `HTTP ${resp.status}` };
          }
          const acct = (await resp.json()) as Record<string, unknown>;
          const remaining = acct.total_searches_left ?? acct.plan_searches_left;
          const used = acct.this_month_usage ?? acct.total_searches_used;
          const storeJobs = countStoreJobs(probe.storeSourceKey);
          return {
            name: probe.name,
            status: storeJobs > 0 || (typeof remaining === "number" && remaining > 0) ? "ok" : "warn",
            latencyMs: ms,
            jobCount: storeJobs,
            details: remaining !== undefined
              ? `${remaining} searches remaining (${used ?? "?"} used)${storeJobs > 0 ? `, ${storeJobs} jobs in store` : ""}`
              : `${storeJobs} jobs in store`,
          };
        } catch {
          return { name: probe.name, status: "error", latencyMs: Date.now() - start, jobCount: 0, error: "Unreachable" };
        }
      }

      // ── Actual data fetch for free APIs ───────────────────────
      if (probe.mode === "fetch-json" && probe.countFn) {
        const start = Date.now();
        try {
          const data = await fetchJSON(probe.url, 8000);
          const ms = Date.now() - start;
          const liveCount = probe.countFn(data);
          const storeJobs = countStoreJobs(probe.storeSourceKey);
          return {
            name: probe.name,
            status: liveCount > 0 || storeJobs > 0 ? "ok" : "warn",
            latencyMs: ms,
            jobCount: Math.max(liveCount, storeJobs),
            details: liveCount > 0
              ? `${liveCount} jobs available live${storeJobs > 0 ? `, ${storeJobs} in store` : ""}`
              : storeJobs > 0
                ? `API returned 0 jobs for "salesforce" today, ${storeJobs} in store from previous scrapes`
                : `API returned 0 jobs for "salesforce" — niche boards may have sparse coverage`,
          };
        } catch (err) {
          const ms = Date.now() - start;
          const storeJobs = countStoreJobs(probe.storeSourceKey);
          const errMsg = String(err);
          return {
            name: probe.name,
            status: storeJobs > 0 ? "warn" : "error",
            latencyMs: ms,
            jobCount: storeJobs,
            error: errMsg.includes("HTTP") ? errMsg.split(" from ")[0] : "Fetch failed",
            details: storeJobs > 0 ? `${storeJobs} jobs still available from store` : undefined,
          };
        }
      }

      // ── Probe-only (EarnBetter, Indeed) ───────────────────────
      const { ok, status, ms } = await probeUrl(probe.url);
      const storeJobs = countStoreJobs(probe.storeSourceKey);

      if (!ok) {
        // Indeed commonly blocks serverless IPs — this is expected
        const isIndeed = probe.name === "Indeed";
        return {
          name: probe.name,
          status: storeJobs > 0 ? "warn" : (isIndeed ? "warn" : "error"),
          latencyMs: ms,
          jobCount: storeJobs,
          error: status > 0 ? `HTTP ${status}` : "Unreachable",
          details: isIndeed && status === 403
            ? `Indeed blocks serverless IPs (expected)${storeJobs > 0 ? `, ${storeJobs} jobs from bundled data` : ""}`
            : storeJobs > 0 ? `${storeJobs} jobs still available from store` : undefined,
        };
      }

      return {
        name: probe.name,
        status: storeJobs > 0 ? "ok" : "warn",
        latencyMs: ms,
        jobCount: storeJobs,
        details: storeJobs > 0
          ? `Reachable, ${storeJobs} jobs in store`
          : `Reachable — jobs populate after first data refresh`,
      };
    })
  );

  // Bundled data
  const bundled = loadBundledJobs();
  const sourceResults: SourceHealthResult[] = results.map((r) =>
    r.status === "fulfilled" ? r.value : { name: "Unknown", status: "error" as const, latencyMs: 0, jobCount: 0, error: String(r.reason) }
  );
  sourceResults.push({
    name: "Bundled Data",
    status: bundled.length > 0 ? "ok" : "error",
    latencyMs: 0,
    jobCount: bundled.length,
    details: `${bundled.length} pre-loaded Salesforce job postings`,
  });

  return {
    sources: sourceResults,
    storeSize: jobStore.size,
    cacheAge: cachedJobs ? Date.now() - cacheTimestamp : null,
    serpApiQuota: getSerpApiQuotaStatus(),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function stripHTML(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
