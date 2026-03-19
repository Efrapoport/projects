import type { SIDependentLead, SISignal, Company, Contact, HiringManager } from "./types";
import type { ScrapedJob } from "./scraper";
import { analyzeSIJobs, computeSIDependencyScore, inferSFComplexity, inferSIRelationshipType } from "./si-signals";
import { createLogger } from "./logger";

const log = createLogger("si-lead-builder");

// ── Transform SI-flagged Jobs → SI-Dependent Leads ──────────────────

export async function buildSILeadsFromJobs(jobs: ScrapedJob[]): Promise<SIDependentLead[]> {
  const timer = log.time("build-si-leads");

  // Step 1: Analyze all jobs for SI-dependency signals
  const analyses = analyzeSIJobs(jobs);

  if (analyses.length === 0) {
    timer.end("No SI-dependency signals found");
    return [];
  }

  // Step 2: Group by target company (the company to sell to, not the SI)
  const companyMap = new Map<string, typeof analyses>();
  for (const analysis of analyses) {
    const key = analysis.targetCompany.toLowerCase().trim();
    if (!companyMap.has(key)) {
      companyMap.set(key, []);
    }
    companyMap.get(key)!.push(analysis);
  }

  // Step 3: Build one lead per target company
  const leads: SIDependentLead[] = [];

  let index = 0;
  for (const [companyKey, companyAnalyses] of companyMap) {
    index++;

    // Merge all signals across jobs for this company
    const allSignals: SISignal[] = [];
    const siPartners = new Set<string>();
    let bestJob = companyAnalyses[0].job;
    let bestDetectedAt = companyAnalyses[0].job.detectedAt;

    for (const analysis of companyAnalyses) {
      allSignals.push(...analysis.detection.signals);

      // Collect SI partner names
      for (const signal of analysis.detection.signals) {
        if (signal.siPartnerName) {
          siPartners.add(signal.siPartnerName);
        }
      }

      // Use the most recent job as the "best" representative
      if (analysis.job.detectedAt > bestDetectedAt) {
        bestDetectedAt = analysis.job.detectedAt;
        bestJob = analysis.job;
      }
    }

    // Deduplicate signals by category + source
    const uniqueSignals = deduplicateSignals(allSignals);

    // Compute dependency score
    const knownSIPartners = Array.from(siPartners);
    const dependencyScore = computeSIDependencyScore(uniqueSignals, knownSIPartners);

    // Skip leads below threshold
    if (dependencyScore < 30) continue;

    // Determine the target company name
    const targetCompanyName = companyAnalyses[0].targetCompany;

    // Parse location
    const { city, state } = parseLocation(bestJob.location);

    // Build company object
    const company: Company = {
      id: `si-company-${index}`,
      name: targetCompanyName,
      domain: "",
      linkedinUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(targetCompanyName)}`,
      website: `https://www.google.com/search?q=${encodeURIComponent(targetCompanyName)}`,
      industry: inferIndustry(companyAnalyses.map((a) => a.job)),
      employeeCount: 0,
      city,
      state,
      country: "US",
      websiteVerified: false,
    };

    // Infer SF complexity and relationship type
    const estimatedSFComplexity = inferSFComplexity(uniqueSignals, company.employeeCount);
    const siRelationshipType = inferSIRelationshipType(uniqueSignals);

    leads.push({
      id: `si-lead-${index}`,
      company,
      dependencyScore,
      signals: uniqueSignals,
      knownSIPartners,
      estimatedSFComplexity,
      siRelationshipType,
      contacts: [],
      firstDetected: bestDetectedAt || new Date().toISOString(),
      lastUpdated: bestDetectedAt || new Date().toISOString(),
    });
  }

  // Sort by dependency score descending
  leads.sort((a, b) => b.dependencyScore - a.dependencyScore);

  timer.end(`Built ${leads.length} SI-dependent leads from ${analyses.length} flagged jobs`, {
    totalJobs: jobs.length,
    flaggedJobs: analyses.length,
    leads: leads.length,
    uniqueCompanies: companyMap.size,
  });

  return leads;
}

export function getSIIndustriesFromLeads(leads: SIDependentLead[]): string[] {
  const industries = new Set(leads.map((l) => l.company.industry));
  return Array.from(industries).sort();
}

export function getTopSIPartners(leads: SIDependentLead[]): string[] {
  const partnerCounts = new Map<string, number>();
  for (const lead of leads) {
    for (const partner of lead.knownSIPartners) {
      partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1);
    }
  }
  return Array.from(partnerCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);
}

// ── Helpers ──────────────────────────────────────────────────────────

function deduplicateSignals(signals: SISignal[]): SISignal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const key = `${s.category}|${s.source}|${s.siPartnerName || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseLocation(location: string): { city: string; state: string } {
  if (!location) return { city: "", state: "" };
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
  return { city: cleaned, state: "" };
}

function inferIndustry(jobs: ScrapedJob[]): string {
  const allText = jobs.map((j) => `${j.title} ${j.description}`).join(" ").toLowerCase();
  const industryKeywords: Record<string, string[]> = {
    Healthcare: ["health", "medical", "clinical", "hospital", "pharma", "biotech"],
    Fintech: ["fintech", "financial", "banking", "payments", "lending", "insurance"],
    "Real Estate": ["real estate", "property", "mortgage", "realty"],
    Education: ["education", "edtech", "school", "university", "learning"],
    Logistics: ["logistics", "freight", "shipping", "supply chain", "warehouse"],
    Retail: ["retail", "ecommerce", "e-commerce", "shopping"],
    Manufacturing: ["manufacturing", "factory", "production"],
    "Non-Profit": ["nonprofit", "non-profit", "charity", "foundation", "npsp", "donor"],
    Tech: ["software", "saas", "platform", "cloud", "ai ", "machine learning"],
    Energy: ["energy", "solar", "renewable", "oil", "gas", "utility"],
  };
  for (const [industry, keywords] of Object.entries(industryKeywords)) {
    if (keywords.some((kw) => allText.includes(kw))) return industry;
  }
  return "Other";
}
