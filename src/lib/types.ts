// ── Signal & Lead Types ──────────────────────────────────────────────

export type SignalSource =
  | "linkedin"
  | "indeed"
  | "google_jobs"
  | "remoteok"
  | "arbeitnow"
  | "jobicy"
  | "himalayas"
  | "earnbetter"
  | "greenhouse"
  | "lever"
  | "builtwith"
  | "wappalyzer"
  | "crunchbase"
  | "apollo"
  | "appexchange"
  | "dns"
  | "news"
  | "wellfound"
  | "startup.jobs"
  | "ziprecruiter"
  | "glassdoor"
  | "builtin";

export type SignalCategory =
  | "technographic"
  | "job_posting"
  | "financial"
  | "public_footprint"
  | "infrastructure"
  | "executive_hire";

export interface Signal {
  id: string;
  category: SignalCategory;
  source: SignalSource;
  title: string;
  description: string;
  detectedAt: string; // ISO date
  weight: number; // points contributed
  raw?: string; // raw snippet / JD excerpt
  url?: string; // link to original job posting
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  linkedinUrl: string;
  website: string;
  industry: string;
  employeeCount: number;
  city: string;
  state: string;
  country: string;
  logoUrl?: string;
  websiteVerified?: boolean;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  email?: string;
  linkedinUrl: string;
  source: "apollo" | "hunter" | "linkedin" | "google";
  confidence?: "high" | "medium" | "low";
}

export interface HiringManager {
  title: string;                                       // e.g. "VP of Revenue Operations"
  name?: string;                                       // if known (from LinkedIn)
  linkedinUrl?: string;                                // if known (from LinkedIn)
  confidence: "high" | "medium" | "low";
  source: "linkedin" | "job_description" | "inferred"; // how we found them
}

export interface Lead {
  id: string;
  company: Company;
  score: number; // 0-100
  signals: Signal[];
  triggerEvent: string; // human-readable summary
  contacts: Contact[];
  hiringManager?: HiringManager; // likely person/role who owns the hiring decision
  firstDetected: string; // ISO date
  lastUpdated: string; // ISO date
  status: "new" | "reviewed" | "contacted" | "dismissed";
}

// ── Filter Types ─────────────────────────────────────────────────────

export type Timeframe = "24h" | "7d" | "30d";

export interface Filters {
  timeframe: Timeframe;
  companySizeMin: number;
  companySizeMax: number;
  industries: string[];
  minScore: number;
  sources: SignalSource[];
}

export const DEFAULT_FILTERS: Filters = {
  timeframe: "30d",
  companySizeMin: 0,
  companySizeMax: 100000,
  industries: [],
  minScore: 0,
  sources: [],
};

// ── Email Digest Types ───────────────────────────────────────────────

export interface DigestConfig {
  enabled: boolean;
  frequency: "daily" | "weekly";
  recipients: string[];
  minScoreThreshold: number;
  maxLeads: number;
}
