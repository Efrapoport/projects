import { Lead, Filters } from "./types";

/**
 * Apply dashboard filters to a list of leads.
 */
export function applyFilters(leads: Lead[], filters: Filters): Lead[] {
  const now = Date.now();

  const timeframeMs: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };

  return leads.filter((lead) => {
    // Timeframe filter — check if any signal was detected within the window
    const cutoff = now - (timeframeMs[filters.timeframe] || timeframeMs["7d"]);
    const hasRecentSignal = lead.signals.some(
      (s) => new Date(s.detectedAt).getTime() >= cutoff
    );
    if (!hasRecentSignal) return false;

    // Company size filter
    const size = lead.company.employeeCount;
    if (size < filters.companySizeMin || size > filters.companySizeMax) {
      return false;
    }

    // Industry filter
    if (
      filters.industries.length > 0 &&
      !filters.industries.includes(lead.company.industry)
    ) {
      return false;
    }

    // Minimum score filter
    if (lead.score < filters.minScore) {
      return false;
    }

    // Source filter
    if (filters.sources.length > 0) {
      const leadSources = new Set(lead.signals.map((s) => s.source));
      const hasMatchingSource = filters.sources.some((src) =>
        leadSources.has(src)
      );
      if (!hasMatchingSource) return false;
    }

    return true;
  });
}
