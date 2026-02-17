// ── Data Integrity Validation Service ────────────────────────────────
// Validates company URLs to ensure they're real and accessible.
// Replaces invented URLs with safe search-based fallbacks when invalid.

import { createLogger } from "./logger";

const log = createLogger("data-integrity");

// ── URL Validation Cache ─────────────────────────────────────────────

interface UrlCheckResult {
  valid: boolean;
  statusCode?: number;
  checkedAt: number;
}

const urlCache = new Map<string, UrlCheckResult>();
const URL_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Check if a URL is accessible via HEAD request.
 * Results are cached for 1 hour.
 */
async function checkUrl(
  url: string,
  timeoutMs = 4000
): Promise<{ valid: boolean; statusCode?: number }> {
  if (!url || !url.startsWith("http")) return { valid: false };

  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.checkedAt < URL_CACHE_TTL) {
    return { valid: cached.valid, statusCode: cached.statusCode };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
    });

    clearTimeout(timeout);

    // Accept 2xx and 3xx as valid
    const valid = response.status >= 200 && response.status < 400;
    urlCache.set(url, { valid, statusCode: response.status, checkedAt: Date.now() });
    return { valid, statusCode: response.status };
  } catch {
    urlCache.set(url, { valid: false, checkedAt: Date.now() });
    return { valid: false };
  }
}

// ── Safe URL Builders ────────────────────────────────────────────────
// These generate URLs that ALWAYS work, regardless of company name.

/**
 * Build a LinkedIn company search URL (always works).
 * Instead of guessing `linkedin.com/company/{slug}` (which often lands
 * on the wrong company), this opens a search that the user can refine.
 */
export function safeLinkedInUrl(companyName: string): string {
  return `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;
}

/**
 * Build a Google search URL for a company (always works).
 */
export function safeCompanySearchUrl(companyName: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName + " company official website")}`;
}

// ── Company URL Validation ───────────────────────────────────────────

export interface CompanyUrlValidation {
  website: string;
  websiteVerified: boolean;
  linkedinUrl: string;
  domain: string;
  employeeCount: number;
}

/**
 * Validate a single company's URLs.
 * Tries the inferred website with a HEAD request; falls back to Google search.
 * LinkedIn always uses search (safe).
 */
export async function validateCompanyUrls(
  companyName: string,
  inferredSlug: string
): Promise<CompanyUrlValidation> {
  const candidateUrl = `https://${inferredSlug}.com`;
  const { valid: websiteValid, statusCode } = await checkUrl(candidateUrl);

  log.debug(`URL check: "${companyName}"`, {
    candidate: candidateUrl,
    valid: websiteValid,
    statusCode,
  });

  return {
    website: websiteValid ? candidateUrl : safeCompanySearchUrl(companyName),
    websiteVerified: websiteValid,
    linkedinUrl: safeLinkedInUrl(companyName),
    domain: websiteValid ? `${inferredSlug}.com` : "",
    employeeCount: 0,
  };
}

/**
 * Batch validate company URLs with concurrency limit.
 * Returns a map keyed by lowercase company name.
 */
