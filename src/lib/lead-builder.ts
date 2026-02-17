import { Lead, Signal, Company, Contact } from "./types";
import { computeLeadScore, generateTriggerEvent } from "./scoring";
import { ScrapedJob } from "./scraper";
import { batchValidateCompanyUrls, safeLinkedInUrl, safeCompanySearchUrl } from "./data-integrity";
import { createLogger } from "./logger";

const log = createLogger("lead-builder");

// ── Transform Scraped Jobs → Leads ──────────────────────────────────

export async function buildLeadsFromJobs(jobs: ScrapedJob[]): Promise<Lead[]> {
  const timer = log.time("build-leads");

  // Collect unique company names for batch URL validation
  const uniqueCompanies = new Map<string, string>(); // normalized key → original name
  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    if (!uniqueCompanies.has(key)) {
      uniqueCompanies.set(key, job.company);
    }
  }

  const companyEntries: Array<{ name: string; slug: string }> = [];
  for (const [, name] of uniqueCompanies) {
    companyEntries.push({ name, slug: slugify(name) });
  }

  // Validate all company URLs in parallel (with 8s timeout)
  let validationResults: Map<string, { website: string; websiteVerified: boolean; linkedinUrl: string; domain: string }>;
  try {
    validationResults = await batchValidateCompanyUrls(companyEntries);
    log.info("URL validation complete", { companies: validationResults.size });
  } catch (error) {
    log.warn("URL validation failed — using safe fallbacks", { error: String(error) });
    validationResults = new Map();
  }

  // Build one Lead per job posting (each job = its own row)
  const leads: Lead[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];

    // Parse location
    const { city, state } = parseLocation(job.location);

    // Get validated URLs (or safe fallbacks)
    const companyKey = job.company.toLowerCase().trim();
    const slug = slugify(job.company);
    const validation = validationResults.get(companyKey);

    // Build Company with validated URLs
    const companyId = `scraped-${i + 1}`;
    const company: Company = {
      id: companyId,
      name: job.company,
      domain: validation?.domain || "",
      linkedinUrl: validation?.linkedinUrl || safeLinkedInUrl(job.company),
      website: validation?.website || safeCompanySearchUrl(job.company),
      industry: inferIndustry([job]),
      employeeCount: 0, // Unknown — filters will handle this
      city,
      state,
      country: "US",
      websiteVerified: validation?.websiteVerified || false,
    };

    log.debug(`Built lead: ${company.name} — ${job.title}`, {
      website: company.website,
      verified: company.websiteVerified,
      slug,
    });

    // Single signal for this job posting
    const signal: Signal = {
      id: `${companyId}-s1`,
      category: "job_posting" as const,
      source: job.source,
      title: `Hiring: ${job.title}`,
      description: extractRelevantSnippets(job.description) || `${job.company} posted a "${job.title}" role.`,
      detectedAt: job.detectedAt,
      weight: 20,
      raw: job.description,
      url: job.url,
    };

    const signals = [signal];

    // Score and build Lead
    const score = computeLeadScore(signals);
    const triggerEvent = generateTriggerEvent(signals);

    const detectedTime = new Date(job.detectedAt).getTime();
    const now = new Date().toISOString();
    const detectedAt = Number.isFinite(detectedTime) ? job.detectedAt : now;

    leads.push({
      id: `lead-${companyId}`,
      company,
      score,
      signals,
      triggerEvent,
      contacts: [],
      firstDetected: detectedAt,
      lastUpdated: detectedAt,
      status: "new",
    });
  }

  const sorted = leads.sort((a, b) => b.score - a.score);
  timer.end(`Built ${sorted.length} leads from ${jobs.length} jobs`);
  return sorted;
}

export function getIndustriesFromLeads(leads: Lead[]): string[] {
  const industries = new Set(leads.map((l) => l.company.industry));
  return Array.from(industries).sort();
}

// ── Snippet Extraction ──────────────────────────────────────────────
// Pull out only the most relevant fragments from a job description.
// Scraped descriptions are often one giant unpunctuated block (HTML
// stripped), so we find keywords and extract a text window around each.

const SNIPPET_KEYWORDS_HIGH = [
  "greenfield", "build from scratch", "sole contributor",
  "initial setup", "standing up", "net new", "transition from",
  "migrating from", "founding", "first salesforce", "first admin",
  "first hire", "owning our instance",
];

const SNIPPET_KEYWORDS_MED = [
  "salesforce", "sfdc", "sales cloud", "service cloud", "apex",
  "lightning", "soql", "visualforce", "flow builder", "crm",
];

