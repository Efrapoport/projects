import { Lead, Signal, Company, Contact } from "./types";
import { computeLeadScore, generateTriggerEvent } from "./scoring";

// ── Helper ───────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgo(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

// ── Companies ────────────────────────────────────────────────────────

const companies: Company[] = [
  {
    id: "c1",
    name: "NovaPay",
    domain: "novapay.io",
    linkedinUrl: "https://linkedin.com/company/novapay",
    website: "https://novapay.io",
    industry: "Fintech",
    employeeCount: 120,
    city: "Austin",
    state: "TX",
    country: "US",
  },
  {
    id: "c2",
    name: "MedVault Health",
    domain: "medvaulthealth.com",
    linkedinUrl: "https://linkedin.com/company/medvault-health",
    website: "https://medvaulthealth.com",
    industry: "Healthcare",
    employeeCount: 85,
    city: "Boston",
    state: "MA",
    country: "US",
  },
  {
    id: "c3",
    name: "Cirrus Logistics",
    domain: "cirruslogistics.com",
    linkedinUrl: "https://linkedin.com/company/cirrus-logistics",
    website: "https://cirruslogistics.com",
    industry: "Logistics",
    employeeCount: 210,
    city: "Chicago",
    state: "IL",
    country: "US",
  },
  {
    id: "c4",
    name: "BrightEdge AI",
    domain: "brightedge.ai",
    linkedinUrl: "https://linkedin.com/company/brightedge-ai",
    website: "https://brightedge.ai",
    industry: "Tech",
    employeeCount: 67,
    city: "San Francisco",
    state: "CA",
    country: "US",
  },
  {
    id: "c5",
    name: "GreenLeaf Energy",
    domain: "greenleafenergy.co",
    linkedinUrl: "https://linkedin.com/company/greenleaf-energy",
    website: "https://greenleafenergy.co",
    industry: "CleanTech",
    employeeCount: 340,
    city: "Denver",
    state: "CO",
    country: "US",
  },
  {
    id: "c6",
    name: "StackReach",
    domain: "stackreach.io",
    linkedinUrl: "https://linkedin.com/company/stackreach",
    website: "https://stackreach.io",
    industry: "Tech",
    employeeCount: 52,
    city: "New York",
    state: "NY",
    country: "US",
  },
  {
    id: "c7",
    name: "Pinnacle Insurance Group",
    domain: "pinnacleig.com",
    linkedinUrl: "https://linkedin.com/company/pinnacle-insurance-group",
    website: "https://pinnacleig.com",
    industry: "Insurance",
    employeeCount: 475,
    city: "Dallas",
    state: "TX",
    country: "US",
  },
  {
    id: "c8",
    name: "Verbo",
    domain: "verbo.app",
    linkedinUrl: "https://linkedin.com/company/verbo-app",
    website: "https://verbo.app",
    industry: "EdTech",
    employeeCount: 95,
    city: "Seattle",
    state: "WA",
    country: "US",
  },
  {
    id: "c9",
    name: "TradeFloor",
    domain: "tradefloor.com",
    linkedinUrl: "https://linkedin.com/company/tradefloor",
    website: "https://tradefloor.com",
    industry: "Fintech",
    employeeCount: 180,
    city: "Miami",
    state: "FL",
    country: "US",
  },
  {
    id: "c10",
    name: "Halo Biotech",
    domain: "halobiotech.com",
    linkedinUrl: "https://linkedin.com/company/halo-biotech",
    website: "https://halobiotech.com",
    industry: "Healthcare",
    employeeCount: 150,
    city: "San Diego",
    state: "CA",
    country: "US",
  },
  {
    id: "c11",
    name: "Relay Freight",
    domain: "relayfreight.com",
    linkedinUrl: "https://linkedin.com/company/relay-freight",
    website: "https://relayfreight.com",
    industry: "Logistics",
    employeeCount: 290,
    city: "Atlanta",
    state: "GA",
    country: "US",
  },
  {
    id: "c12",
    name: "Optera Climate",
    domain: "optera.io",
    linkedinUrl: "https://linkedin.com/company/optera-climate",
    website: "https://optera.io",
    industry: "CleanTech",
    employeeCount: 78,
    city: "Boulder",
    state: "CO",
    country: "US",
  },
];

// ── Signals ──────────────────────────────────────────────────────────

