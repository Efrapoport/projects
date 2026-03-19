import type { SignalSource } from "./types";

// Bundled SI-dependency signal data — pre-scraped examples of job postings
// that indicate companies relying on external SIs/consultants for Salesforce.
// Used as fallback when live scraping is unavailable.

export interface SIScrapedJobRecord {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: SignalSource;
  detectedAt: string;
}

export const SI_SCRAPED_JOBS: SIScrapedJobRecord[] = [
  {
    title: "Salesforce Consultant (Contract)",
    company: "Coastal Cloud",
    location: "Remote",
    description: "Coastal Cloud is seeking a Salesforce Consultant for a 6-month engagement to support our client's Sales Cloud implementation. The ideal candidate will have 3+ years of Salesforce experience and be comfortable working independently with client stakeholders. This is a contract position supporting a mid-market manufacturing company transitioning from spreadsheets to Salesforce.",
    url: "https://remoteok.com/remote-jobs/coastal-cloud-sf-consultant",
    source: "remoteok",
    detectedAt: "2026-02-15T10:00:00.000Z",
  },
  {
    title: "Contract Salesforce Administrator",
    company: "Robert Half",
    location: "Austin, TX",
    description: "Robert Half is looking for a Contract Salesforce Administrator for our client, a growing healthcare company with 150 employees. The client currently has no in-house Salesforce expertise and relies on external consultants for all CRM operations. This is a 3-month contract with possible extension. Responsibilities include managing user accounts, creating reports, and maintaining data quality.",
    url: "https://www.indeed.com/viewjob?jk=abc123",
    source: "indeed",
    detectedAt: "2026-02-20T14:30:00.000Z",
  },
  {
    title: "Salesforce Implementation Consultant",
    company: "Kicksaw",
    location: "Remote",
    description: "Kicksaw is hiring a Salesforce Implementation Consultant to work on multiple client engagements. You will be responsible for gathering requirements, configuring Sales Cloud and Service Cloud, and training end users. Our clients are typically mid-market companies in the 50-500 employee range who are implementing Salesforce for the first time or migrating from legacy CRMs.",
    url: "https://himalayas.app/jobs/kicksaw-sf-impl-consultant",
    source: "himalayas",
    detectedAt: "2026-02-18T09:00:00.000Z",
  },
  {
    title: "Salesforce Freelance Developer",
    company: "TEKsystems",
    location: "Chicago, IL",
    description: "TEKsystems is seeking a freelance Salesforce Developer for a 6-month engagement with our client in the logistics industry. The client has a Salesforce org that was set up by a previous consultant and needs ongoing development and maintenance. No in-house Salesforce team exists — you will be the sole Salesforce resource. Must have Apex, Lightning Web Components, and integration experience.",
    url: "https://www.indeed.com/viewjob?jk=def456",
    source: "indeed",
    detectedAt: "2026-02-22T11:00:00.000Z",
  },
  {
    title: "Salesforce Managed Services Administrator",
    company: "Penrod",
    location: "Remote",
    description: "Penrod is looking for a Salesforce Administrator to join our managed services team. You will provide ongoing administration, support, and optimization for a portfolio of 8-12 client Salesforce orgs. Our managed services clients are companies that have decided to outsource their Salesforce administration rather than hire in-house. Typical tasks include user management, report creation, flow building, and monthly health checks.",
    url: "https://jobicy.com/jobs/penrod-sf-managed-services",
    source: "jobicy",
    detectedAt: "2026-02-25T08:30:00.000Z",
  },
  {
    title: "Salesforce Contractor - CRM Support",
    company: "Apex Systems",
    location: "Denver, CO",
    description: "Apex Systems has an immediate need for a Salesforce Contractor to support our client, a 200-person fintech company. The client recently implemented Salesforce with help from a small consultancy and now needs ongoing support. This is a temp-to-perm opportunity. The company currently has no dedicated Salesforce headcount and manages the platform through a combination of contractors and their IT generalist.",
    url: "https://www.indeed.com/viewjob?jk=ghi789",
    source: "indeed",
    detectedAt: "2026-02-28T13:15:00.000Z",
  },
  {
    title: "Contract Salesforce Developer",
    company: "Kforce",
    location: "Remote",
    description: "Kforce is staffing a contract Salesforce Developer role for our client in the education sector. The end client has a complex Salesforce org with Sales Cloud, Service Cloud, and Experience Cloud. All development has been outsourced to date. This is a 12-month contract engagement. The client needs custom Apex development, Lightning component work, and integration with their student information system.",
    url: "https://www.indeed.com/viewjob?jk=jkl012",
    source: "indeed",
    detectedAt: "2026-03-01T10:00:00.000Z",
  },
  {
    title: "Salesforce Consultant - Sales Cloud",
    company: "Plative",
    location: "Remote",
    description: "Plative is hiring a Salesforce Consultant specializing in Sales Cloud. You'll work directly with clients to optimize their Salesforce environments, build custom solutions, and provide strategic advisory. Our clients are fast-growing companies that partner with us instead of building internal Salesforce teams. This is a full-time role on our consulting team with a focus on statement-of-work-based project delivery.",
    url: "https://arbeitnow.com/jobs/plative-sf-consultant",
    source: "arbeitnow",
    detectedAt: "2026-03-03T09:30:00.000Z",
  },
  {
    title: "Salesforce Administrator (Contract, 6 Months)",
    company: "Insight Global",
    location: "Atlanta, GA",
    description: "Insight Global is seeking a Salesforce Administrator for a 6-month contract with a real estate company. The company has 300 employees and uses Salesforce for their sales operations. They previously relied on a small consulting firm for all Salesforce work and are now looking for temporary coverage while they evaluate whether to bring the function in-house. Daily responsibilities include report building, user management, and basic flow automation.",
    url: "https://www.indeed.com/viewjob?jk=mno345",
    source: "indeed",
    detectedAt: "2026-03-05T14:00:00.000Z",
  },
  {
    title: "Salesforce Advisory Consultant",
    company: "Neocol",
    location: "Remote",
    description: "Neocol is looking for a Salesforce Advisory Consultant to join our team. You'll provide strategic and technical consulting to subscription and recurring revenue businesses. Our clients are companies that use Salesforce CPQ and Billing but don't have the in-house expertise to manage these complex modules. You'll lead discovery sessions, design solutions, and oversee implementation. Experience with Salesforce CPQ, Billing, and revenue lifecycle management is required.",
    url: "https://remoteok.com/remote-jobs/neocol-sf-advisory",
    source: "remoteok",
    detectedAt: "2026-03-07T11:30:00.000Z",
  },
  {
    title: "Salesforce Contractor - Data Migration",
    company: "Hays",
    location: "New York, NY",
    description: "Hays is looking for a Salesforce Contractor for a data migration project with our client, a non-profit organization with 100 employees. The client is migrating from a legacy donor management system to Salesforce NPSP. They currently have no Salesforce knowledge in-house and need a contractor to manage the entire migration. This is a 3-month engagement with external support from the client's implementation partner, Galvin Technologies.",
    url: "https://www.indeed.com/viewjob?jk=pqr678",
    source: "indeed",
    detectedAt: "2026-03-08T09:00:00.000Z",
  },
  {
    title: "Freelance Salesforce Developer",
    company: "Torrent Consulting",
    location: "Remote",
    description: "Torrent Consulting is expanding our contractor bench with experienced Salesforce Developers. We provide managed services and project-based consulting to mid-market companies. You'll be assigned to 2-3 client accounts, providing Apex development, Lightning component creation, and integration work. These clients outsource all their Salesforce development to us — you'll be their primary technical resource.",
    url: "https://himalayas.app/jobs/torrent-consulting-freelance-sf-dev",
    source: "himalayas",
    detectedAt: "2026-03-10T10:00:00.000Z",
  },
  {
    title: "Salesforce Support Consultant (Part-Time)",
    company: "Roycon",
    location: "Remote",
    description: "Roycon is hiring a part-time Salesforce Support Consultant to join our managed services team. You will provide tier-1 and tier-2 Salesforce support to our portfolio of managed services clients. These are companies that have chosen to outsource their day-to-day Salesforce administration to Roycon rather than hire a full-time admin. Typical tasks include user provisioning, report creation, basic flow modifications, and troubleshooting.",
    url: "https://jobicy.com/jobs/roycon-sf-support-consultant",
    source: "jobicy",
    detectedAt: "2026-03-11T08:00:00.000Z",
  },
  {
    title: "Contract Salesforce Business Analyst",
    company: "Mason Frank",
    location: "San Francisco, CA",
    description: "Mason Frank is staffing a Contract Salesforce Business Analyst for our client, a Series B healthcare startup with 180 employees. The company implemented Salesforce 2 years ago through a consulting partner and has never had an in-house Salesforce resource. They need a BA to document requirements, optimize existing workflows, and scope out new automation. This is a 6-month contract-to-hire opportunity.",
    url: "https://www.indeed.com/viewjob?jk=stu901",
    source: "indeed",
    detectedAt: "2026-03-12T15:00:00.000Z",
  },
  {
    title: "Salesforce Consultant - Service Cloud",
    company: "CloudMasonry",
    location: "Remote",
    description: "CloudMasonry is seeking a Salesforce Consultant specializing in Service Cloud. You'll work with our clients to design and implement customer service solutions on the Salesforce platform. Our typical client is a mid-market company that relies on CloudMasonry for all Salesforce strategy and execution. You'll manage the full project lifecycle from requirements gathering through deployment and training.",
    url: "https://arbeitnow.com/jobs/cloudmasonry-sf-consultant",
    source: "arbeitnow",
    detectedAt: "2026-03-13T09:00:00.000Z",
  },
];
