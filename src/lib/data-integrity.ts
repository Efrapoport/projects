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
  timeoutMs = 6000
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

// ── Company Size Enrichment ──────────────────────────────────────────
// Two-source waterfall for employee count enrichment:
//   1. Google Knowledge Graph Search API (free, 100 req/day, 3000/month)
//   2. SerpAPI Google Search (paid, thousands of searches)
// Falls back to parsing snippets from organic results and job descriptions.

const employeeCache = new Map<string, { count: number; source: string; checkedAt: number }>();
const EMPLOYEE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Google Knowledge Graph Search API ───────────────────────────────
// Native Google API — free tier: 100 requests/day (3,000/month).
// Returns structured entity data including employee counts for
// well-known companies. Requires a Google Cloud API key.
// Docs: https://developers.google.com/knowledge-graph

interface KgSearchResult {
  result?: {
    name?: string;
    description?: string;
    detailedDescription?: {
      articleBody?: string;
      url?: string;
    };
    [key: string]: unknown;
  };
  resultScore?: number;
}

/**
 * Look up employee count via Google Knowledge Graph Search API.
 * Returns { count, found } — count=0 if not found.
 */
async function lookupEmployeeCountViaGoogleKG(
  companyName: string,
  apiKey: string
): Promise<{ count: number; found: boolean }> {
  try {
    const params = new URLSearchParams({
      query: companyName,
      key: apiKey,
      limit: "3",
      types: "Organization,Corporation,Company",
      indent: "false",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://kgsearch.googleapis.com/v1/entities:search?${params.toString()}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429) {
        log.warn("Google KG API rate limit hit", { company: companyName, status: response.status });
      }
      return { count: 0, found: false };
    }

    const data = (await response.json()) as { itemListElement?: KgSearchResult[] };
    const items = data.itemListElement || [];

    for (const item of items) {
      const entity = item.result;
      if (!entity) continue;

      // Check if this entity matches our company (fuzzy match on name)
      const entityName = (entity.name || "").toLowerCase();
      const queryName = companyName.toLowerCase();
      if (!entityName.includes(queryName) && !queryName.includes(entityName)) {
        continue;
      }

      // Try to extract employee count from the detailed description
      const articleBody = entity.detailedDescription?.articleBody || "";
      let count = extractEmployeeCountFromText(articleBody);

      // Also try any other string fields that might contain employee info
      if (!count) {
        for (const [key, value] of Object.entries(entity)) {
          if (typeof value === "string" && key !== "name" && key !== "url") {
            count = extractEmployeeCountFromText(value);
            if (count > 0) break;
          }
        }
      }

      if (count > 0) {
        log.debug(`Google KG found employee count for "${companyName}"`, {
          entityName: entity.name,
          count,
          score: item.resultScore,
        });
        return { count, found: true };
      }
    }

    return { count: 0, found: false };
  } catch (err) {
    log.debug(`Google KG lookup failed for "${companyName}"`, { error: String(err) });
    return { count: 0, found: false };
  }
}

/**
 * Look up employee count for a single company using SerpAPI.
 * Returns 0 if unavailable.
 */