export async function batchValidateCompanyUrls(
  companies: Array<{ name: string; slug: string }>,
  timeoutMs = 8000
): Promise<Map<string, CompanyUrlValidation>> {
  const timer = log.time("batch-url-validation");
  const results = new Map<string, CompanyUrlValidation>();
  const CONCURRENCY = 5;

  // Wrap entire batch in a timeout so it doesn't block the response
  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );

  const validationPromise = (async () => {
    for (let i = 0; i < companies.length; i += CONCURRENCY) {
      const batch = companies.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((c) => validateCompanyUrls(c.name, c.slug))
      );

      batchResults.forEach((result, j) => {
        const company = batch[j];
        const key = company.name.toLowerCase().trim();

        if (result.status === "fulfilled") {
          results.set(key, result.value);
        } else {
          results.set(key, {
            website: safeCompanySearchUrl(company.name),
            websiteVerified: false,
            linkedinUrl: safeLinkedInUrl(company.name),
            domain: "",
            employeeCount: 0,
          });
        }
      });
    }
    return "done";
  })();

  const winner = await Promise.race([validationPromise, timeoutPromise]);

  if (winner === "timeout") {
    log.warn("URL validation timed out — some companies may use fallback URLs", {
      validated: results.size,
      total: companies.length,
    });

    // Fill in remaining companies with safe fallbacks
    for (const company of companies) {
      const key = company.name.toLowerCase().trim();
      if (!results.has(key)) {
        results.set(key, {
          website: safeCompanySearchUrl(company.name),
          websiteVerified: false,
          linkedinUrl: safeLinkedInUrl(company.name),
          domain: "",
          employeeCount: 0,
        });
      }
    }
  }

  const verified = Array.from(results.values()).filter((v) => v.websiteVerified).length;
  timer.end("Company URL validation complete", {
    total: results.size,
    verified,
    unverified: results.size - verified,
  });

  return results;
}

/**
 * Validate a job posting URL.
 */
export async function validateJobUrl(url: string): Promise<boolean> {
  if (!url) return false;
  const { valid } = await checkUrl(url);
  return valid;
}

// ── Validation Stats ─────────────────────────────────────────────────

export function getValidationCacheStats(): {
  cached: number;
  valid: number;
  invalid: number;
} {
  let valid = 0;
  let invalid = 0;
  for (const result of urlCache.values()) {
    if (result.valid) valid++;
    else invalid++;
  }
  return { cached: urlCache.size, valid, invalid };
}

// ── Company Size Enrichment via SerpAPI ──────────────────────────────
// Uses Google's Knowledge Graph (via SerpAPI) to look up employee counts.
// Falls back to parsing snippets from organic results.

const employeeCache = new Map<string, { count: number; checkedAt: number }>();
const EMPLOYEE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Look up employee count for a single company using SerpAPI.
 * Returns 0 if unavailable.
 */
async function lookupEmployeeCount(companyName: string, apiKey: string): Promise<number> {
  const cacheKey = companyName.toLowerCase().trim();
  const cached = employeeCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_CACHE_TTL) {
    return cached.count;
  }

  try {
    const params = new URLSearchParams({
      engine: "google",
      q: `"${companyName}" company number of employees`,
      api_key: apiKey,
      num: "5",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      employeeCache.set(cacheKey, { count: 0, checkedAt: Date.now() });
      return 0;
    }

    const data = (await response.json()) as Record<string, unknown>;
    let count = 0;

    // 1. Try knowledge_graph — Google often shows employee count here
    const kg = data.knowledge_graph as Record<string, unknown> | undefined;
    if (kg) {
      count = parseEmployeeValue(kg.employees as string | undefined)
        || parseEmployeeValue(kg.number_of_employees as string | undefined)
        || parseEmployeeValue(kg.staff as string | undefined)
        || parseEmployeeValue(kg.size as string | undefined);

      // Sometimes nested under "stats" or "details"
      if (!count) {
        const stats = (kg.stats || kg.details || {}) as Record<string, unknown>;
        count = parseEmployeeValue(stats.employees as string | undefined)
          || parseEmployeeValue(stats.number_of_employees as string | undefined);
      }
    }

    // 2. Try answer_box
    if (!count) {
      const ab = data.answer_box as Record<string, unknown> | undefined;
      if (ab) {
        count = parseEmployeeValue(ab.answer as string | undefined)
          || parseEmployeeValue(ab.snippet as string | undefined);
      }
    }

    // 3. Parse snippets from organic results
    if (!count) {
      const organic = (data.organic_results || []) as Record<string, unknown>[];
      for (const result of organic.slice(0, 5)) {
        const snippet = String(result.snippet || "");
        count = extractEmployeeCountFromText(snippet);
        if (count > 0) break;
      }
    }

    employeeCache.set(cacheKey, { count, checkedAt: Date.now() });
    return count;
  } catch {
    employeeCache.set(cacheKey, { count: 0, checkedAt: Date.now() });
    return 0;
  }
}

