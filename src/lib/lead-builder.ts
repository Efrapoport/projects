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
// Instead of dumping the full job description, pull out only the most
// relevant sentences (ones containing Salesforce-related keywords).

const SNIPPET_KEYWORDS = [
  "salesforce", "sfdc", "sales cloud", "service cloud", "apex",
  "lightning", "soql", "visualforce", "flow builder", "crm",
  "first", "greenfield", "build from scratch", "sole contributor",
  "initial setup", "standing up", "net new", "transition from",
  "migrating from", "founding", "owning",
];

function extractRelevantSnippets(description: string, maxSnippets = 3): string {
  if (!description) return "";

  // Split into sentences (approximate — handles ". ", "! ", "? ", and newlines)
  const sentences = description
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const lower = (s: string) => s.toLowerCase();

  // Score each sentence by how many keywords it contains
  const scored = sentences.map((sentence) => {
    const lc = lower(sentence);
    const hits = SNIPPET_KEYWORDS.filter((kw) => lc.includes(kw)).length;
    return { sentence, hits };
  });

  // Take the top sentences that have at least 1 keyword hit
  const relevant = scored
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, maxSnippets)
    .map((s) => s.sentence);

  if (relevant.length === 0) {
    // Fallback: first 2 sentences
    return sentences.slice(0, 2).join(" ");
  }

  return relevant.join(" ... ");
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
