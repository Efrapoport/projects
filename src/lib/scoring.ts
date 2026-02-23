import { Signal, Contact, HiringManager, InvestorRelationship } from "./types";

// ── Scoring Constants ────────────────────────────────────────────────

const HIGH_WEIGHT = 20;
const MEDIUM_WEIGHT = 10;
const LOW_WEIGHT = 5;

// LinkedIn contact quality bonuses
const LINKEDIN_HIGH_CONFIDENCE_BONUS = 15;
const LINKEDIN_MEDIUM_CONFIDENCE_BONUS = 10;

// Investor relationship bonuses
const INVESTOR_FIRST_BONUS = 15;
const INVESTOR_ADDITIONAL_BONUS = 5;
const INVESTOR_MAX_BONUS = 25;

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
 * Score the quality of LinkedIn contacts / hiring manager.
 * A strong LinkedIn-found decision-maker means we can reach out
 * directly, which makes the lead significantly more actionable.
 */
export function scoreContactQuality(
  contacts: Contact[],
  hiringManager?: HiringManager,
): number {
  // Best: high-confidence LinkedIn contact with a profile URL
  const hasHighConfidenceLinkedIn = contacts.some(
    (c) => c.confidence === "high" && c.linkedinUrl,
  );
  if (hasHighConfidenceLinkedIn) return LINKEDIN_HIGH_CONFIDENCE_BONUS;

  // High-confidence hiring manager found via LinkedIn
  if (
    hiringManager &&
    hiringManager.source === "linkedin" &&
    hiringManager.confidence === "high"
  ) {
    return LINKEDIN_HIGH_CONFIDENCE_BONUS;
  }

  // Medium-confidence LinkedIn contact
  const hasMediumConfidenceLinkedIn = contacts.some(
    (c) => c.confidence === "medium" && c.linkedinUrl,
  );
  if (hasMediumConfidenceLinkedIn) return LINKEDIN_MEDIUM_CONFIDENCE_BONUS;

  if (
    hiringManager &&
    hiringManager.source === "linkedin" &&
    hiringManager.confidence === "medium"
  ) {
    return LINKEDIN_MEDIUM_CONFIDENCE_BONUS;
  }

  return 0;
}

/**
 * Score investor connections. A lead backed by a tracked investor
 * is a warm intro opportunity — significantly higher conversion.
 */
export function scoreInvestorConnections(
  relationships: InvestorRelationship[],
): number {
  if (relationships.length === 0) return 0;
  const bonus =
    INVESTOR_FIRST_BONUS +
    (relationships.length - 1) * INVESTOR_ADDITIONAL_BONUS;
  return Math.min(bonus, INVESTOR_MAX_BONUS);
}

/**
 * Compute the total lead score from all signals plus optional
 * enrichment data (LinkedIn contacts, investor relationships).
 * Normalised to 0–100.
 */
export function computeLeadScore(
  signals: Signal[],
  options?: {
    contacts?: Contact[];
    hiringManager?: HiringManager;
    investorRelationships?: InvestorRelationship[];
  },
): number {
  const signalTotal = signals.reduce((sum, s) => sum + scoreSignal(s), 0);
  const contactBonus = options?.contacts
    ? scoreContactQuality(options.contacts, options.hiringManager)
    : 0;
  const investorBonus = options?.investorRelationships
    ? scoreInvestorConnections(options.investorRelationships)
    : 0;
  // Cap at 100
  return Math.min(100, signalTotal + contactBonus + investorBonus);
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
