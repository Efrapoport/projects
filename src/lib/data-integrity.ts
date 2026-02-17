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
