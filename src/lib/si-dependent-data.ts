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
    description: "Coastal Cloud is seeking a Salesforce Consultant for a 6-month engagement working with Meridian Manufacturing Group's Salesforce Sales Cloud implementation. The ideal candidate will have 3+ years of Salesforce experience and be comfortable working independently with client stakeholders. This is a contract position for our client Meridian Manufacturing Group, a mid-market manufacturing company transitioning from spreadsheets to Salesforce.",
    url: "https://remoteok.com/remote-jobs/coastal-cloud-sf-consultant",
    source: "remoteok",
    detectedAt: "2026-02-15T10:00:00.000Z",
  },
  {
    title: "Contract Salesforce Administrator",
    company: "Robert Half",
    location: "Austin, TX",
    description: "Robert Half is looking for a Contract Salesforce Administrator for our client Brightwell Health Partners, a growing healthcare company with 150 employees. Brightwell Health Partners currently has no in-house Salesforce expertise and relies on external consultants for all CRM operations. This is a 3-month contract with possible extension. Responsibilities include managing user accounts, creating reports, and maintaining data quality.",
    url: "https://www.indeed.com/viewjob?jk=abc123",
    source: "indeed",
    detectedAt: "2026-02-20T14:30:00.000Z",
  },
  {
    title: "Salesforce Implementation Consultant",
    company: "Kicksaw",
    location: "Remote",
    description: "Kicksaw is hiring a Salesforce Implementation Consultant to work on our client Vantage Commerce Solutions' Salesforce deployment. You will be responsible for gathering requirements, configuring Sales Cloud and Service Cloud, and training end users for our client Vantage Commerce Solutions, a mid-market e-commerce company with 200 employees implementing Salesforce for the first time.",
    url: "https://himalayas.app/jobs/kicksaw-sf-impl-consultant",
    source: "himalayas",
    detectedAt: "2026-02-18T09:00:00.000Z",
  },
  {
    title: "Salesforce Freelance Developer",
    company: "TEKsystems",
    location: "Chicago, IL",
    description: "TEKsystems is seeking a freelance Salesforce Developer for a 6-month engagement for our client Summit Freight Logistics, a mid-size logistics company. Summit Freight Logistics has a Salesforce org that was set up by a previous consultant and needs ongoing development and maintenance. No in-house Salesforce team exists — you will be the sole Salesforce resource. Must have Apex, Lightning Web Components, and integration experience.",
    url: "https://www.indeed.com/viewjob?jk=def456",
    source: "indeed",
    detectedAt: "2026-02-22T11:00:00.000Z",
  },
  {
    title: "Salesforce Managed Services Administrator",
    company: "Penrod",
    location: "Remote",
    description: "Penrod is looking for a Salesforce Administrator to join our managed services team, primarily supporting our client Elevate Senior Living. You will provide ongoing administration, support, and optimization for Elevate Senior Living's Salesforce org. Elevate Senior Living has decided to outsource their Salesforce administration rather than hire in-house. Typical tasks include user management, report creation, flow building, and monthly health checks.",
    url: "https://jobicy.com/jobs/penrod-sf-managed-services",
    source: "jobicy",
    detectedAt: "2026-02-25T08:30:00.000Z",
  },
  {
    title: "Salesforce Contractor - CRM Support",
    company: "Apex Systems",
    location: "Denver, CO",
    description: "Apex Systems has an immediate need for a Salesforce Contractor to support our client Pinnacle Financial Technologies, a 200-person fintech company. Pinnacle Financial Technologies recently implemented Salesforce with help from a small consultancy and now needs ongoing support. This is a temp-to-perm opportunity. The company currently has no dedicated Salesforce headcount and manages the platform through a combination of contractors and their IT generalist.",
    url: "https://www.indeed.com/viewjob?jk=ghi789",
    source: "indeed",
    detectedAt: "2026-02-28T13:15:00.000Z",
  },
  {
    title: "Contract Salesforce Developer",
    company: "Kforce",
    location: "Remote",
    description: "Kforce is staffing a contract Salesforce Developer role for our client Horizon Academy Partners, a growing education company. Horizon Academy Partners (end client) has a complex Salesforce org with Sales Cloud, Service Cloud, and Experience Cloud. All development has been outsourced to date. This is a 12-month contract engagement. The client needs custom Apex development, Lightning component work, and integration with their student information system.",
    url: "https://www.indeed.com/viewjob?jk=jkl012",
    source: "indeed",
    detectedAt: "2026-03-01T10:00:00.000Z",
  },
  {
    title: "Salesforce Consultant - Sales Cloud",
    company: "Plative",
    location: "Remote",
    description: "Plative is hiring a Salesforce Consultant specializing in Sales Cloud to work with our client NovaBridge Analytics. You'll work directly with NovaBridge Analytics to optimize their Salesforce environment, build custom solutions, and provide strategic advisory. NovaBridge Analytics partners with us instead of building an internal Salesforce team. This is a statement-of-work-based project delivery engagement.",
    url: "https://arbeitnow.com/jobs/plative-sf-consultant",
    source: "arbeitnow",
    detectedAt: "2026-03-03T09:30:00.000Z",
  },
  {
    title: "Salesforce Administrator (Contract, 6 Months)",
    company: "Insight Global",
    location: "Atlanta, GA",
    description: "Insight Global is seeking a Salesforce Administrator for a 6-month contract for our client Atlas Realty Group, a real estate company with 300 employees. Atlas Realty Group uses Salesforce for their sales operations. They previously relied on a small consulting firm for all Salesforce work and are now looking for temporary coverage while they evaluate whether to bring the function in-house. Daily responsibilities include report building, user management, and basic flow automation.",
    url: "https://www.indeed.com/viewjob?jk=mno345",
    source: "indeed",
    detectedAt: "2026-03-05T14:00:00.000Z",
  },
  {
    title: "Salesforce Advisory Consultant",
    company: "Neocol",
    location: "Remote",
    description: "Neocol is looking for a Salesforce Advisory Consultant to work with our client Streamline Subscription Services. You'll provide strategic and technical consulting on Streamline Subscription Services' Salesforce CPQ and Billing implementation. Our client Streamline Subscription Services doesn't have the in-house expertise to manage these complex modules. You'll lead discovery sessions, design solutions, and oversee implementation. Experience with Salesforce CPQ, Billing, and revenue lifecycle management is required.",
    url: "https://remoteok.com/remote-jobs/neocol-sf-advisory",
    source: "remoteok",
    detectedAt: "2026-03-07T11:30:00.000Z",
  },
  {
    title: "Salesforce Contractor - Data Migration",
    company: "Hays",
    location: "New York, NY",
    description: "Hays is looking for a Salesforce Contractor for a data migration project for our client Evergreen Community Foundation, a non-profit organization with 100 employees. Evergreen Community Foundation is migrating from a legacy donor management system to Salesforce NPSP. They currently have no Salesforce knowledge in-house and need a contractor to manage the entire migration. This is a 3-month engagement with external support from their implementation partner, Galvin Technologies.",
    url: "https://www.indeed.com/viewjob?jk=pqr678",
    source: "indeed",
    detectedAt: "2026-03-08T09:00:00.000Z",
  },
  {
    title: "Freelance Salesforce Developer",
    company: "Torrent Consulting",
    location: "Remote",
    description: "Torrent Consulting is expanding our contractor bench to support our client Redwood Supply Co. We provide managed services and project-based consulting for Redwood Supply Co's Salesforce environment. You'll provide Apex development, Lightning component creation, and integration work for our client Redwood Supply Co, who outsources all Salesforce development to us — you'll be their primary technical resource.",
    url: "https://himalayas.app/jobs/torrent-consulting-freelance-sf-dev",
    source: "himalayas",
    detectedAt: "2026-03-10T10:00:00.000Z",
  },
  {
    title: "Salesforce Support Consultant (Part-Time)",
    company: "Roycon",
    location: "Remote",
    description: "Roycon is hiring a part-time Salesforce Support Consultant to support our client Crestline Property Management. You will provide tier-1 and tier-2 Salesforce support for Crestline Property Management's Salesforce org. Crestline Property Management has chosen to outsource their day-to-day Salesforce administration to Roycon rather than hire a full-time admin. Typical tasks include user provisioning, report creation, basic flow modifications, and troubleshooting.",
    url: "https://jobicy.com/jobs/roycon-sf-support-consultant",
    source: "jobicy",
    detectedAt: "2026-03-11T08:00:00.000Z",
  },
  {
    title: "Contract Salesforce Business Analyst",
    company: "Mason Frank",
    location: "San Francisco, CA",
    description: "Mason Frank is staffing a Contract Salesforce Business Analyst for our client Carebridge Health, a Series B healthcare startup with 180 employees. Carebridge Health implemented Salesforce 2 years ago through a consulting partner and has never had an in-house Salesforce resource. They need a BA to document requirements, optimize existing workflows, and scope out new automation. This is a 6-month contract-to-hire opportunity.",
    url: "https://www.indeed.com/viewjob?jk=stu901",
    source: "indeed",
    detectedAt: "2026-03-12T15:00:00.000Z",
  },
  {
    title: "Salesforce Consultant - Service Cloud",
    company: "CloudMasonry",
    location: "Remote",
    description: "CloudMasonry is seeking a Salesforce Consultant specializing in Service Cloud to work with our client TrueNorth Insurance Group. You'll design and implement customer service solutions on TrueNorth Insurance Group's Salesforce platform. Our client TrueNorth Insurance Group relies on CloudMasonry for all Salesforce strategy and execution. You'll manage the full project lifecycle from requirements gathering through deployment and training.",
    url: "https://arbeitnow.com/jobs/cloudmasonry-sf-consultant",
    source: "arbeitnow",
    detectedAt: "2026-03-13T09:00:00.000Z",
  },
];
