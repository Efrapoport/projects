import type { SISignalCategory, SISignal } from "./types";
import type { ScrapedJob } from "./scraper";
import { createLogger } from "./logger";

const log = createLogger("si-signals");

// ── Enterprise SIs (EXCLUDE — too big to compete with) ──────────────

export const ENTERPRISE_SI_EXCLUSION_LIST = [
  "deloitte", "deloitte digital",
  "accenture",
  "slalom",
  "cognizant",
  "wipro",
  "infosys",
  "ibm", "ibm consulting",
  "capgemini",
  "pwc", "pricewaterhousecoopers",
  "kpmg",
  "ey", "ernst & young", "ernst and young",
  "publicis sapient",
  "mckinsey", "mckinsey digital",
  "tata consultancy", "tcs",
  "hcl", "hcl technologies",
  "tech mahindra",
];

// ── Small/Niche SIs (our targets) ───────────────────────────────────

export const SMALL_SI_LIST = [
  "coastal cloud",
  "penrod",
  "torrent consulting",
  "kicksaw",
  "neocol",
  "plative",
  "roycon",
  "demand chain",
  "traction on demand",
  "simplus",
  "cloud giants",
  "opfocus",
  "galvin technologies",
  "copperhill consulting",
  "copperhill",
  "relationedge",
  "aptaria",
  "girikon",
  "corrao group",
  "webner solutions",
  "algoworks",
  "appshark",
  "cloudsquare",
  "cloudmasonry",
  "atrium",
  "silverline", "silverline crm",
  "configero",
  "sf advisors",
  "salesforce ben",
  "arkus",
  "7summits",
  "magnet360",
  "abstract",
  "ciellos",
  "cloudkettle",
  "cloudalyze",
  "makepositive",
  "peergenics",
  "symmetry consulting",
  "v2strategic",
  "concretio",
  "apphienz",
  "drivecrm",
  "saasnic",
  "forcetree",
  "cyntexa",
  "saasguru",
];

// ── Staffing Agencies ───────────────────────────────────────────────

export const STAFFING_AGENCIES = [
  "robert half",
  "teksystems",
  "tek systems",
  "apex systems",
  "kforce",
  "insight global",
  "hays",
  "modis", "akkodis",
  "harvey nash",
  "randstad",
  "kelly services",
  "adecco",
  "manpower",
  "manpowergroup",
  "staffing agency",
  "contract staffing",
  "mason frank",
  "ntt data",
];

// ── SI-Dependency Detection Patterns ─────────────────────────────────

const CONSULTANT_TITLE_PATTERNS = [
  /salesforce\s+consultant/i,
  /sfdc\s+consultant/i,
  /salesforce\s+contractor/i,
  /contract\s+salesforce/i,
  /freelance\s+salesforce/i,
  /salesforce\s+freelance/i,
  /salesforce\s+advisory/i,
  /crm\s+consultant/i,
  /salesforce\s+implementation\s+consultant/i,
];

const MANAGED_SERVICES_PATTERNS = [
  /managed\s+services/i,
  /outsourced\s+(?:administration|admin|support)/i,
  /third[- ]party\s+(?:support|admin|management)/i,
  /external\s+(?:consultant|contractor|partner|vendor)/i,
  /implementation\s+partner/i,
  /consulting\s+engagement/i,
  /sow[- ]based/i,
  /statement\s+of\s+work/i,
  /managed\s+(?:salesforce|crm|sfdc)/i,
];

const CONTRACT_PATTERNS = [
  /contract[- ]to[- ]hire/i,
  /\b(?:6|12|3)[- ]month\s+(?:engagement|contract|assignment)/i,
  /temp[- ]to[- ]perm/i,
  /temporary\s+(?:salesforce|sfdc|crm)/i,
  /short[- ]term\s+(?:contract|engagement|assignment)/i,
  /(?:contract|temp)\s+(?:role|position|assignment)/i,
  /\bw2\s+contract/i,
  /\b1099\s+(?:contract|contractor)/i,
  /corp[- ]to[- ]corp/i,
];

// ── Core Detection Functions ─────────────────────────────────────────

function normalizeCompany(name: string): string {
  return name.toLowerCase().trim();
}

function isEnterpriseSI(name: string): boolean {
  const normalized = normalizeCompany(name);
  return ENTERPRISE_SI_EXCLUSION_LIST.some((si) => normalized.includes(si));
}

function isSmallSI(name: string): boolean {
  const normalized = normalizeCompany(name);
  return SMALL_SI_LIST.some((si) => normalized.includes(si));
}

