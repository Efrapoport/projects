import { Lead, Signal, Company, Contact, HiringManager } from "./types";
import { computeLeadScore, generateTriggerEvent } from "./scoring";
import { ScrapedJob } from "./scraper";
import { batchValidateCompanyUrls, batchEnrichEmployeeCounts, batchLookupContacts, safeLinkedInUrl, safeCompanySearchUrl, extractEmployeeCountFromText, extractReportingManager, getLastEnrichmentStats } from "./data-integrity";
import type { LookedUpContact } from "./data-integrity";
import { createLogger } from "./logger";

const log = createLogger("lead-builder");

// ── Transform Scraped Jobs → Leads ──────────────────────────────────

export async function buildLeadsFromJobs(
  jobs: ScrapedJob[],
  options?: { skipEnrichment?: boolean },
): Promise<Lead[]> {
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

  // Validate URLs, enrich employee counts, and lookup contacts IN PARALLEL
  let validationResults: Map<string, { website: string; websiteVerified: boolean; linkedinUrl: string; domain: string; employeeCount: number }>;
  let employeeCounts: Map<string, number>;
  let contactResults: Map<string, LookedUpContact[]>;

  if (options?.skipEnrichment) {
    log.info("Skipping enrichment (fast-path fallback)");
    validationResults = new Map();
    employeeCounts = new Map();
    contactResults = new Map();
  } else {
    try {
      const [urlResults, empResults, contactRes] = await Promise.all([
        batchValidateCompanyUrls(companyEntries),
        batchEnrichEmployeeCounts(companyEntries),
        batchLookupContacts(companyEntries),
      ]);
      validationResults = urlResults;
      employeeCounts = empResults;
      contactResults = contactRes.contacts;

      // Merge LinkedIn company page employee counts (side-channel from
      // contact lookup — zero extra API calls) into the primary map.
      let linkedInSideChannelFills = 0;
      for (const [key, count] of contactRes.employeeCounts) {
        if (count > 0 && !employeeCounts.get(key)) {
          employeeCounts.set(key, count);
          linkedInSideChannelFills++;
        }
      }

      // Get detailed enrichment stats for side-by-side comparison
      const enrichStats = getLastEnrichmentStats();
      log.info("Company enrichment complete", {
        urlValidated: validationResults.size,
        employeeEnriched: Array.from(empResults.values()).filter((v) => v > 0).length,
        employeeFromLinkedIn: linkedInSideChannelFills,
        companiesWithContacts: Array.from(contactRes.contacts.values()).filter((v) => v.length > 0).length,
        ...(enrichStats && {
          employeeSources: {
            googleKG: enrichStats.fromGoogleKG,
            serpApi: enrichStats.fromSerpApi,
            cached: enrichStats.fromCache,
            notFound: enrichStats.notFound,
          },
        }),
      });
    } catch (error) {
      log.warn("Company enrichment failed — using safe fallbacks", { error: String(error) });
      validationResults = new Map();
      employeeCounts = new Map();
      contactResults = new Map();
    }
  }

  // ── Fallback: extract employee count from job descriptions ────────
  // For companies where SerpAPI returned 0, try parsing the JD text itself.
  // Catches phrases like "50-person startup", "team of 200", etc.
  let jdEmployeeFills = 0;
  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    if (!employeeCounts.get(key)) {
      const fromJd = extractEmployeeCountFromText(job.description);
      if (fromJd > 0) {
        employeeCounts.set(key, fromJd);
        jdEmployeeFills++;
      }
    }
  }
  if (jdEmployeeFills > 0) {
    log.info(`Employee count: filled ${jdEmployeeFills} from job descriptions`);
  }

  // ── Fallback: extract "reports to" from job descriptions ──────────
  // For companies with no LinkedIn contacts, parse reporting hierarchy
  // from the JD to create a synthetic contact (title only, no URL).
  const reportingManagers = new Map<string, { title: string; confidence: "high" | "medium" | "low" }>();
  for (const job of jobs) {
    const key = job.company.toLowerCase().trim();
    const existingContacts = contactResults.get(key);
    if (existingContacts && existingContacts.length > 0) continue;
    if (reportingManagers.has(key)) continue;

    const manager = extractReportingManager(job.description);
    if (manager) {
      reportingManagers.set(key, manager);
    }
  }
  if (reportingManagers.size > 0) {
    log.info(`Reporting managers: extracted ${reportingManagers.size} from job descriptions`);
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
      employeeCount: employeeCounts.get(companyKey) || 0,
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

    const triggerEvent = generateTriggerEvent(signals);

    const detectedTime = new Date(job.detectedAt).getTime();
    // If the source didn't provide a valid date, leave it empty rather
    // than faking "just now".  The UI will show "unknown" instead.
    const detectedAt = (Number.isFinite(detectedTime) && job.detectedAt) ? job.detectedAt : "";

    const builtContacts = buildContacts(companyId, companyKey, contactResults, reportingManagers);
    const hiringManager = inferHiringManager(
      job.title,
      builtContacts,
      reportingManagers.get(companyKey),
    );

    // Re-compute score with contact/hiring manager quality factored in
    const enrichedScore = computeLeadScore(signals, {
      contacts: builtContacts,
      hiringManager,
    });

    leads.push({
      id: `lead-${companyId}`,
      company,
      score: enrichedScore,
      signals,
      triggerEvent,
      contacts: builtContacts,
      hiringManager,
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

function buildContacts(
  companyId: string,
  companyKey: string,
  contactResults: Map<string, LookedUpContact[]>,
  reportingManagers: Map<string, { title: string; confidence: "high" | "medium" | "low" }>,
): Contact[] {
  const linkedinContacts = (contactResults.get(companyKey) || []).map((c, ci) => ({
    id: `${companyId}-c${ci + 1}`,
    name: c.name,
    title: c.title,
    linkedinUrl: c.linkedinUrl,
    source: "google" as const,
    confidence: c.confidence,
  }));

  // If we found LinkedIn contacts, use those
  if (linkedinContacts.length > 0) return linkedinContacts;

  // Otherwise, fall back to reporting manager from JD
  const manager = reportingManagers.get(companyKey);
  if (manager) {
    return [{
      id: `${companyId}-c1`,
      name: `${manager.title} (from job posting)`,
      title: manager.title,
      linkedinUrl: "",
      source: "google" as const,
      confidence: manager.confidence,
    }];
  }

  return [];
}

// ── Hiring Manager Inference ─────────────────────────────────────────
// Combines three tiers of evidence to identify the most likely hiring
// manager for a Salesforce role.  All inputs are data we already have —
// no extra API calls.
//
// Tier 1: LinkedIn contact scored as a decision-maker (highest confidence)
// Tier 2: JD "reports to" extraction (medium confidence)
// Tier 3: Title-based inference from the job title (low confidence)

// Maps common Salesforce job titles to the roles that typically own the
// hiring decision.  Used only when tiers 1 & 2 produce nothing.
const HIRING_MANAGER_INFERENCE: Array<{ match: RegExp; titles: string[] }> = [
  {
    match: /salesforce\s*(admin|administrator)/i,
    titles: ["VP of Revenue Operations", "Director of Business Systems", "VP of IT"],
  },
  {
    match: /salesforce\s*(developer|engineer)/i,
    titles: ["Director of Salesforce Engineering", "VP of Business Systems", "CTO"],
  },
  {
    match: /salesforce\s*(architect)/i,
    titles: ["VP of Engineering", "CTO", "Director of Enterprise Architecture"],
  },
  {
    match: /salesforce\s*(consultant|specialist|analyst)/i,
    titles: ["Director of CRM", "VP of Sales Operations", "Head of Business Systems"],
  },
  {
    match: /crm\s*(admin|administrator|manager|specialist)/i,
    titles: ["VP of Revenue Operations", "Director of Sales Operations", "CIO"],
  },
  {
    match: /revenue\s*operations/i,
    titles: ["VP of Revenue Operations", "CRO", "VP of Sales"],
  },
  {
    match: /business\s*systems/i,
    titles: ["VP of IT", "CIO", "Director of Business Systems"],
  },
];

function inferHiringManager(
  jobTitle: string,
  contacts: Contact[],
  reportingManager: { title: string; confidence: "high" | "medium" | "low" } | undefined,
): HiringManager | undefined {
  // Tier 1: LinkedIn-found decision maker (highest confidence).
  // Pick the first high-confidence contact, or the first medium one.
  const highConfidence = contacts.find((c) => c.confidence === "high");
  if (highConfidence) {
    return {
      title: highConfidence.title,
      name: highConfidence.name,
      linkedinUrl: highConfidence.linkedinUrl || undefined,
      confidence: "high",
      source: "linkedin",
    };
  }

  const mediumConfidence = contacts.find((c) => c.confidence === "medium");
  if (mediumConfidence) {
    return {
      title: mediumConfidence.title,
      name: mediumConfidence.name,
      linkedinUrl: mediumConfidence.linkedinUrl || undefined,
      confidence: "medium",
      source: "linkedin",
    };
  }

  // Tier 2: JD "reports to" extraction (medium confidence).
  if (reportingManager) {
    return {
      title: reportingManager.title,
      confidence: reportingManager.confidence,
      source: "job_description",
    };
  }

  // Tier 3: Title-based inference (low confidence — educated guess).
  for (const { match, titles } of HIRING_MANAGER_INFERENCE) {
    if (match.test(jobTitle)) {
      return {
        title: titles[0],
        confidence: "low",
        source: "inferred",
      };
    }
  }

  return undefined;
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