const signalSets: Record<string, Signal[]> = {
  c1: [
    {
      id: "s1",
      category: "job_posting",
      source: "linkedin",
      title: "Posted 'First Salesforce Admin' on LinkedIn",
      description:
        "NovaPay is hiring their first Salesforce Administrator to build from scratch and own the CRM instance. Greenfield implementation.",
      detectedAt: hoursAgo(4),
      weight: 20,
      raw: `We're looking for our first Salesforce Administrator to own our instance end-to-end. You'll be building from scratch — setting up Sales Cloud, configuring flows, managing integrations, and being the sole contributor on all things Salesforce. This is a greenfield implementation as we transition from HubSpot. Ideal for someone who loves standing up a new org.`,
    },
    {
      id: "s2",
      category: "technographic",
      source: "builtwith",
      title: "Salesforce scripts detected on novapay.io",
      description:
        "BuiltWith detected force.com and pardot.com script tags appearing on novapay.io for the first time.",
      detectedAt: daysAgo(3),
      weight: 20,
    },
    {
      id: "s3",
      category: "financial",
      source: "crunchbase",
      title: "Series B funding: $28M",
      description:
        "NovaPay raised a $28M Series B led by Accel Partners. Growth-stage funding typically drives CRM adoption.",
      detectedAt: daysAgo(12),
      weight: 10,
    },
  ],
  c2: [
    {
      id: "s4",
      category: "job_posting",
      source: "greenhouse",
      title: "Posted 'Salesforce Developer' on Greenhouse",
      description:
        "MedVault Health is hiring a Salesforce Developer for initial setup of Health Cloud. Migrating from spreadsheets.",
      detectedAt: hoursAgo(18),
      weight: 20,
      raw: `MedVault Health is seeking a Salesforce Developer to lead our initial setup of Salesforce Health Cloud. We're currently managing patient relationships in spreadsheets and need someone to build a proper CRM foundation. You'll be the sole contributor responsible for data model design, HIPAA-compliant configuration, and integration with our EHR systems. This is a net new Salesforce implementation.`,
    },
    {
      id: "s5",
      category: "infrastructure",
      source: "dns",
      title: "New SPF/DKIM records pointing to Salesforce",
      description:
        "DNS monitoring detected new SPF and DKIM records on medvaulthealth.com pointing to Salesforce mail servers.",
      detectedAt: daysAgo(5),
      weight: 20,
    },
    {
      id: "s6",
      category: "executive_hire",
      source: "linkedin",
      title: "New VP of Sales joined from Salesforce shop",
      description:
        "Sarah Chen joined as VP of Sales. Previously at a heavy Salesforce org — likely to bring SFDC with her.",
      detectedAt: daysAgo(20),
      weight: 10,
    },
  ],
  c3: [
    {
      id: "s7",
      category: "job_posting",
      source: "indeed",
      title: "Posted 'CRM Administrator' on Indeed",
      description:
        "Cirrus Logistics posted for a CRM Administrator. JD mentions 'implementing Salesforce for the first time.'",
      detectedAt: daysAgo(1),
      weight: 20,
      raw: `Cirrus Logistics is looking for a CRM Administrator to lead our Salesforce implementation. We are implementing Salesforce for the first time as we transition from our legacy CRM system. You'll work closely with our VP of Operations to design workflows, manage data migration, and train our sales team. Experience with Sales Cloud and CPQ is a plus.`,
    },
    {
      id: "s8",
      category: "financial",
      source: "crunchbase",
      title: "Series A funding: $15M",
      description:
        "Cirrus Logistics closed a $15M Series A. Scaling operations often triggers CRM investment.",
      detectedAt: daysAgo(30),
      weight: 10,
    },
  ],
  c4: [
    {
      id: "s9",
      category: "technographic",
      source: "wappalyzer",
      title: "Salesforce detected on brightedge.ai",
      description:
        "Wappalyzer first detected Salesforce-related scripts on brightedge.ai. Previously only showed HubSpot.",
      detectedAt: daysAgo(7),
      weight: 20,
    },
    {
      id: "s10",
      category: "job_posting",
      source: "lever",
      title: "Posted 'Salesforce Engineer' on Lever",
      description:
        "BrightEdge AI is hiring a Salesforce Engineer. JD mentions 'owning our instance' and 'transition from HubSpot.'",
      detectedAt: daysAgo(2),
      weight: 20,
      raw: `BrightEdge AI is looking for a Salesforce Engineer who will be owning our instance as we transition from HubSpot to Salesforce. You'll be responsible for building out our Sales Cloud org from the ground up, integrating with our existing tech stack, and establishing best practices. This is a founding role — you'll shape how our entire go-to-market team uses Salesforce.`,
    },
    {
      id: "s11",
      category: "executive_hire",
      source: "linkedin",
      title: "New Head of RevOps joined",
      description:
        "Marcus Johnson joined as Head of RevOps. His LinkedIn shows 8 years of Salesforce experience.",
      detectedAt: daysAgo(14),
      weight: 10,
    },
    {
      id: "s12",
      category: "financial",
      source: "crunchbase",
      title: "Series A funding: $12M",
      description: "BrightEdge AI raised $12M Series A from a16z.",
      detectedAt: daysAgo(45),
      weight: 10,
    },
  ],
  c5: [
    {
      id: "s13",
      category: "public_footprint",
      source: "appexchange",
      title: "New AppExchange review for Conga by GreenLeaf employee",
      description:
        "An employee at GreenLeaf Energy left a review on the Conga AppExchange listing, suggesting new Salesforce adoption.",
      detectedAt: daysAgo(6),
      weight: 10,
    },
    {
      id: "s14",
      category: "infrastructure",
      source: "dns",
      title: "New force.com DNS entries detected",
      description:
        "DNS monitoring found new CNAME records pointing to force.com on greenleafenergy.co.",
      detectedAt: daysAgo(10),
      weight: 20,
    },
    {
      id: "s15",
      category: "job_posting",
      source: "linkedin",
      title: "Posted 'Salesforce Admin' on LinkedIn",
      description:
        "GreenLeaf Energy is hiring a Salesforce Admin. No existing Salesforce staff detected on LinkedIn.",
      detectedAt: daysAgo(3),
      weight: 20,
      raw: `GreenLeaf Energy is hiring a Salesforce Administrator to manage our newly purchased Salesforce instance. You'll be responsible for user setup, security configuration, custom objects, and workflow automation. We're looking for someone who can be our go-to Salesforce expert as we roll out Sales Cloud across the organization. Previous experience with initial Salesforce deployments strongly preferred.`,
    },
  ],
  c6: [
    {
      id: "s16",
      category: "job_posting",
      source: "linkedin",
      title: "Posted 'Founding Salesforce Admin' on LinkedIn",
      description:
        "StackReach is hiring a founding Salesforce Admin to stand up their CRM. Zero existing Salesforce presence.",
      detectedAt: hoursAgo(6),
      weight: 20,
      raw: `StackReach is looking for a Founding Salesforce Administrator. We just purchased Salesforce and need someone to stand up the entire CRM from day one. You'll design our data model, build automation, set up reports, and be the sole Salesforce expert. This is a true greenfield opportunity — you will own everything. We're migrating from a patchwork of spreadsheets and Notion databases.`,
    },
    {
      id: "s17",
      category: "technographic",
      source: "builtwith",
      title: "Salesforce tags first appeared on stackreach.io",
      description:
        "BuiltWith detected Salesforce script tags appearing on stackreach.io for the first time 2 days ago.",
      detectedAt: daysAgo(2),
      weight: 20,
    },
    {
      id: "s18",
      category: "financial",
      source: "crunchbase",
      title: "Series A funding: $8M",
      description: "StackReach raised $8M Series A from First Round Capital.",
      detectedAt: daysAgo(60),
      weight: 10,
    },
  ],
  c7: [
    {
      id: "s19",
      category: "job_posting",
      source: "indeed",
      title: "Posted 'Salesforce Administrator' on Indeed",
      description:
        "Pinnacle Insurance Group hiring a Salesforce Admin. Large company but first dedicated SFDC role.",
      detectedAt: daysAgo(5),
      weight: 20,
      raw: `Pinnacle Insurance Group is seeking an experienced Salesforce Administrator to lead our CRM transformation. We are transitioning from a legacy on-premise CRM to Salesforce Financial Services Cloud. This is a greenfield implementation for our organization. You'll work with our IT team and business stakeholders to configure, customize, and deploy Salesforce across 200+ users.`,
    },
    {
      id: "s20",
      category: "technographic",
      source: "builtwith",
      title: "Salesforce Financial Services Cloud detected",
      description:
        "BuiltWith detected Financial Services Cloud tags on pinnacleig.com subdomains.",
      detectedAt: daysAgo(8),
      weight: 20,
    },
  ],
  c8: [
    {
      id: "s21",
      category: "job_posting",
      source: "greenhouse",
      title: "Posted 'Salesforce Developer' on Greenhouse",
      description:
        "Verbo hiring their first Salesforce Developer. Building Education Data Architecture on Salesforce.",
      detectedAt: daysAgo(4),
      weight: 20,
      raw: `Verbo is hiring our first Salesforce Developer to build out our Education Data Architecture (EDA) on the Salesforce platform. You'll be responsible for the initial setup, custom development, and integration with our learning management system. This is a sole contributor role with room to grow into a team lead as we scale our Salesforce practice.`,
    },
    {
      id: "s22",
      category: "financial",
      source: "crunchbase",
      title: "Series B funding: $22M",
      description: "Verbo raised $22M Series B from Owl Ventures.",
      detectedAt: daysAgo(25),
      weight: 10,
    },
  ],
  c9: [
    {
      id: "s23",
      category: "technographic",
      source: "wappalyzer",
      title: "Pardot detected on tradefloor.com",
      description:
        "Wappalyzer detected pardot.com script tags on tradefloor.com for the first time.",
      detectedAt: daysAgo(15),
      weight: 20,
    },
    {
      id: "s24",
      category: "executive_hire",
      source: "linkedin",
      title: "New CRO joined from Salesforce-heavy org",
      description:
        "David Park joined TradeFloor as CRO. Previously at a company running full Salesforce stack.",
      detectedAt: daysAgo(30),
      weight: 10,
    },
  ],
  c10: [
    {
      id: "s25",
      category: "job_posting",
      source: "linkedin",
      title: "Posted 'Salesforce Health Cloud Admin' on LinkedIn",
      description:
        "Halo Biotech hiring first Salesforce Health Cloud Admin. Building patient management on SFDC.",
      detectedAt: daysAgo(2),
      weight: 20,
      raw: `Halo Biotech is seeking our first Salesforce Health Cloud Administrator. We're building our patient management and clinical trial tracking system on Salesforce Health Cloud. You'll be owning our instance end-to-end, from initial configuration to ongoing administration. Must have Health Cloud experience and HIPAA compliance knowledge. Greenfield implementation — you'll shape our entire CRM strategy.`,
    },
    {
      id: "s26",
      category: "infrastructure",
      source: "dns",
      title: "Salesforce DNS records detected",
      description:
        "New MX and SPF records pointing to Salesforce detected on halobiotech.com.",
      detectedAt: daysAgo(8),
      weight: 20,
    },
    {
      id: "s27",
      category: "financial",
      source: "crunchbase",
      title: "Series B funding: $35M",
      description: "Halo Biotech raised $35M Series B from OrbiMed.",
      detectedAt: daysAgo(40),
      weight: 10,
    },
  ],
  c11: [
    {
      id: "s28",
      category: "public_footprint",
      source: "appexchange",
      title: "Relay Freight employee reviewed OwnBackup",
      description:
        "An employee at Relay Freight posted a review for OwnBackup on AppExchange, indicating Salesforce usage.",
      detectedAt: daysAgo(12),
      weight: 10,
    },
    {
      id: "s29",
      category: "job_posting",
      source: "linkedin",
      title: "Posted 'Salesforce Admin' on LinkedIn",
      description:
        "Relay Freight hiring a Salesforce Admin. Mentions 'standing up a new org' in the description.",
      detectedAt: daysAgo(6),
      weight: 20,
      raw: `Relay Freight is hiring a Salesforce Administrator to help us stand up a new Salesforce org. We're a fast-growing logistics company looking to centralize our sales operations on the Salesforce platform. You'll handle configuration, user management, reports, and dashboards. This role is perfect for an admin who loves building something new.`,
    },
  ],
  c12: [
    {
      id: "s30",
      category: "technographic",
      source: "builtwith",
      title: "Salesforce scripts detected on optera.io",
      description:
        "BuiltWith detected force.com scripts appearing on optera.io.",
      detectedAt: daysAgo(20),
      weight: 20,
    },
    {
      id: "s31",
      category: "financial",
      source: "crunchbase",
      title: "Series A funding: $10M",
      description: "Optera Climate raised $10M Series A.",
      detectedAt: daysAgo(50),
      weight: 10,
    },
  ],
};

