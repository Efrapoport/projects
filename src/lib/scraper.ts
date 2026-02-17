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

// ── In-Memory Cache ─────────────────────────────────────────────────

let cachedJobs: ScrapedJob[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

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

// ── Source 6: EarnBetter (via SerpAPI) ──────────────────────────────
// EarnBetter.com blocks direct scraping (403). We fetch their listings
// via SerpAPI Google Jobs, which indexes EarnBetter postings.
// Also attempts direct HTML fetch as a bonus.

async function fetchEarnBetter(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];
  const timer = log.time("earnbetter");

  // Strategy 1: Try direct HTML fetch (EarnBetter may allow server-side)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://earnbetter.com/app/job/browse/?q=salesforce", {
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
      jobs.push(...parsed);
      log.info(`EarnBetter direct scrape succeeded`, { count: parsed.length });
    } else {
      log.debug(`EarnBetter direct fetch returned ${response.status}`);
    }
  } catch (error) {
    log.debug("EarnBetter direct fetch failed (expected)", { error: String(error) });
  }

  // Strategy 2: Via SerpAPI Google Jobs with earnbetter-specific queries
  const apiKey = process.env.SERPAPI_KEY;
  if (apiKey && jobs.length === 0) {
    try {
      const params = new URLSearchParams({
        engine: "google_jobs",
        q: "salesforce administrator earnbetter",
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
        const via = String(item.via || "").toLowerCase();

        if (!company || !title) continue;

        // Only include results that are actually from EarnBetter
        const isFromEarnBetter = via.includes("earnbetter") ||
          String(item.description || "").toLowerCase().includes("earnbetter");

        let description = String(item.description || "");
        const highlights = item.job_highlights as Record<string, unknown>[] | undefined;
        if (highlights && Array.isArray(highlights)) {
          const snippets = highlights
            .flatMap((h) => (h.items as string[]) || [])
            .join(" ");
          if (snippets) description = description || snippets;
        }

        const applyOptions = (item.apply_options || []) as Record<string, unknown>[];
        const applyLink = applyOptions[0]?.link ? String(applyOptions[0].link) : "";
        const extensions = (item.detected_extensions || {}) as Record<string, unknown>;
        const postedAt = extensions.posted_at ? String(extensions.posted_at) : "";

        jobs.push({
          title,
          company,
          location: String(item.location || ""),
          description: stripHTML(description).slice(0, 1000),
          url: applyLink || `https://earnbetter.com/app/job/browse/?q=${encodeURIComponent(title)}`,
          source: isFromEarnBetter ? "earnbetter" : "google_jobs",
          detectedAt: postedAtToISO(postedAt),
        });
      }

      log.info(`EarnBetter via SerpAPI`, { results: results.length, kept: jobs.length });
    } catch (error) {
      log.warn("EarnBetter SerpAPI query failed", { error: String(error) });
    }
  }

  timer.end(`EarnBetter total`, { count: jobs.length });
  return jobs;
}

function parseEarnBetterHTML(html: string): ScrapedJob[] {
  const $ = cheerio.load(html);
  const jobs: ScrapedJob[] = [];

  // Try to find job cards in the HTML
  // EarnBetter is a React SPA, so HTML may contain JSON data or rendered cards
  $("script").each((_, el) => {
    const content = $(el).html() || "";
    // Look for embedded job data in __NEXT_DATA__ or similar
    if (content.includes("__NEXT_DATA__") || content.includes("jobs")) {
      try {
        const dataMatch = content.match(/__NEXT_DATA__\s*=\s*({[\s\S]+?})\s*;?\s*$/m);
        if (dataMatch) {
          const data = JSON.parse(dataMatch[1]);
          const pageProps = data?.props?.pageProps || {};
          const jobList = pageProps.jobs || pageProps.results || [];

          for (const job of jobList) {
            const title = String(job.title || job.jobTitle || "").trim();
            const company = String(job.company || job.companyName || "").trim();

            if (title && company) {
              jobs.push({
                title,
                company,
                location: String(job.location || ""),
                description: stripHTML(String(job.description || job.snippet || "")),
                url: job.url || job.applyUrl || "",
                source: "earnbetter",
                detectedAt: String(job.postedAt || job.createdAt || new Date().toISOString()),
              });
            }
          }
        }
      } catch {
        // JSON parsing failed
      }
    }
  });

  // Also try standard card selectors
  if (jobs.length === 0) {
    $('[class*="job"], [class*="Job"], [data-testid*="job"]').each((_, el) => {
      const $el = $(el);
      const title = $el.find("h2, h3, [class*='title']").first().text().trim();
      const company = $el.find("[class*='company']").first().text().trim();

      if (title && company) {
        jobs.push({
          title,
          company,
          location: $el.find("[class*='location']").first().text().trim(),
          description: $el.find("[class*='description'], [class*='snippet']").first().text().trim(),
          url: $el.find("a").first().attr("href") || "",
          source: "earnbetter",
          detectedAt: new Date().toISOString(),
        });
      }
    });
  }

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

  // If live scraping returned nothing (e.g. network blocked), use bundled data
  if (allJobs.length === 0) {
    const bundled = loadBundledJobs();
    log.info(`Live APIs returned 0 — loading bundled data`, { count: bundled.length });
    allJobs.push(...bundled);
    sourceCounts["bundled"] = bundled.length;
  }

  // Deduplicate by company + title (case-insensitive)
  const seen = new Set<string>();
  const unique = allJobs.filter((job) => {
    const key = `${job.company.toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter: only keep jobs where Salesforce is a PRIMARY requirement
  const relevant = unique.filter((job) => {
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
    total: allJobs.length,
    unique: unique.length,
    relevant: relevant.length,
    filtered: unique.length - relevant.length,
  });

  // Cache results
  if (relevant.length > 0) {
    cachedJobs = relevant;
    cacheTimestamp = Date.now();
  }

  return relevant;
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
