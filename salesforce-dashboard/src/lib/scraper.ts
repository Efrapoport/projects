import * as cheerio from "cheerio";

// ── Types ───────────────────────────────────────────────────────────

export interface ScrapedJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: "indeed";
  detectedAt: string;
}

// ── Search Queries ──────────────────────────────────────────────────

const SEARCH_QUERIES = [
  "salesforce administrator",
  "first salesforce admin",
  "salesforce developer greenfield",
  "salesforce implementation specialist",
];

// ── In-Memory Cache ─────────────────────────────────────────────────

let cachedJobs: ScrapedJob[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ── Indeed Scraper ──────────────────────────────────────────────────

async function scrapeIndeedSearch(query: string): Promise<ScrapedJob[]> {
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
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      console.warn(`Indeed returned ${response.status} for query: ${query}`);
      return [];
    }

    const html = await response.text();
    return parseIndeedHTML(html);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn(`Indeed request timed out for query: ${query}`);
    } else {
      console.warn(`Indeed scrape failed for query "${query}":`, error);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function parseIndeedHTML(html: string): ScrapedJob[] {
  const $ = cheerio.load(html);
  const jobs: ScrapedJob[] = [];

  // Strategy 1: Extract from embedded mosaic JSON data
  // Indeed embeds job card data in script tags as window.mosaic.providerData
  $("script").each((_, el) => {
    const content = $(el).html() || "";
    if (
      content.includes("mosaic-provider-jobcards") ||
      content.includes("jobcards")
    ) {
      try {
        // Look for the mosaic provider data pattern
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
            if (jobs.length > 0) return false; // break .each()
          }
        }
      } catch {
        // JSON parsing failed, continue to next strategy
      }
    }
  });

  if (jobs.length > 0) return jobs;

  // Strategy 2: Parse HTML job card elements
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
      const jobKey = $el.attr("data-jk") || $el.closest("[data-jk]").attr("data-jk") || "";

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

  // Strategy 3: JSON-LD structured data
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html() || "";
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // Handle ItemList with JobPosting elements
        if (item["@type"] === "ItemList" && item.itemListElement) {
          for (const entry of item.itemListElement) {
            const posting = entry.item || entry;
            if (posting["@type"] === "JobPosting") {
              pushJobPosting($, jobs, posting);
            }
          }
        }
        // Handle direct JobPosting
        if (item["@type"] === "JobPosting") {
          pushJobPosting($, jobs, item);
        }
      }
    } catch {
      // JSON-LD parsing failed
    }
  });

  return jobs;
}

function pushJobPosting(
  $: cheerio.CheerioAPI,
  jobs: ScrapedJob[],
  posting: Record<string, unknown>
): void {
  const org = posting.hiringOrganization as Record<string, unknown> | undefined;
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
    return cachedJobs;
  }

  console.log("[scraper] Starting job scrape...");
  const allJobs: ScrapedJob[] = [];

  for (const query of SEARCH_QUERIES) {
    try {
      const jobs = await scrapeIndeedSearch(query);
      console.log(
        `[scraper] Query "${query}" returned ${jobs.length} results`
      );
      allJobs.push(...jobs);

      // Rate limit: wait between requests to avoid being blocked
      if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      console.warn(`[scraper] Query "${query}" failed:`, error);
    }
  }

  // Deduplicate by company + title (case-insensitive)
  const seen = new Set<string>();
  const unique = allJobs.filter((job) => {
    const key = `${job.company.toLowerCase().trim()}|${job.title.toLowerCase().trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `[scraper] Total: ${allJobs.length} jobs, ${unique.length} unique`
  );

  // Cache results
  if (unique.length > 0) {
    cachedJobs = unique;
    cacheTimestamp = Date.now();
  }

  return unique;
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