async function lookupEmployeeCountViaSerpApi(companyName: string, apiKey: string): Promise<number> {
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

    return count;
  } catch {
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
export function extractEmployeeCountFromText(text: string): number {
  if (!text) return 0;

  // Match patterns like "1,200 employees", "~500 employees", "1.2K employees"
  const patterns = [
    /(\d[\d,]*(?:\.\d+)?)\s*[Kk]\s*(?:\+\s*)?employee/,       // "1.2K employees"
    /(\d[\d,]*)\s*(?:\+\s*)?employee/,                          // "1,200 employees"
    /(\d[\d,]*(?:\.\d+)?)\s*[Kk]\s*(?:\+\s*)?(?:staff|workers|people)/i,
    /(\d[\d,]*)\s*(?:\+\s*)?(?:staff|workers|people)/i,
    /employee[s]?\s*(?:count|size|number)?[:\s]+(\d[\d,]*)/i,   // "employees: 1,200"
    /(?:has|have|with|about|approximately|~|around)\s+(\d[\d,]*(?:\.\d+)?)\s*[Kk]?\s*(?:\+\s*)?employee/i,
    /(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)\s*employee/i,               // range: "200-500" or "501–1,000 employees"
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
 * Enrichment source tracking for side-by-side comparison.
 */
export interface EmployeeEnrichmentStats {
  total: number;
  fromGoogleKG: number;
  fromSerpApi: number;
  fromCache: number;
  notFound: number;
  googleKgAvailable: boolean;
  serpApiAvailable: boolean;
}

// Module-level stats for the most recent enrichment run
let lastEnrichmentStats: EmployeeEnrichmentStats | null = null;

export function getLastEnrichmentStats(): EmployeeEnrichmentStats | null {
  return lastEnrichmentStats;
}

/**
 * Batch enrich employee counts for a list of companies.
 * Uses a two-source waterfall:
 *   1. Google Knowledge Graph API (free, 100/day) — tries ALL companies first
 *   2. SerpAPI Google Search (paid) — fills in what Google KG missed
 * Logs side-by-side comparison of both sources.
 */
export async function batchEnrichEmployeeCounts(
  companies: Array<{ name: string }>,
  timeoutMs = 15000
): Promise<Map<string, number>> {
  const serpApiKey = process.env.SERPAPI_KEY;
  const googleKgKey = process.env.GOOGLE_KG_API_KEY;

  if (!serpApiKey && !googleKgKey) {
    log.debug("No SERPAPI_KEY or GOOGLE_KG_API_KEY — skipping employee count enrichment");
    return new Map();
  }

  const timer = log.time("employee-enrichment");
  const results = new Map<string, number>();
  const MAX_LOOKUPS = 25; // Enrich more companies for better coverage
  const CONCURRENCY = 3;

  // Track source attribution for side-by-side comparison
  const stats: EmployeeEnrichmentStats = {
    total: 0,
    fromGoogleKG: 0,
    fromSerpApi: 0,
    fromCache: 0,
    notFound: 0,
    googleKgAvailable: !!googleKgKey,
    serpApiAvailable: !!serpApiKey,
  };

  // Deduplicate and limit
  const unique = new Map<string, string>(); // normalized → original
  for (const c of companies) {
    const key = c.name.toLowerCase().trim();
    if (!unique.has(key)) unique.set(key, c.name);
  }
  const toEnrich = Array.from(unique.entries()).slice(0, MAX_LOOKUPS);
  stats.total = toEnrich.length;

  // Log current baseline before enrichment
  log.info("Employee enrichment starting", {
    uniqueCompanies: unique.size,
    enriching: toEnrich.length,
    maxLookups: MAX_LOOKUPS,
    sources: {
      googleKG: googleKgKey ? "enabled" : "no API key",
      serpApi: serpApiKey ? "enabled" : "no API key",
    },
    cacheSize: employeeCache.size,
  });

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );

  const enrichPromise = (async () => {
    // ── Phase 1: Check cache ──────────────────────────────────────
    const uncached: Array<[string, string]> = [];
    for (const [key, name] of toEnrich) {
      const cached = employeeCache.get(key);
      if (cached && Date.now() - cached.checkedAt < EMPLOYEE_CACHE_TTL) {
        results.set(key, cached.count);
        if (cached.count > 0) stats.fromCache++;
      } else {
        uncached.push([key, name]);
      }
    }

    if (uncached.length === 0) {
      log.debug("All employee counts served from cache");
      return "done";
    }

    // ── Phase 2: Google Knowledge Graph API (free, 100/day) ──────
    const needsSerpApi: Array<[string, string]> = [];

    if (googleKgKey) {
      log.debug(`Google KG: looking up ${uncached.length} companies`);
      for (let i = 0; i < uncached.length; i += CONCURRENCY) {
        const batch = uncached.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(([, name]) => lookupEmployeeCountViaGoogleKG(name, googleKgKey))
        );

        batchResults.forEach((result, j) => {
          const [key] = batch[j];
          if (result.status === "fulfilled" && result.value.found && result.value.count > 0) {
            results.set(key, result.value.count);
            employeeCache.set(key, { count: result.value.count, source: "google-kg", checkedAt: Date.now() });
            stats.fromGoogleKG++;
          } else {
            needsSerpApi.push(batch[j]);
          }
        });
      }
      log.debug(`Google KG phase complete`, {
        found: stats.fromGoogleKG,
        remaining: needsSerpApi.length,
      });
    } else {
      // No Google KG key — all companies go to SerpAPI
      needsSerpApi.push(...uncached);
    }

    // ── Phase 3: SerpAPI Google Search (paid, fills gaps) ────────
    if (serpApiKey && needsSerpApi.length > 0) {
      log.debug(`SerpAPI: looking up ${needsSerpApi.length} companies`);
      for (let i = 0; i < needsSerpApi.length; i += CONCURRENCY) {
        const batch = needsSerpApi.slice(i, i + CONCURRENCY);
        const batchResults = await Promise.allSettled(
          batch.map(([, name]) => lookupEmployeeCountViaSerpApi(name, serpApiKey))
        );

        batchResults.forEach((result, j) => {
          const [key] = batch[j];
          const count = result.status === "fulfilled" ? result.value : 0;
          results.set(key, count);
          employeeCache.set(key, { count, source: count > 0 ? "serpapi" : "not-found", checkedAt: Date.now() });
          if (count > 0) stats.fromSerpApi++;
        });
      }
    } else if (!serpApiKey && needsSerpApi.length > 0) {
      // No SerpAPI key — mark remaining as not found
      for (const [key] of needsSerpApi) {
        results.set(key, 0);
        employeeCache.set(key, { count: 0, source: "not-found", checkedAt: Date.now() });
      }
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

  const totalFound = Array.from(results.values()).filter((v) => v > 0).length;
  stats.notFound = stats.total - totalFound;

  // ── Side-by-side comparison log ─────────────────────────────────
  const coveragePct = stats.total > 0 ? Math.round((totalFound / stats.total) * 100) : 0;
  timer.end("Employee count enrichment — SIDE-BY-SIDE RESULTS", {
    total: stats.total,
    found: totalFound,
    coverage: `${coveragePct}%`,
    breakdown: {
      googleKG: stats.fromGoogleKG,
      serpApi: stats.fromSerpApi,
      cache: stats.fromCache,
      notFound: stats.notFound,
    },
    sourcesEnabled: {
      googleKG: stats.googleKgAvailable,
      serpApi: stats.serpApiAvailable,
    },
  });

  // Log improvement comparison
  if (stats.googleKgAvailable) {
    const kgPct = stats.total > 0 ? Math.round((stats.fromGoogleKG / stats.total) * 100) : 0;
    const serpPct = stats.total > 0 ? Math.round((stats.fromSerpApi / stats.total) * 100) : 0;
    log.info("📊 Employee enrichment source comparison", {
      googleKG: `${stats.fromGoogleKG}/${stats.total} (${kgPct}%)`,
      serpApi: `${stats.fromSerpApi}/${stats.total} (${serpPct}%)`,
      combined: `${totalFound}/${stats.total} (${coveragePct}%)`,
      improvement: stats.fromGoogleKG > 0
        ? `Google KG added ${stats.fromGoogleKG} companies that would not have been found by SerpAPI alone`
        : "Google KG did not find additional companies this run",
    });
  }

  lastEnrichmentStats = stats;
  return results;
}

// ── LinkedIn Contact Lookup via SerpAPI ──────────────────────────────
// Searches Google for `site:linkedin.com "Company" (title keywords)`
// to find decision-makers who likely own Salesforce hiring decisions.
// Also extracts employee counts from /company/ page snippets that
// appear in the same result set — zero extra API calls.
// Returns real LinkedIn profile URLs from Google's index.

export interface LookedUpContact {
  name: string;
  title: string;
  linkedinUrl: string;
  confidence: "high" | "medium" | "low";
}

// Ranked by relevance: who owns the Salesforce hiring decision?
const DECISION_MAKER_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(VP|Vice President|Director|Head)\b.*\b(Revenue Ops|Revenue Operations|Sales Ops|Sales Operations)\b/i, weight: 10 },
  { pattern: /\b(VP|Vice President|Director|Head)\b.*\b(Business Systems|IT|Information Technology)\b/i, weight: 9 },
  { pattern: /\b(CTO|CIO|Chief Technology|Chief Information)\b/i, weight: 8 },
  { pattern: /\bDirector\b.*\b(Salesforce|CRM|Sales Technology)\b/i, weight: 8 },
  { pattern: /\b(VP|Vice President)\b.*\b(Sales|IT|Technology)\b/i, weight: 7 },
  { pattern: /\bManager\b.*\b(Business Systems|Sales Operations|Revenue Operations)\b/i, weight: 6 },
  { pattern: /\bSenior\s*(Manager|Director)\b.*\b(Salesforce|CRM|Business Systems)\b/i, weight: 6 },
  { pattern: /\b(Head|Director|VP|Vice President)\b.*\b(Engineering|Operations|Digital)\b/i, weight: 5 },
];

// These are peers (current Salesforce admins/devs), not decision-makers
const PEER_PATTERNS = [
  /\bSalesforce\s*(Admin|Administrator|Developer|Engineer|Architect|Consultant)\b/i,
  /\bCRM\s*(Admin|Administrator|Specialist)\b/i,
];

const CONTACT_SEARCH_KEYWORDS = [
  "revenue operations",
  "sales operations",
  "salesforce",
  "business systems",
  "CRM",
  "IT director",
  "VP sales",
];

const contactCache = new Map<string, { contacts: LookedUpContact[]; employeeCount: number; checkedAt: number }>();
const CONTACT_CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Parse LinkedIn search result title into name + role.
 * Google titles: "Name - Title - Company | LinkedIn"
 * Also: "Name – Title – Company | LinkedIn" (en-dash)
 */
function parseLinkedInResult(rawTitle: string, snippet: string, companyName: string): {
  name: string;
  role: string;
  worksAtCompany: boolean;
} {
  // Split on dashes/pipes, filter out "LinkedIn" parts
  const parts = rawTitle.split(/\s*[-–—|]\s*/);
  const name = parts[0]?.trim() || "";
  const role = parts.slice(1).filter((p) =>
    !p.toLowerCase().includes("linkedin") && p.trim().length > 0
  )[0]?.trim() || "";

  // Verify this person actually works at the target company
  const companyLower = companyName.toLowerCase();
  const allText = `${rawTitle} ${snippet}`.toLowerCase();
  const worksAtCompany = allText.includes(companyLower);

  return { name, role, worksAtCompany };
}

/**
 * Score a contact's relevance as a Salesforce hiring decision-maker.
 */
function scoreContact(role: string, snippet: string): {
  score: number;
  confidence: "high" | "medium" | "low";
} {
  // Check if they're a peer (current SF admin) — low value
  for (const pattern of PEER_PATTERNS) {
    if (pattern.test(role)) {
      return { score: 1, confidence: "low" };
    }
  }

  // Score against decision-maker patterns
  const textToCheck = `${role} ${snippet}`;
  for (const { pattern, weight } of DECISION_MAKER_PATTERNS) {
    if (pattern.test(textToCheck)) {
      return {
        score: weight,
        confidence: weight >= 8 ? "high" : weight >= 5 ? "medium" : "low",
      };
    }
  }

  return { score: 0, confidence: "low" };
}

export interface ContactLookupResult {
  contacts: LookedUpContact[];
  employeeCount: number; // side-channel: parsed from LinkedIn company page snippets
}

/**
 * Look up contacts for a single company via SerpAPI Google search.
 * Also extracts employee count from LinkedIn company page snippets
 * that appear in the same result set (zero extra API calls).
 * Returns up to 3 ranked contacts with real LinkedIn profile URLs.
 */
async function lookupContacts(companyName: string, apiKey: string): Promise<ContactLookupResult> {
  const cacheKey = companyName.toLowerCase().trim();
  const cached = contactCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < CONTACT_CACHE_TTL) {
    return { contacts: cached.contacts, employeeCount: cached.employeeCount };
  }

  try {
    // Primary query targets /in/ profiles so all 10 result slots are people.
    // The broader retry (below) uses site:linkedin.com to catch company pages
    // for the employee-count side-channel when no contacts are found.
    const titleQuery = CONTACT_SEARCH_KEYWORDS.map((t) => `"${t}"`).join(" OR ");
    const query = `site:linkedin.com/in "${companyName}" (${titleQuery})`;

    const params = new URLSearchParams({
      engine: "google",
      q: query,
      api_key: apiKey,
      num: "10",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      contactCache.set(cacheKey, { contacts: [], employeeCount: 0, checkedAt: Date.now() });
      return { contacts: [], employeeCount: 0 };
    }

    const data = (await response.json()) as Record<string, unknown>;
    const results = ((data?.organic_results || []) as Record<string, unknown>[]);

    const scored: Array<LookedUpContact & { score: number }> = [];
    let sideChannelEmployeeCount = 0;

    for (const item of results) {
      const link = String(item.link || "");
      const title = String(item.title || "");
      const snippet = String(item.snippet || "");

      // Only process real LinkedIn profile URLs
      if (!link.includes("linkedin.com/in/")) continue;

      const { name, role, worksAtCompany } = parseLinkedInResult(title, snippet, companyName);

      // Skip if no name, or person doesn't work at target company
      if (!name || !worksAtCompany) continue;

      const { score, confidence } = scoreContact(role, snippet);

      // Only keep scored contacts (score > 0)
      if (score > 0) {
        scored.push({
          name,
          title: role,
          linkedinUrl: link,
          confidence,
          score,
        });
      }
    }

    // If no scored contacts, retry with a broader leadership-only query
    if (scored.length === 0) {
      log.debug(`No contacts for "${companyName}" — retrying with broader search`);

      const broaderQuery = `site:linkedin.com "${companyName}" (Director OR VP OR "Vice President" OR CTO OR CIO OR "Head of")`;
      const broaderParams = new URLSearchParams({
        engine: "google",
        q: broaderQuery,
        api_key: apiKey,
        num: "10",
      });

      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 10000);

      try {
        const resp2 = await fetch(`https://serpapi.com/search.json?${broaderParams.toString()}`, {
          signal: controller2.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeout2);

        if (resp2.ok) {
          const data2 = (await resp2.json()) as Record<string, unknown>;
          const results2 = ((data2?.organic_results || []) as Record<string, unknown>[]);

          for (const item of results2) {
            const link = String(item.link || "");
            const title = String(item.title || "");
            const snippet = String(item.snippet || "");

            // Side-channel: extract employee count from /company/ pages
            if (!sideChannelEmployeeCount && link.includes("linkedin.com/company/")) {
              const text = `${snippet} ${title}`;
              const rangeMatch = text.match(/([\d,]+)\s*[-–—]\s*([\d,]+)\s*employee/i);
              if (rangeMatch) {
                sideChannelEmployeeCount = parseNumericValue(rangeMatch[2]);
              } else {
                sideChannelEmployeeCount = extractEmployeeCountFromText(text);
              }
            }

            if (!link.includes("linkedin.com/in/")) continue;

            const { name, role, worksAtCompany } = parseLinkedInResult(title, snippet, companyName);
            if (!name || !worksAtCompany) continue;

            const { score, confidence } = scoreContact(role, snippet);
            if (score > 0) {
              scored.push({ name, title: role, linkedinUrl: link, confidence, score });
            }
          }

          log.debug(`Broader search: ${companyName}`, {
            broaderResults: results2.length,
            newContacts: scored.length,
          });
        }
      } catch {
        clearTimeout(timeout2);
        log.debug(`Broader search failed for "${companyName}"`);
      }
    }

    // Sort by score descending, take top 3
    const contacts = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ score: _score, ...rest }) => rest);

    contactCache.set(cacheKey, { contacts, employeeCount: sideChannelEmployeeCount, checkedAt: Date.now() });

    log.debug(`Contact lookup: ${companyName}`, {
      googleResults: results.length,
      linkedinProfiles: scored.length,
      returned: contacts.length,
      sideChannelEmployees: sideChannelEmployeeCount,
    });

    return { contacts, employeeCount: sideChannelEmployeeCount };
  } catch {
    contactCache.set(cacheKey, { contacts: [], employeeCount: 0, checkedAt: Date.now() });
    return { contacts: [], employeeCount: 0 };
  }
}

