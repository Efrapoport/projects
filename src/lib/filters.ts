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
    // Timeframe filter — check if any signal was detected within the window.
    // Leads with unknown/missing dates are INCLUDED (not silently dropped)
    // since missing a date doesn't mean the lead is old — scrapers often
    // fail to provide a date for valid, recent postings.
    const cutoff = now - (timeframeMs[filters.timeframe] || timeframeMs["7d"]);
    const hasRecentSignal = lead.signals.some((s) => {
      if (!s.detectedAt) return true; // unknown date → include
      const ts = new Date(s.detectedAt).getTime();
      if (!Number.isFinite(ts)) return true; // invalid date → include
      return ts >= cutoff;
    });
    if (!hasRecentSignal) return false;

    return true;
  });
}