const contactSets: Record<string, Contact[]> = {
  c1: [
    {
      id: "ct1",
      name: "James Rivera",
      title: "VP of Sales",
      email: "j.rivera@novapay.io",
      linkedinUrl: "https://linkedin.com/in/jamesrivera",
      source: "apollo",
    },
    {
      id: "ct2",
      name: "Emily Zhou",
      title: "Head of Revenue Operations",
      linkedinUrl: "https://linkedin.com/in/emilyzhou",
      source: "linkedin",
    },
  ],
  c2: [
    {
      id: "ct3",
      name: "Sarah Chen",
      title: "VP of Sales",
      email: "s.chen@medvaulthealth.com",
      linkedinUrl: "https://linkedin.com/in/sarahchen",
      source: "apollo",
    },
    {
      id: "ct4",
      name: "Robert Kim",
      title: "Director of IT",
      linkedinUrl: "https://linkedin.com/in/robertkim",
      source: "hunter",
    },
  ],
  c3: [
    {
      id: "ct5",
      name: "Maria Gonzalez",
      title: "VP of Operations",
      email: "m.gonzalez@cirruslogistics.com",
      linkedinUrl: "https://linkedin.com/in/mariagonzalez",
      source: "apollo",
    },
  ],
  c4: [
    {
      id: "ct6",
      name: "Marcus Johnson",
      title: "Head of RevOps",
      email: "m.johnson@brightedge.ai",
      linkedinUrl: "https://linkedin.com/in/marcusjohnson",
      source: "apollo",
    },
    {
      id: "ct7",
      name: "Lisa Park",
      title: "CTO",
      linkedinUrl: "https://linkedin.com/in/lisapark",
      source: "linkedin",
    },
  ],
  c5: [
    {
      id: "ct8",
      name: "Tom Harris",
      title: "Director of Sales",
      email: "t.harris@greenleafenergy.co",
      linkedinUrl: "https://linkedin.com/in/tomharris",
      source: "hunter",
    },
  ],
  c6: [
    {
      id: "ct9",
      name: "Priya Patel",
      title: "CEO",
      email: "priya@stackreach.io",
      linkedinUrl: "https://linkedin.com/in/priyapatel",
      source: "apollo",
    },
    {
      id: "ct10",
      name: "Kevin Wu",
      title: "Head of Sales",
      linkedinUrl: "https://linkedin.com/in/kevinwu",
      source: "linkedin",
    },
  ],
  c7: [
    {
      id: "ct11",
      name: "Jennifer Adams",
      title: "CIO",
      email: "j.adams@pinnacleig.com",
      linkedinUrl: "https://linkedin.com/in/jenniferadams",
      source: "apollo",
    },
  ],
  c8: [
    {
      id: "ct12",
      name: "Alex Turner",
      title: "VP of Engineering",
      email: "a.turner@verbo.app",
      linkedinUrl: "https://linkedin.com/in/alexturner",
      source: "hunter",
    },
  ],
  c9: [
    {
      id: "ct13",
      name: "David Park",
      title: "CRO",
      email: "d.park@tradefloor.com",
      linkedinUrl: "https://linkedin.com/in/davidpark",
      source: "apollo",
    },
  ],
  c10: [
    {
      id: "ct14",
      name: "Rachel Green",
      title: "VP of Clinical Operations",
      email: "r.green@halobiotech.com",
      linkedinUrl: "https://linkedin.com/in/rachelgreen",
      source: "apollo",
    },
    {
      id: "ct15",
      name: "Chris Martinez",
      title: "Director of IT",
      linkedinUrl: "https://linkedin.com/in/chrismartinez",
      source: "linkedin",
    },
  ],
  c11: [
    {
      id: "ct16",
      name: "Sam Wilson",
      title: "VP of Sales",
      linkedinUrl: "https://linkedin.com/in/samwilson",
      source: "linkedin",
    },
  ],
  c12: [
    {
      id: "ct17",
      name: "Nina Patel",
      title: "Head of Operations",
      email: "n.patel@optera.io",
      linkedinUrl: "https://linkedin.com/in/ninapatel",
      source: "apollo",
    },
  ],
};

// ── Build Leads ──────────────────────────────────────────────────────

function buildLead(company: Company): Lead {
  const signals = signalSets[company.id] || [];
  const contacts = contactSets[company.id] || [];
  const score = computeLeadScore(signals);
  const triggerEvent = generateTriggerEvent(signals);

  const dates = signals.map((s) => new Date(s.detectedAt).getTime());
  const firstDetected = dates.length
    ? new Date(Math.min(...dates)).toISOString()
    : new Date().toISOString();
  const lastUpdated = dates.length
    ? new Date(Math.max(...dates)).toISOString()
    : new Date().toISOString();

  return {
    id: `lead-${company.id}`,
    company,
    score,
    signals,
    triggerEvent,
    contacts,
    firstDetected,
    lastUpdated,
    status: "new",
  };
}

export function getAllLeads(): Lead[] {
  return companies
    .map(buildLead)
    .sort((a, b) => b.score - a.score);
}

export function getLeadById(id: string): Lead | undefined {
  return getAllLeads().find((l) => l.id === id);
}

export function getAvailableIndustries(): string[] {
  const industries = new Set(companies.map((c) => c.industry));
  return Array.from(industries).sort();
}
