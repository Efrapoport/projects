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

// ── LinkedIn Company Page Employee Count Fallback ────────────────────
// When the generic SerpAPI query and JD parsing both fail to find an
// employee count, we try `site:linkedin.com/company "CompanyName"`.
// Google often indexes LinkedIn company pages with snippets like
// "501-1,000 employees" or "3,296 employees on LinkedIn".

/**
 * Look up employee count from a company's LinkedIn page via SerpAPI.
 * This is a targeted fallback — only called for companies where the
 * primary lookup and JD extraction both returned 0.
 */
export async function lookupEmployeeCountLinkedIn(
  companyName: string,
  apiKey: string,
): Promise<number> {
  const cacheKey = `linkedin:${companyName.toLowerCase().trim()}`;
  const cached = employeeCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < EMPLOYEE_CACHE_TTL) {
    return cached.count;
  }

  try {
    const params = new URLSearchParams({
      engine: "google",
      q: `site:linkedin.com/company "${companyName}" employees`,
      api_key: apiKey,
      num: "5",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );

    clearTimeout(timeout);

    if (!response.ok) {
      employeeCache.set(cacheKey, { count: 0, checkedAt: Date.now() });
      return 0;
    }

    const data = (await response.json()) as Record<string, unknown>;
    let count = 0;

    // Parse snippets from organic results — LinkedIn pages show
    // "501-1,000 employees" or "5,296 employees on LinkedIn"
    const organic = (data.organic_results || []) as Record<string, unknown>[];
    for (const result of organic.slice(0, 5)) {
      const snippet = String(result.snippet || "");
      const title = String(result.title || "");
      const text = `${snippet} ${title}`;

      // LinkedIn-specific range format: "501-1,000 employees"
      const rangeMatch = text.match(
        /([\d,]+)\s*[-–]\s*([\d,]+)\s*employee/i,
      );
      if (rangeMatch) {
        count = parseNumericValue(rangeMatch[2]); // upper bound
        break;
      }

      // Absolute count: "5,296 employees on LinkedIn"
      count = extractEmployeeCountFromText(text);
      if (count > 0) break;
    }

    employeeCache.set(cacheKey, { count, checkedAt: Date.now() });
    return count;
  } catch {
    employeeCache.set(cacheKey, { count: 0, checkedAt: Date.now() });
    return 0;
  }
}

/**
 * Batch fallback: look up employee counts via LinkedIn company pages
 * for companies that still have 0 after primary enrichment + JD parsing.
 */
export async function batchLinkedInEmployeeFallback(
  companies: Array<{ name: string }>,
  timeoutMs = 12000,
): Promise<Map<string, number>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return new Map();

  const timer = log.time("linkedin-employee-fallback");
  const results = new Map<string, number>();
  const CONCURRENCY = 3;

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs),
  );

  const enrichPromise = (async () => {
    for (let i = 0; i < companies.length; i += CONCURRENCY) {
      const batch = companies.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map((c) => lookupEmployeeCountLinkedIn(c.name, apiKey)),
      );

      batchResults.forEach((result, j) => {
        const key = batch[j].name.toLowerCase().trim();
        results.set(key, result.status === "fulfilled" ? result.value : 0);
      });
    }
    return "done";
  })();

  const winner = await Promise.race([enrichPromise, timeoutPromise]);

  if (winner === "timeout") {
    log.warn("LinkedIn employee fallback timed out", {
      enriched: results.size,
      total: companies.length,
    });
  }

  const found = Array.from(results.values()).filter((v) => v > 0).length;
  timer.end("LinkedIn employee fallback", { total: companies.length, found });
  return results;
}

// ── LinkedIn Contact Lookup via SerpAPI ──────────────────────────────
// Searches Google for `site:linkedin.com/in "Company" (title keywords)`
// to find decision-makers who likely own Salesforce hiring decisions.
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

const contactCache = new Map<string, { contacts: LookedUpContact[]; checkedAt: number }>();
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

/**
 * Look up contacts for a single company via SerpAPI Google search.
 * Returns up to 3 ranked contacts with real LinkedIn profile URLs.
 */
async function lookupContacts(companyName: string, apiKey: string): Promise<LookedUpContact[]> {
  const cacheKey = companyName.toLowerCase().trim();
  const cached = contactCache.get(cacheKey);
  if (cached && Date.now() - cached.checkedAt < CONTACT_CACHE_TTL) {
    return cached.contacts;
  }

  try {
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
      contactCache.set(cacheKey, { contacts: [], checkedAt: Date.now() });
      return [];
    }

    const data = (await response.json()) as Record<string, unknown>;
    const results = ((data?.organic_results || []) as Record<string, unknown>[]);

    const scored: Array<LookedUpContact & { score: number }> = [];

    for (const item of results) {
      const link = String(item.link || "");
      const title = String(item.title || "");
      const snippet = String(item.snippet || "");

      // Only process real LinkedIn profile URLs (must be /in/ not /company/ or /jobs/)
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

      const broaderQuery = `site:linkedin.com/in "${companyName}" (Director OR VP OR "Vice President" OR CTO OR CIO OR "Head of")`;
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

    contactCache.set(cacheKey, { contacts, checkedAt: Date.now() });

    log.debug(`Contact lookup: ${companyName}`, {
      googleResults: results.length,
      linkedinProfiles: scored.length,
      returned: contacts.length,
    });

    return contacts;
  } catch {
    contactCache.set(cacheKey, { contacts: [], checkedAt: Date.now() });
    return [];
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
export async function batchLookupContacts(
  companies: Array<{ name: string }>,
  timeoutMs = 20000
): Promise<Map<string, LookedUpContact[]>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    log.debug("No SERPAPI_KEY — skipping contact lookup");
    return new Map();
  }

  const timer = log.time("contact-lookup");
  const results = new Map<string, LookedUpContact[]>();
  const MAX_LOOKUPS = 15;
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
        results.set(key, result.status === "fulfilled" ? result.value : []);
      });
    }
    return "done";
  })();

  const winner = await Promise.race([lookupPromise, timeoutPromise]);

  if (winner === "timeout") {
    log.warn("Contact lookup timed out", {
      completed: results.size,
      total: toLookup.length,
    });
  }

  const withContacts = Array.from(results.values()).filter((v) => v.length > 0).length;
  timer.end("Contact lookup", {
    total: toLookup.length,
    withContacts,
    totalContacts: Array.from(results.values()).reduce((s, v) => s + v.length, 0),
  });

  return results;
}
