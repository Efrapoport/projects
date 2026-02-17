import * as cheerio from "cheerio";
import { SignalSource } from "./types";
import { SCRAPED_JOBS, ScrapedJobRecord } from "./scraped-jobs-data";

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

    console.log(`[scraper:remoteok] Found ${jobs.length} jobs`);
  } catch (error) {
    console.warn("[scraper:remoteok] Failed:", error);
  }

  return jobs;
}

// ── Source 2: Arbeitnow ─────────────────────────────────────────────

async function fetchArbeitnow(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

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

    console.log(`[scraper:arbeitnow] Found ${jobs.length} jobs`);
  } catch (error) {
    console.warn("[scraper:arbeitnow] Failed:", error);
  }

  return jobs;
}

// ── Source 3: Jobicy ────────────────────────────────────────────────

async function fetchJobicy(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

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

    console.log(`[scraper:jobicy] Found ${jobs.length} jobs`);
  } catch (error) {
    console.warn("[scraper:jobicy] Failed:", error);
  }

  return jobs;
}

// ── Source 4: Himalayas ─────────────────────────────────────────────

async function fetchHimalayas(): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = [];

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

    console.log(`[scraper:himalayas] Found ${jobs.length} jobs`);
  } catch (error) {
    console.warn("[scraper:himalayas] Failed:", error);
  }

  return jobs;
}

// ── Source 5: Indeed (HTML scraping) ─────────────────────────────────

async function fetchIndeed(): Promise<ScrapedJob[]> {
  const allJobs: ScrapedJob[] = [];
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
      console.warn(`[scraper:indeed] Query "${query}" failed:`, error);
    }
  }

  console.log(`[scraper:indeed] Found ${allJobs.length} jobs`);
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
  // "Salesforce is a bonus/plus/nice-to-have"
  /salesforce\s+(?:experience|knowledge|skills?|certification|familiarity|expertise)?\s*(?:is\s+)?(?:a\s+)?(?:bonus|plus|nice[- ]to[- ]have|preferred|optional|helpful|desirable|not required)/i,
  // "bonus/plus/nice-to-have: ... Salesforce"
  /(?:bonus|plus|nice[- ]to[- ]have|preferred(?:\s+but\s+not\s+required)?|optional|helpful|desirable|ideally)[:\s,][^.;]*salesforce/i,
  // "Salesforce ... but not required/necessary"
  /salesforce[^.;]*but\s+not\s+(?:required|necessary|essential|mandatory)/i,
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

export function isSalesforcePrimaryRole(job: ScrapedJob): boolean {
  const title = job.title.toLowerCase();
  const desc = (job.description || "").toLowerCase();

  // Title explicitly mentions Salesforce → clearly a SF role
  if (title.includes("salesforce") || title.includes("sfdc")) {
    return true;
  }

  const text = `${title} ${desc}`;

  // Salesforce not mentioned at all → not relevant
  if (!text.includes("salesforce") && !text.includes("sfdc")) {
    return false;
  }

  // Salesforce is in the description but not the title.
  // High bar: must have qualifying context AND no disqualifying context.
  const hasDisqualifying = DISQUALIFYING_PATTERNS.some((p) => p.test(desc));
  const hasQualifying = QUALIFYING_PATTERNS.some((p) => p.test(desc));

  // Disqualifying language without strong qualifying context → reject
  if (hasDisqualifying && !hasQualifying) {
    return false;
  }

  // No qualifying context at all (just a passing mention) → reject
  if (!hasQualifying) {
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
    console.log("[scraper] Returning cached results");
    return cachedJobs;
  }

  console.log("[scraper] Starting multi-source job scrape...");

  // Run ALL live sources in parallel
  const results = await Promise.allSettled([
    fetchRemoteOK(),
    fetchArbeitnow(),
    fetchJobicy(),
    fetchHimalayas(),
    fetchIndeed(),
  ]);

  const sourceNames = ["RemoteOK", "Arbeitnow", "Jobicy", "Himalayas", "Indeed"];
  const allJobs: ScrapedJob[] = [];
  const sourceCounts: Record<string, number> = {};

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      allJobs.push(...result.value);
      sourceCounts[sourceNames[i]] = result.value.length;
    } else if (result.status === "rejected") {
      console.warn(`[scraper] ${sourceNames[i]} rejected:`, result.reason);
    }
  });

  // If live scraping returned nothing (e.g. network blocked), use bundled data
  if (allJobs.length === 0) {
    const bundled = loadBundledJobs();
    console.log(
      `[scraper] Live APIs returned 0 results — loading ${bundled.length} pre-scraped jobs from bundled data`
    );
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
      console.log(
        `[scraper:filter] Rejected (not primary SF role): "${job.title}" at ${job.company}`
      );
    }
    return pass;
  });

  console.log(
    `[scraper] Results: ${JSON.stringify(sourceCounts)} → ${allJobs.length} total, ${unique.length} unique, ${relevant.length} relevant (${unique.length - relevant.length} filtered out)`
  );

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