// ── "Reports To" Extraction from Job Descriptions ───────────────────
// Parses job descriptions for reporting hierarchy info like
// "reporting to the VP of Sales" — free signal we're already sitting on.

export interface ReportingManager {
  title: string;       // e.g. "Director of Revenue Operations"
  confidence: "high" | "medium" | "low";
}

const REPORTING_PATTERNS: Array<{ pattern: RegExp; group: number }> = [
  // "reporting to the Director of Revenue Operations"
  { pattern: /report(?:s|ing)\s+(?:directly\s+)?to\s+(?:the\s+)?(?:company'?s?\s+)?([A-Z][A-Za-z]+(?:\s+(?:of|for|&|-)\s+)?[A-Za-z\s]{2,}?)(?:\.|,|;|\s+(?:who|and|this|the|our|with|based|located|at|in))/i, group: 1 },
  // "this role reports into the CTO"
  { pattern: /role\s+reports?\s+(?:into|to)\s+(?:the\s+)?(?:company'?s?\s+)?([A-Z][A-Za-z]+(?:\s+(?:of|for|&|-)\s+)?[A-Za-z\s]{2,}?)(?:\.|,|;|\s+(?:who|and|this|the|our|with))/i, group: 1 },
  // "under the direction of the VP of Sales"
  { pattern: /under\s+(?:the\s+)?(?:direction|leadership|guidance|supervision|management)\s+of\s+(?:the\s+)?(?:company'?s?\s+)?([A-Z][A-Za-z]+(?:\s+(?:of|for|&|-)\s+)?[A-Za-z\s]{2,}?)(?:\.|,|;|\s+(?:who|and|this|the|our|with))/i, group: 1 },
  // "managed by the Director of IT"
  { pattern: /(?:managed|led|overseen|supervised)\s+by\s+(?:the\s+)?(?:company'?s?\s+)?([A-Z][A-Za-z]+(?:\s+(?:of|for|&|-)\s+)?[A-Za-z\s]{2,}?)(?:\.|,|;|\s+(?:who|and|this|the|our|with))/i, group: 1 },
];

// Titles that indicate a real manager (not noise like "reporting to the team")
const VALID_MANAGER_TITLES = /\b(VP|Vice President|Director|Head|Chief|CTO|CIO|CFO|COO|CEO|SVP|EVP|Manager|Senior Manager|President)\b/i;

/**
 * Extract the reporting manager's title from a job description.
 * Returns null if no reporting info found.
 */
export function extractReportingManager(description: string): ReportingManager | null {
  if (!description) return null;

  for (const { pattern, group } of REPORTING_PATTERNS) {
    const match = description.match(pattern);
    if (match && match[group]) {
      const rawTitle = match[group].trim()
        .replace(/\s+/g, " ")          // normalize whitespace
        .replace(/\s+$/, "");           // trim trailing

      // Must contain a real leadership title, not just "the team"
      if (!VALID_MANAGER_TITLES.test(rawTitle)) continue;

      // Cap length — anything over 60 chars is probably a parsing error
      if (rawTitle.length > 60) continue;

      const confidence = /\b(VP|Vice President|Director|Head|Chief|CTO|CIO|SVP|EVP)\b/i.test(rawTitle)
        ? "high" : "medium";

      return { title: rawTitle, confidence };
    }
  }

  return null;
}

/**
 * Batch lookup contacts for a list of companies.
 * Returns a map of normalized company name → contacts.
 */
export interface BatchContactResult {
  contacts: Map<string, LookedUpContact[]>;
  employeeCounts: Map<string, number>; // side-channel from LinkedIn company pages
}

export async function batchLookupContacts(
  companies: Array<{ name: string }>,
  timeoutMs = 15000
): Promise<BatchContactResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    log.debug("No SERPAPI_KEY — skipping contact lookup");
    return { contacts: new Map(), employeeCounts: new Map() };
  }

  const timer = log.time("contact-lookup");
  const contacts = new Map<string, LookedUpContact[]>();
  const employeeCounts = new Map<string, number>();
  const MAX_LOOKUPS = 20; // Look up more contacts for better coverage
  const CONCURRENCY = 3;

  // Deduplicate
  const unique = new Map<string, string>();
  for (const c of companies) {
    const key = c.name.toLowerCase().trim();
    if (!unique.has(key)) unique.set(key, c.name);
  }
  const toLookup = Array.from(unique.entries()).slice(0, MAX_LOOKUPS);

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs)
  );

  const lookupPromise = (async () => {
    for (let i = 0; i < toLookup.length; i += CONCURRENCY) {
      const batch = toLookup.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(([, name]) => lookupContacts(name, apiKey))
      );

      batchResults.forEach((result, j) => {
        const key = batch[j][0];
        if (result.status === "fulfilled") {
          contacts.set(key, result.value.contacts);
          if (result.value.employeeCount > 0) {
            employeeCounts.set(key, result.value.employeeCount);
          }
        } else {
          contacts.set(key, []);
        }
      });
    }
    return "done";
  })();

  const winner = await Promise.race([lookupPromise, timeoutPromise]);

  if (winner === "timeout") {
    log.warn("Contact lookup timed out", {
      completed: contacts.size,
      total: toLookup.length,
    });
  }

  const withContacts = Array.from(contacts.values()).filter((v) => v.length > 0).length;
  const withEmployees = Array.from(employeeCounts.values()).filter((v) => v > 0).length;
  timer.end("Contact lookup", {
    total: toLookup.length,
    withContacts,
    totalContacts: Array.from(contacts.values()).reduce((s, v) => s + v.length, 0),
    sideChannelEmployees: withEmployees,
  });

  return { contacts, employeeCounts };
}
