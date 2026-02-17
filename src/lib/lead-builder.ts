import { Lead, Signal, Company, Contact } from "./types";
import { computeLeadScore, generateTriggerEvent } from "./scoring";
import { ScrapedJob } from "./scraper";

// ── Transform Scraped Jobs → Leads ──────────────────────────────────

export function buildLeadsFromJobs(jobs: ScrapedJob[]): Lead[] {
  // Group jobs by company name (normalized)
  const companyGroups = new Map<string, ScrapedJob[]>();

  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    const existing = companyGroups.get(key) || [];
    existing.push(job);
    companyGroups.set(key, existing);
  }

  // Build a Lead for each company
  const leads: Lead[] = [];

  let companyIndex = 0;
  for (const [, companyJobs] of companyGroups) {
    companyIndex++;
    const firstJob = companyJobs[0];

    // Parse location
    const { city, state } = parseLocation(firstJob.location);

    // Build Company
    const companyId = `scraped-${companyIndex}`;
    const slug = slugify(firstJob.company);
    const company: Company = {
      id: companyId,
      name: firstJob.company,
      domain: `${slug}.com`,
      linkedinUrl: `https://linkedin.com/company/${slug}`,
      website: `https://${slug}.com`,
      industry: inferIndustry(companyJobs),
      employeeCount: 0, // Unknown — filters will handle this
      city,
      state,
      country: "US",
    };

    // Build Signals (one per job posting)
    const signals: Signal[] = companyJobs.map((job, i) => ({
      id: `${companyId}-s${i + 1}`,
      category: "job_posting" as const,
      source: job.source,
      title: `Hiring: ${job.title}`,
      description: extractRelevantSnippets(job.description) || `${firstJob.company} posted a "${job.title}" role.`,
      detectedAt: job.detectedAt,
      weight: 20,
      raw: job.description,
      url: job.url,
    }));

    // Score and build Lead
    const score = computeLeadScore(signals);
    const triggerEvent = generateTriggerEvent(signals);

    const dates = signals
      .map((s) => new Date(s.detectedAt).getTime())
      .filter((t) => Number.isFinite(t));
    const now = new Date().toISOString();
    const firstDetected = dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : now;
    const lastUpdated = dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : now;

    const contacts: Contact[] = [];

    leads.push({
      id: `lead-${companyId}`,
      company,
      score,
      signals,
      triggerEvent,
      contacts,
      firstDetected,
      lastUpdated,
      status: "new",
    });
  }

  return leads.sort((a, b) => b.score - a.score);
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

const ALL_SNIPPET_KEYWORDS = [...SNIPPET_KEYWORDS_HIGH, ...SNIPPET_KEYWORDS_MED];

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
