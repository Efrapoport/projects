// ── Mock Investor Catalog & Funding Relationships ───────────────────
//
// This module provides a seed catalog of well-known investors and maps
// them to companies that appear in our scraped lead data.  All data is
// mock — designed so real APIs (Crunchbase, PitchBook, etc.) can be
// plugged in later without changing the interface.
//
// RELATIONSHIP DEFINITION
// -----------------------
// A "relationship" in this system means:
//
//   An investor participated in a **funding round** for the company.
//
// This is the only relationship type we track today (`type: "funding"`).
// A funding relationship is established when an investor is listed as a
// participant (lead or co-investor) in a company's equity financing
// round (Seed, Series A, Series B, etc.).
//
// Confidence levels:
//   • high   — investor led the round (named lead in press release)
//   • medium — investor participated but did not lead
//   • low    — investor rumored or inferred from secondary sources
//
// Future relationship types (not yet implemented):
//   • board_seat       — investor holds a board seat at the company
//   • portfolio_overlap — investor also funded another lead in the dashboard

import { Investor, InvestorRelationship } from "./types";

// ── Investor Catalog ────────────────────────────────────────────────

export const INVESTOR_CATALOG: Investor[] = [
  {
    id: "sequoia",
    name: "Sequoia Capital",
    website: "https://www.sequoiacap.com",
    linkedinUrl: "https://www.linkedin.com/company/sequoia-capital",
  },
  {
    id: "accel",
    name: "Accel",
    website: "https://www.accel.com",
    linkedinUrl: "https://www.linkedin.com/company/accel-partners",
  },
  {
    id: "a16z",
    name: "Andreessen Horowitz",
    website: "https://a16z.com",
    linkedinUrl: "https://www.linkedin.com/company/andreessen-horowitz",
  },
  {
    id: "insight",
    name: "Insight Partners",
    website: "https://www.insightpartners.com",
    linkedinUrl: "https://www.linkedin.com/company/insight-partners",
  },
  {
    id: "craft",
    name: "Craft Ventures",
    website: "https://www.craftventures.com",
    linkedinUrl: "https://www.linkedin.com/company/craft-ventures",
  },
  {
    id: "iconiq",
    name: "ICONIQ Growth",
    website: "https://www.iconiqcapital.com",
    linkedinUrl: "https://www.linkedin.com/company/iconiq-capital",
  },
  {
    id: "tiger",
    name: "Tiger Global",
    website: "https://www.tigerglobal.com",
    linkedinUrl: "https://www.linkedin.com/company/tiger-global-management",
  },
  {
    id: "thoma",
    name: "Thoma Bravo",
    website: "https://www.thomabravo.com",
    linkedinUrl: "https://www.linkedin.com/company/thoma-bravo",
  },
];

// Default investors pre-selected for new users
export const DEFAULT_TRACKED_IDS = ["sequoia", "a16z", "insight"];

// ── Company → Investor Funding Map ──────────────────────────────────
// Keys are lowercased company names.  Each entry lists the investor ID,
// round details, and confidence level.

interface FundingEntry {
  investorId: string;
  details: string;
  confidence: "high" | "medium" | "low";
}

const COMPANY_FUNDING_MAP: Record<string, FundingEntry[]> = {
  // Companies from scraped-jobs-data.ts
  vanta: [
    { investorId: "sequoia", details: "Led Series B ($110M, Jun 2023)", confidence: "high" },
    { investorId: "craft", details: "Participated in Series A ($50M)", confidence: "medium" },
  ],
  knowbe4: [
    { investorId: "insight", details: "Led growth round ($3.5B take-private, 2022)", confidence: "high" },
  ],
  smartsheet: [
    { investorId: "insight", details: "Led Series D ($150M, 2017)", confidence: "high" },
  ],
  "sprout social": [
    { investorId: "insight", details: "Growth investment ($40M, 2019)", confidence: "medium" },
  ],
  filevine: [
    { investorId: "thoma", details: "Participated in growth equity round ($108M)", confidence: "medium" },
  ],
  "built technologies": [
    { investorId: "tiger", details: "Participated in Series D ($213M, 2022)", confidence: "medium" },
    { investorId: "insight", details: "Led Series C ($88M, 2021)", confidence: "high" },
  ],
  logicgate: [
    { investorId: "a16z", details: "Led Series B ($24.5M, 2021)", confidence: "high" },
  ],
  "blink health": [
    { investorId: "a16z", details: "Participated in early rounds", confidence: "low" },
  ],
  varonis: [
    { investorId: "thoma", details: "Take-private ($4.1B, 2024)", confidence: "high" },
  ],
  g2: [
    { investorId: "accel", details: "Led Series B ($55M, 2019)", confidence: "high" },
    { investorId: "iconiq", details: "Participated in Series D ($157M, 2021)", confidence: "medium" },
  ],
  restaurant365: [
    { investorId: "iconiq", details: "Led Series D ($175M, 2022)", confidence: "high" },
    { investorId: "tiger", details: "Participated in Series D ($175M, 2022)", confidence: "medium" },
  ],
  gocardless: [
    { investorId: "accel", details: "Led Series C ($75M, 2019)", confidence: "high" },
  ],
  newsela: [
    { investorId: "tiger", details: "Participated in Series D ($100M, 2021)", confidence: "medium" },
    { investorId: "insight", details: "Growth investment", confidence: "low" },
  ],
  comscore: [
    { investorId: "thoma", details: "Strategic investment", confidence: "low" },
  ],
  labcorp: [
    { investorId: "iconiq", details: "Public market position", confidence: "low" },
  ],
};

// ── Lookup Function ─────────────────────────────────────────────────

/**
 * Returns investor relationships for a given company, filtered to only
 * include the user's tracked investors.
 *
 * @param companyName  - The company name from the lead (case-insensitive)
 * @param trackedIds   - Set of investor IDs the user is currently tracking
 * @returns            - Array of InvestorRelationship objects (may be empty)
 */
export function getRelationshipsForCompany(
  companyName: string,
  trackedIds: Set<string>,
): InvestorRelationship[] {
  const key = companyName.toLowerCase().trim();
  const entries = COMPANY_FUNDING_MAP[key];
  if (!entries) return [];

  const investorMap = new Map(INVESTOR_CATALOG.map((inv) => [inv.id, inv]));

  return entries
    .filter((entry) => trackedIds.has(entry.investorId))
    .map((entry) => {
      const investor = investorMap.get(entry.investorId)!;
      return {
        investorId: entry.investorId,
        investorName: investor.name,
        type: "funding" as const,
        details: entry.details,
        confidence: entry.confidence,
      };
    });
}

/**
 * Returns the count of leads (by company name) that have at least one
 * funding relationship with a given investor.  Used in the Investor
 * Manager UI to show "N connected leads".
 */
export function countLeadsForInvestor(
  investorId: string,
  companyNames: string[],
): number {
  let count = 0;
  for (const name of companyNames) {
    const key = name.toLowerCase().trim();
    const entries = COMPANY_FUNDING_MAP[key];
    if (entries?.some((e) => e.investorId === investorId)) {
      count++;
    }
  }
  return count;
}