const WINDOW_RADIUS = 60; // chars before and after keyword
const MAX_SNIPPETS = 3;
const MAX_TOTAL_LEN = 300;

function extractRelevantSnippets(description: string): string {
  if (!description) return "";

  // Short descriptions don't need extraction
  if (description.length <= MAX_TOTAL_LEN) return description;

  const lc = description.toLowerCase();

  // Find all keyword occurrences with their priority (high > med)
  const hits: { start: number; end: number; priority: number }[] = [];

  for (const kw of SNIPPET_KEYWORDS_HIGH) {
    let pos = lc.indexOf(kw);
    while (pos !== -1) {
      hits.push({ start: pos, end: pos + kw.length, priority: 2 });
      pos = lc.indexOf(kw, pos + 1);
    }
  }
  for (const kw of SNIPPET_KEYWORDS_MED) {
    let pos = lc.indexOf(kw);
    while (pos !== -1) {
      hits.push({ start: pos, end: pos + kw.length, priority: 1 });
      pos = lc.indexOf(kw, pos + 1);
    }
  }

  if (hits.length === 0) {
    return description.substring(0, MAX_TOTAL_LEN) + "...";
  }

  // Sort by priority desc, then by position
  hits.sort((a, b) => b.priority - a.priority || a.start - b.start);

  // Extract windows around each hit, snapping to word boundaries
  const snippets: string[] = [];
  const usedRanges: { start: number; end: number }[] = [];

  for (const hit of hits) {
    if (snippets.length >= MAX_SNIPPETS) break;

    // Expand window around the keyword
    let wStart = Math.max(0, hit.start - WINDOW_RADIUS);
    let wEnd = Math.min(description.length, hit.end + WINDOW_RADIUS);

    // Snap to word boundaries
    while (wStart > 0 && description[wStart - 1] !== " ") wStart--;
    while (wEnd < description.length && description[wEnd] !== " ") wEnd++;

    // Skip if this window overlaps significantly with an existing one
    const overlaps = usedRanges.some(
      (r) => wStart < r.end && wEnd > r.start
    );
    if (overlaps) continue;

    let snippet = description.substring(wStart, wEnd).trim();
    if (wStart > 0) snippet = "..." + snippet;
    if (wEnd < description.length) snippet = snippet + "...";

    snippets.push(snippet);
    usedRanges.push({ start: wStart, end: wEnd });
  }

  return snippets.join("  ");
}

// ── Helpers ─────────────────────────────────────────────────────────

function parseLocation(location: string): { city: string; state: string } {
  if (!location) return { city: "", state: "" };

  // Handle formats like "Austin, TX", "Austin, TX 78701", "Remote in Austin, TX"
  const cleaned = location
    .replace(/^remote\s*(in\s*)?/i, "")
    .replace(/\d{5}(-\d{4})?/, "")
    .trim();

  const parts = cleaned.split(",").map((p) => p.trim());

  if (parts.length >= 2) {
    return {
      city: parts[0],
      state: parts[1].replace(/\s+\d+.*/, "").trim().substring(0, 2).toUpperCase(),
    };
  }

  // Try "City State" format
  const match = cleaned.match(/^(.+?)\s+([A-Z]{2})$/);
  if (match) {
    return { city: match[1], state: match[2] };
  }

  return { city: cleaned, state: "" };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferIndustry(jobs: ScrapedJob[]): string {
  const allText = jobs
    .map((j) => `${j.title} ${j.description}`)
    .join(" ")
    .toLowerCase();

  const industryKeywords: Record<string, string[]> = {
    Healthcare: ["health", "medical", "clinical", "hospital", "pharma", "biotech", "hipaa"],
    Fintech: ["fintech", "financial", "banking", "payments", "lending", "insurance"],
    "Real Estate": ["real estate", "property", "mortgage", "realty"],
    Education: ["education", "edtech", "school", "university", "learning"],
    Logistics: ["logistics", "freight", "shipping", "supply chain", "warehouse"],
    Retail: ["retail", "ecommerce", "e-commerce", "shopping", "store"],
    Manufacturing: ["manufacturing", "factory", "production"],
    "Non-Profit": ["nonprofit", "non-profit", "charity", "foundation"],
    Tech: ["software", "saas", "platform", "cloud", "ai ", "machine learning"],
    Energy: ["energy", "solar", "renewable", "oil", "gas", "utility"],
  };

  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some((kw) => allText.includes(kw))) {
      return industry;
    }
  }

  return "Other";
}