/**
 * Parse an employee count from a knowledge graph value.
 * Handles formats like "1,200", "~1200", "1.2K", "1,200 (2024)", etc.
 */
function parseEmployeeValue(value: string | undefined): number {
  if (!value) return 0;
  return extractEmployeeCountFromText(value);
}

/**
 * Extract a number from text that likely represents employee count.
 * Handles: "1,200 employees", "1.2K employees", "500+", "200-500", etc.
 */
function extractEmployeeCountFromText(text: string): number {
  if (!text) return 0;

  // Match patterns like "1,200 employees", "~500 employees", "1.2K employees"
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*[Kk]\s*(?:\+\s*)?employee/,       // "1.2K employees"
    /(\d[\d,]*)\s*(?:\+\s*)?employee/,                          // "1,200 employees"
    /(\d[\d,]*(?:\.\d+)?)\s*[Kk]\s*(?:\+\s*)?(?:staff|workers|people)/i,
    /(\d[\d,]*)\s*(?:\+\s*)?(?:staff|workers|people)/i,
    /employee[s]?\s*(?:count|size|number)?[:\s]+(\d[\d,]*)/i,   // "employees: 1,200"
    /(?:has|have|with|about|approximately|~|around)\s+(\d[\d,]*(?:\.\d+)?)\s*[Kk]?\s*(?:\+\s*)?employee/i,
    /(\d[\d,]*)\s*-\s*(\d[\d,]*)\s*employee/i,                  // range: "200-500 employees"
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // For ranges, use the upper bound
      if (match[2]) {
        return parseNumericValue(match[2]);
      }
      return parseNumericValue(match[1]);
    }
  }

  return 0;
}

function parseNumericValue(str: string): number {
  if (!str) return 0;
  // Handle "1.2K" style
  const kMatch = str.match(/([\d,.]+)\s*[Kk]/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1].replace(/,/g, "")) * 1000);
  }
  // Standard numeric
  const num = parseInt(str.replace(/,/g, ""), 10);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

/**
 * Batch enrich employee counts for a list of companies.
 * Limits to top N companies and respects concurrency limits.
 */
export async function batchEnrichEmployeeCounts(
  companies: Array<{ name: string }>,
  timeoutMs = 15000
): Promise<Map<string, number>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    log.debug("No SERPAPI_KEY — skipping employee count enrichment");
    return new Map();
  }

  const timer = log.time("employee-enrichment");
  const results = new Map<string, number>();
  const MAX_LOOKUPS = 15; // Limit API calls per run
  const CONCURRENCY = 3;

  // Deduplicate and limit
  const unique = new Map<string, string>(); // normalized → original
  for (const c of companies) {
    const key = c.name.toLowerCase().trim();
    if (!unique.has(key)) unique.set(key, c.name);
  }
  const toEnrich = Array.from(unique.entries()).slice(0, MAX_LOOKUPS);

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );

  const enrichPromise = (async () => {
    for (let i = 0; i < toEnrich.length; i += CONCURRENCY) {
      const batch = toEnrich.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(([, name]) => lookupEmployeeCount(name, apiKey))
      );

      batchResults.forEach((result, j) => {
        const key = batch[j][0];
        results.set(key, result.status === "fulfilled" ? result.value : 0);
      });
    }
    return "done";
  })();

  const winner = await Promise.race([enrichPromise, timeoutPromise]);

  if (winner === "timeout") {
    log.warn("Employee enrichment timed out", {
      enriched: results.size,
      total: toEnrich.length,
    });
  }

  const found = Array.from(results.values()).filter((v) => v > 0).length;
  timer.end("Employee count enrichment", {
    total: toEnrich.length,
    found,
    unknown: toEnrich.length - found,
  });

  return results;
}
