import { Signal, Lead } from "./types";

// ── Scoring Constants ────────────────────────────────────────────────

const HIGH_WEIGHT = 20;
const MEDIUM_WEIGHT = 10;
const LOW_WEIGHT = 5;

// High-weight keywords in job descriptions
const HIGH_WEIGHT_JD_KEYWORDS = [
  "build from scratch",
  "initial setup",
  "greenfield",
  "sole contributor",
  "first salesforce",
  "owning our instance",
  "transition from",
  "migrating from",
  "standing up",
  "net new",
  "founding",
];

// Medium-weight keywords
const MEDIUM_WEIGHT_JD_KEYWORDS = [
  "salesforce administrator",
  "salesforce admin",
  "salesforce developer",
  "salesforce engineer",
  "crm implementation",
  "crm migration",
];

// ── Scoring Functions ────────────────────────────────────────────────

/**
 * Score a single signal based on its category, source, and content.
 */
export function scoreSignal(signal: Signal): number {
  let score = 0;

  // High-weight: First-time Salesforce job posting with "first admin" indicators
  if (signal.category === "job_posting") {
    const text = (signal.description + " " + (signal.raw || "")).toLowerCase();

    for (const kw of HIGH_WEIGHT_JD_KEYWORDS) {
      if (text.includes(kw)) {
        score += HIGH_WEIGHT;
        break; // only count once for high-weight keywords
      }
    }

    for (const kw of MEDIUM_WEIGHT_JD_KEYWORDS) {
      if (text.includes(kw)) {
        score += MEDIUM_WEIGHT;
        break;
      }
    }
  }

  // High-weight: Technographic change (new Salesforce detection)
  if (signal.category === "technographic") {
    const daysSinceDetection = daysSince(signal.detectedAt);
    if (daysSinceDetection <= 30) {
      score += HIGH_WEIGHT;
    } else if (daysSinceDetection <= 90) {
      score += MEDIUM_WEIGHT;
    }
  }

  // Medium-weight: Recent funding
  if (signal.category === "financial") {
    const text = signal.description.toLowerCase();
    if (text.includes("series a") || text.includes("series b")) {
      score += MEDIUM_WEIGHT;
    } else {
      score += LOW_WEIGHT;
    }
  }

  // Medium-weight: Executive hire (VP Sales, Head of RevOps)
  if (signal.category === "executive_hire") {
    score += MEDIUM_WEIGHT;
  }

  // Medium-weight: AppExchange / public footprint
  if (signal.category === "public_footprint") {
    score += MEDIUM_WEIGHT;
  }

  // High-weight: DNS change pointing to Salesforce
  if (signal.category === "infrastructure") {
    const daysSinceDetection = daysSince(signal.detectedAt);
    if (daysSinceDetection <= 30) {
      score += HIGH_WEIGHT;
    } else {
      score += LOW_WEIGHT;
    }
  }

  return score;
}

/**
 * Compute the total lead score from all signals.
 * Normalised to 0–100.
 */
export function computeLeadScore(signals: Signal[]): number {
  const rawTotal = signals.reduce((sum, s) => sum + scoreSignal(s), 0);
  // Cap at 100, with a theoretical max around ~100 for 3-4 strong signals
  return Math.min(100, rawTotal);
}

/**
 * Generate a human-readable trigger event summary from the top signals.
 */
export function generateTriggerEvent(signals: Signal[]): string {
  const scored = signals
    .map((s) => ({ signal: s, score: scoreSignal(s) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return "No signals detected.";

  const parts: string[] = [];
  const top = scored.slice(0, 2);

  for (const { signal } of top) {
    parts.push(signal.title);
  }

  const timeAgo = formatTimeAgo(scored[0].signal.detectedAt);
  return `${parts.join("; ")} — ${timeAgo}`;
}

// ── Helpers ──────────────────────────────────────────────────────────

function daysSince(isoDate: string): number {
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatTimeAgo(isoDate: string): string {
  if (!isoDate) return "date unknown";
  const ms = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "date unknown";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}