function isStaffingAgency(name: string): boolean {
  const normalized = normalizeCompany(name);
  return STAFFING_AGENCIES.some((agency) => normalized.includes(agency));
}

function matchesConsultantTitle(title: string): boolean {
  return CONSULTANT_TITLE_PATTERNS.some((p) => p.test(title));
}

function matchesManagedServices(text: string): boolean {
  return MANAGED_SERVICES_PATTERNS.some((p) => p.test(text));
}

function matchesContractPattern(text: string): boolean {
  return CONTRACT_PATTERNS.some((p) => p.test(text));
}

/** Try to extract a client company name from a job posted by an SI or staffing firm.
 *  Patterns: "for our client [Company]", "on behalf of [Company]", "[Company] (client)" */
function extractClientCompany(description: string): string | null {
  const patterns = [
    /(?:for\s+(?:our\s+)?client|on\s+behalf\s+of|client\s*:\s*)\s+([A-Z][A-Za-z0-9\s&.,'()-]{2,40}?)(?:\.|,|\s+in\s|\s+is\s|\s+located|\s+based|$)/i,
    /([A-Z][A-Za-z0-9\s&.,'()-]{2,40}?)\s+\((?:client|end[- ]client|customer)\)/i,
    /working\s+(?:with|at|for)\s+([A-Z][A-Za-z0-9\s&.,'()-]{2,40}?)(?:'s)?\s+(?:salesforce|sfdc|crm)/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const extracted = match[1].trim();
      // Don't extract if it's another SI or too generic
      if (extracted.length > 2 && extracted.length < 50 && !isSmallSI(extracted) && !isStaffingAgency(extracted)) {
        return extracted;
      }
    }
  }
  return null;
}

// ── Main Detection Engine ────────────────────────────────────────────

export interface SIDetectionResult {
  signals: SISignal[];
  clientCompany: string | null; // if the job was posted by an SI/agency for a client
  isEnterpriseSIClient: boolean; // if an enterprise SI is involved → exclude
  postingCompanyType: "small_si" | "staffing_agency" | "direct" | "enterprise_si";
}

export function detectSISignals(job: ScrapedJob, index: number): SIDetectionResult {
  const signals: SISignal[] = [];
  let clientCompany: string | null = null;
  let isEnterpriseSIClient = false;
  let postingCompanyType: SIDetectionResult["postingCompanyType"] = "direct";

  const title = job.title;
  const desc = job.description || "";
  const company = job.company;
  const combined = `${title} ${desc}`;

  // ── Check if posting company is an enterprise SI → EXCLUDE
  if (isEnterpriseSI(company)) {
    isEnterpriseSIClient = true;
    postingCompanyType = "enterprise_si";
    return { signals, clientCompany: null, isEnterpriseSIClient, postingCompanyType };
  }

  // ── Check for enterprise SI mention in description → EXCLUDE
  for (const si of ENTERPRISE_SI_EXCLUSION_LIST) {
    if (desc.toLowerCase().includes(si) && combined.toLowerCase().includes("partner")) {
      isEnterpriseSIClient = true;
      return { signals, clientCompany: null, isEnterpriseSIClient, postingCompanyType };
    }
  }

  const signalId = (n: number) => `si-${index}-s${n}`;
  let signalCounter = 0;

  // ── Signal 1: Job posted by a small SI mentioning a client (+20)
  if (isSmallSI(company)) {
    postingCompanyType = "small_si";
    clientCompany = extractClientCompany(desc);
    signalCounter++;
    signals.push({
      id: signalId(signalCounter),
      category: "si_partner_posting",
      source: job.source,
      title: `Small SI "${company}" posting SF role`,
      description: clientCompany
        ? `${company} posted a "${title}" role for client ${clientCompany}. This company relies on an external SI for Salesforce work.`
        : `${company} (a small SF consultancy) posted a "${title}" role. Their clients likely have no in-house SF expertise.`,
      detectedAt: job.detectedAt,
      weight: 20,
      url: job.url,
      siPartnerName: company,
      clientCompanyExtracted: clientCompany || undefined,
    });
  }

  // ── Signal 2: Job posted by a staffing agency (+20)
  if (isStaffingAgency(company)) {
    postingCompanyType = "staffing_agency";
    clientCompany = extractClientCompany(desc);
    signalCounter++;
    signals.push({
      id: signalId(signalCounter),
      category: "staffing_agency",
      source: job.source,
      title: `Staffing agency "${company}" placing SF contractor`,
      description: clientCompany
        ? `${company} is placing a Salesforce contractor at ${clientCompany}. Companies using staffing agencies for SF work typically lack in-house expertise.`
        : `${company} is placing a Salesforce contractor. The end-client likely has no in-house SF team.`,
      detectedAt: job.detectedAt,
      weight: 20,
      url: job.url,
      siPartnerName: company,
      clientCompanyExtracted: clientCompany || undefined,
    });
  }

  // ── Signal 3: Consultant/contractor title (+25)
  if (matchesConsultantTitle(title)) {
    signalCounter++;
    signals.push({
      id: signalId(signalCounter),
      category: "consultant_hiring",
      source: job.source,
      title: `Hiring SF consultant/contractor: "${title}"`,
      description: `${company} is hiring a "${title}" — a consultant/contractor role rather than a full-time admin. This suggests outsourced SF operations.`,
      detectedAt: job.detectedAt,
      weight: 25,
      url: job.url,
      siPartnerName: postingCompanyType !== "direct" ? company : undefined,
    });
  }

  // ── Signal 4: Managed services language (+15)
  if (matchesManagedServices(combined)) {
    signalCounter++;
    signals.push({
      id: signalId(signalCounter),
      category: "managed_services",
      source: job.source,
      title: `Managed services / outsourced SF work`,
      description: `The posting mentions managed services, outsourced support, or third-party administration — indicating the company relies on external partners for Salesforce operations.`,
      detectedAt: job.detectedAt,
      weight: 15,
      url: job.url,
    });
  }

  // ── Signal 5: Contract/temp patterns (+15)
  if (matchesContractPattern(combined)) {
    signalCounter++;
    signals.push({
      id: signalId(signalCounter),
      category: "contract_pattern",
      source: job.source,
      title: `Contract/temp SF role pattern`,
      description: `The posting indicates a contract, temp, or SOW-based engagement — typical of companies that outsource SF work instead of building in-house capability.`,
      detectedAt: job.detectedAt,
      weight: 15,
      url: job.url,
    });
  }

  return { signals, clientCompany, isEnterpriseSIClient, postingCompanyType };
}

// ── Batch Processing ─────────────────────────────────────────────────

export interface SIJobAnalysis {
  job: ScrapedJob;
  detection: SIDetectionResult;
  targetCompany: string; // the company to target (client or posting company)
}

/** Analyze a batch of jobs for SI-dependency signals.
 *  Returns only jobs that have at least one signal and aren't enterprise-SI clients. */
export function analyzeSIJobs(jobs: ScrapedJob[]): SIJobAnalysis[] {
  const timer = log.time("si-analysis");
  const results: SIJobAnalysis[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const detection = detectSISignals(job, i);

    // Skip enterprise SI clients
    if (detection.isEnterpriseSIClient) {
      log.debug(`Excluded (enterprise SI): ${job.company} — ${job.title}`);
      continue;
    }

    // Only keep jobs with SI-dependency signals
    if (detection.signals.length === 0) continue;

    // The company to target: if an SI/agency posted for a client, target the client
    const targetCompany = detection.clientCompany || job.company;

    results.push({ job, detection, targetCompany });
  }

  timer.end(`Analyzed ${jobs.length} jobs`, {
    total: jobs.length,
    withSignals: results.length,
  });

  return results;
}

// ── Scoring ──────────────────────────────────────────────────────────

export function computeSIDependencyScore(signals: SISignal[], knownSIPartners: string[]): number {
  const baseScore = signals.reduce((sum, s) => sum + s.weight, 0);

  // Bonus: multiple distinct SIs = fragmented, no ownership
  const multiSIBonus = knownSIPartners.length > 1 ? 10 : 0;

  return Math.min(100, baseScore + multiSIBonus);
}

export function inferSFComplexity(signals: SISignal[], employeeCount: number): "basic" | "moderate" | "complex" {
  const text = signals.map((s) => `${s.title} ${s.description}`).join(" ").toLowerCase();

  if (
    text.includes("architect") ||
    text.includes("complex") ||
    text.includes("multi-cloud") ||
    text.includes("cpq") ||
    text.includes("integration") ||
    employeeCount > 1000
  ) {
    return "complex";
  }

  if (
    text.includes("developer") ||
    text.includes("apex") ||
    text.includes("lightning") ||
    text.includes("custom") ||
    employeeCount > 200
  ) {
    return "moderate";
  }

  return "basic";
}

export function inferSIRelationshipType(
  signals: SISignal[],
): "full_outsource" | "staff_augmentation" | "project_based" {
  const categories = new Set(signals.map((s) => s.category));

  if (categories.has("managed_services") || categories.has("si_partner_posting")) {
    return "full_outsource";
  }

  if (categories.has("staffing_agency") || categories.has("contract_pattern")) {
    return "staff_augmentation";
  }

  return "project_based";
}
