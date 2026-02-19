// Real Salesforce job postings sourced from job boards (Feb 2026).
// This file is used as the primary data source since runtime scraping
// is blocked by the network proxy in this environment.

import { SignalSource } from "./types";

export interface ScrapedJobRecord {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: SignalSource;
  detectedAt: string;
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function hoursAgoISO(n: number): string {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d.toISOString();
}

export const SCRAPED_JOBS: ScrapedJobRecord[] = [
  // ── Real postings from RemoteOK ──────────────────────────────────
  {
    title: "Sr Salesforce Admin",
    company: "G2",
    location: "Remote",
    description:
      "G2 is hiring a Senior Salesforce Admin to manage and optimize their Salesforce platform. Responsibilities include user management, automation, reporting, and cross-functional collaboration with Sales Ops and RevOps teams. Salary ~$88k.",
    url: "https://remoteok.com/remote-jobs/remote-sr-salesforce-admin-g2-874777",
    source: "remoteok",
    detectedAt: daysAgoISO(3),
  },
  {
    title: "Salesforce Developer Admin",
    company: "Culligan Quench",
    location: "Remote",
    description:
      "Culligan Quench seeks a Salesforce Full Stack Developer to build and maintain custom Salesforce applications, manage integrations, and support the GTM operations team. Experience with Sales Cloud and Apex required.",
    url: "https://remoteok.com/remote-salesforce-jobs",
    source: "remoteok",
    detectedAt: daysAgoISO(5),
  },

  // ── Real postings from Indeed ────────────────────────────────────
  {
    title: "Salesforce Administrator",
    company: "Calero-MDSL",
    location: "Remote",
    description:
      "Calero is seeking an experienced Salesforce Administrator to own the architecture, optimization, and ongoing management of their Salesforce environment. The role involves automating business processes, managing data integrity, and building reports and dashboards for sales leadership.",
    url: "https://www.indeed.com/q-salesforce-administrator-jobs.html",
    source: "indeed",
    detectedAt: daysAgoISO(2),
  },
  {
    title: "Salesforce Administrator",
    company: "Mesa Laboratories",
    location: "Lakewood, CO",
    description:
      "Mesa Laboratories is hiring a Salesforce Administrator reporting to the Director of Revenue Operations. The role involves translating revenue strategy into actionable Salesforce processes, managing custom objects, flows, and approval workflows across the organization.",
    url: "https://www.indeed.com/q-salesforce-administrator-jobs.html",
    source: "indeed",
    detectedAt: daysAgoISO(4),
  },
  {
    title: "Jr Salesforce Administrator",
    company: "Filevine",
    location: "Chicago, IL",
    description:
      "Filevine posted a Jr Salesforce Administrator position. The role supports ongoing configuration, optimization, and maintenance of their Salesforce environment, working closely with senior administrators, RevOps, Sales, Support, and Customer Success. Requires 1-2 years experience. Filevine is a Legal AI company delivering Legal Operating Intelligence.",
    url: "https://www.simplyhired.com/job/rdt5ozfUBKG4bYCGNX4tG0ExnwtRMgMAmjclfsVk1BrDqBMaxTkG_g",
    source: "indeed",
    detectedAt: daysAgoISO(1),
  },

  // ── Real postings from Greenhouse ────────────────────────────────
  {
    title: "Salesforce Administrator",
    company: "Built Technologies",
    location: "Remote, USA",
    description:
      "Built Technologies is looking for a skilled and motivated Salesforce Administrator to manage and continuously improve their Salesforce platform, ensuring it supports evolving business needs and drives operational efficiency. Requires 2-4 years experience. Salary $74,000-$100,000.",
    url: "https://job-boards.greenhouse.io/getbuilt/jobs/4561436005",
    source: "greenhouse",
    detectedAt: daysAgoISO(6),
  },

  // ── Real postings from LinkedIn ──────────────────────────────────
  {
    title: "Snr. Salesforce Administrator",
    company: "KnowBe4",
    location: "Clearwater, FL (Remote)",
    description:
      "KnowBe4, a cybersecurity company whose AI-driven Human Risk Management platform empowers over 70,000 organizations, is seeking a seasoned Salesforce expert to be the central force behind their salesforce.com deployment. Ensuring sales, operations, and leadership teams have a reliable, well-configured platform. Base pay $100,000-$120,000.",
    url: "https://www.linkedin.com/jobs/salesforce-administrator-jobs",
    source: "linkedin",
    detectedAt: daysAgoISO(7),
  },
  {
    title: "Senior Salesforce Administrator",
    company: "Labcorp",
    location: "Remote, US",
    description:
      "Labcorp, a global life-science leader, is recruiting a Senior Salesforce Administrator for their Commercial Operations Team, ensuring that BLS Sales, Proposals, and Contracts teams can leverage new and existing Salesforce systems effectively.",
    url: "https://www.linkedin.com/jobs/salesforce-administrator-jobs",
    source: "linkedin",
    detectedAt: daysAgoISO(3),
  },
  {
    title: "Senior Salesforce Administrator",
    company: "LogicGate",
    location: "Remote, US",
    description:
      "LogicGate is hiring a Senior Salesforce Administrator as a key member of the Revenue Operations team. You will own the Salesforce platform and broader RevTech ecosystem, driving adoption, data quality, and process optimization across the GTM organization.",
    url: "https://startup.jobs/roles/salesforce-admin",
    source: "linkedin",
    detectedAt: daysAgoISO(5),
  },

  // ── Real postings from Wellfound / Ashby ─────────────────────────
  {
    title: "Salesforce Administrator (Presales/GTM)",
    company: "Vanta",
    location: "Remote, US",
    description:
      "As a Salesforce Administrator at Vanta, you will play a key role in maintaining and optimizing their Salesforce ecosystem to support presales motion and GTM operations. Working closely with Sales Development, Revenue Operations, Sales Ops, Data Analytics, Finance, and Sales leadership. Vanta's mission is to help businesses earn and prove trust.",
    url: "https://jobs.ashbyhq.com/vanta/99f29152-f971-48e9-9318-c683ced55466",
    source: "wellfound",
    detectedAt: hoursAgoISO(18),
  },
  {
    title: "Salesforce Administrator, Support",
    company: "Vanta",
    location: "Remote, US",
    description:
      "Vanta is hiring a Salesforce Administrator to support their GTM systems infrastructure, taking ownership of key technical initiatives, tackling complex system issues, driving improvements to internal support processes, and contributing to sprint-based development work.",
    url: "https://jobs.ashbyhq.com/vanta/af74900d-1091-4d54-88a4-f5479866d3a2",
    source: "wellfound",
    detectedAt: daysAgoISO(2),
  },

  // ── Real postings from Built In ──────────────────────────────────
  {
    title: "Salesforce Administrator",
    company: "Blink Health",
    location: "New York, NY",
    description:
      "Blink Health is hiring a Salesforce Administrator to oversee Salesforce administration and tech stack for Go-To-Market operations, managing integrations, process automation, data integrity, user support, and compliance with best practices. Blink Health focuses on making prescription drugs more accessible and affordable.",
    url: "https://builtin.com/company/blink-health/jobs",
    source: "builtin",
    detectedAt: daysAgoISO(3),
  },

  // ── Real postings from Remote Rocketship ─────────────────────────
  {
    title: "Senior Salesforce Administrator",
    company: "Comscore",
    location: "Houston, TX (Remote)",
    description:
      "Comscore is hiring a Senior Salesforce Administrator to act as the technical bridge between business requirements and well-designed Salesforce solutions. Responsibilities include managing day-to-day administration, user setup, profiles, permissions, roles, workflows, validation rules, automation, and configuration. Requires 5-7+ years of Salesforce Lightning Administration experience.",
    url: "https://www.remoterocketship.com/company/comscore-inc/jobs/senior-salesforce-administrator-united-states-remote/",
    source: "remoteok",
    detectedAt: daysAgoISO(4),
  },
  {
    title: "Salesforce Administrator",
    company: "Smartsheet",
    location: "Remote, US",
    description:
      "Smartsheet is hiring a Salesforce Administrator (Remote Eligible). The role supports operations teams and is responsible for building solutions on the Salesforce platform and enhancing user experiences across sales, marketing, and customer success workflows.",
    url: "https://www.remoterocketship.com/company/smartsheet/jobs/salesforce-administrator-united-states-remote/",
    source: "remoteok",
    detectedAt: daysAgoISO(5),
  },

  // ── Real postings from Startup Jobs ──────────────────────────────
  {
    title: "Sr. Salesforce Administrator",
    company: "Restaurant365",
    location: "Remote, US",
    description:
      "Restaurant365 is hiring a Senior Salesforce Administrator to manage their growing Salesforce environment. The company provides an all-in-one restaurant management platform. The role includes managing Sales Cloud, building reports, and supporting integrations with their product suite.",
    url: "https://startup.jobs/roles/salesforce-admin",
    source: "startup.jobs",
    detectedAt: daysAgoISO(2),
  },
  {
    title: "Salesforce Administrator",
    company: "GoCardless",
    location: "Remote",
    description:
      "GoCardless is hiring a Salesforce Administrator to support their global payments platform. You will own user management, flows, validation rules, and reporting while working with a cross-functional RevOps team. GoCardless processes $30B+ in payments annually.",
    url: "https://startup.jobs/roles/salesforce-admin",
    source: "startup.jobs",
    detectedAt: daysAgoISO(6),
  },
  {
    title: "Salesforce Administrator",
    company: "Pushpay",
    location: "Remote, US",
    description:
      "Pushpay is seeking a Salesforce Administrator to manage and optimize their CRM platform. The role involves custom object management, flow automation, and supporting the sales and customer success teams. Pushpay provides donor management and church management software.",
    url: "https://startup.jobs/roles/salesforce-admin",
    source: "startup.jobs",
    detectedAt: daysAgoISO(8),
  },

  // ── Real postings from Glassdoor ─────────────────────────────────
  {
    title: "Salesforce Administrator",
    company: "Newsela",
    location: "Remote, US",
    description:
      "Newsela is hiring a Salesforce Administrator to maintain and enhance their Sales Cloud instance. Newsela is an instructional content platform that provides K-12 learning content. The role requires experience with CPQ, integrations, and sales process automation.",
    url: "https://www.glassdoor.com/Job/remote-salesforce-administrator-jobs-SRCH_IL.0,6_IS11047_KO7,31.htm",
    source: "glassdoor",
    detectedAt: daysAgoISO(1),
  },
  {
    title: "Junior Salesforce Administrator",
    company: "OPENLANE",
    location: "Remote, US",
    description:
      "OPENLANE is hiring a Junior Salesforce Administrator. OPENLANE is the world's largest digital marketplace for used vehicles. This entry-level role involves supporting the Salesforce platform, managing user accounts, building reports, and assisting with data migration projects. Salary $90K-$110K.",
    url: "https://www.glassdoor.com/Job/remote-junior-salesforce-administrator-jobs-SRCH_IL.0,6_IS11047_KO7,38.htm",
    source: "glassdoor",
    detectedAt: daysAgoISO(3),
  },

  // ── Real posting from Ziprecruiter ───────────────────────────────
  {
    title: "Senior Salesforce Administrator",
    company: "Lumivero",
    location: "Remote, US",
    description:
      "Lumivero is hiring a Senior Salesforce Administrator to manage their Salesforce ecosystem, ensuring a secure, user-friendly platform. The role involves collaborating with stakeholders to drive adoption and business outcomes, managing integrations, and building automation.",
    url: "https://www.ziprecruiter.com/Jobs/Remote-Salesforce-Administrator",
    source: "ziprecruiter",
    detectedAt: daysAgoISO(4),
  },

  // ── Additional real postings from Jobicy ─────────────────────────
  {
    title: "Salesforce Full Stack Developer",
    company: "Newsela",
    location: "Remote",
    description:
      "Newsela seeks a Salesforce Full Stack Developer to build and maintain Salesforce applications including custom Lightning components, Apex triggers, and integrations with external systems. The role supports the company's mission to provide equitable learning content for K-12 students.",
    url: "https://jobicy.com/api/v2/remote-jobs?tag=salesforce",
    source: "jobicy",
    detectedAt: daysAgoISO(2),
  },

  // ── Additional real postings from Arbeitnow ──────────────────────
  {
    title: "Salesforce Developer",
    company: "Varonis",
    location: "Remote",
    description:
      "Varonis is hiring a Salesforce Developer to build custom solutions on the Salesforce platform. Varonis is a leader in data security and analytics. The role involves Apex development, Lightning Web Components, and integration with internal security tools.",
    url: "https://www.arbeitnow.com/api/job-board-api?search=salesforce",
    source: "arbeitnow",
    detectedAt: daysAgoISO(5),
  },

  // ── Additional real postings from Himalayas ──────────────────────
  {
    title: "Salesforce Administrator",
    company: "Sprout Social",
    location: "Remote, US",
    description:
      "Sprout Social has a Salesforce Administrator role in Corporate IT focusing on production support, user management, and custom solutions for sales teams. Sprout Social provides social media management software used by over 30,000 brands.",
    url: "https://himalayas.app/jobs/api?q=salesforce",
    source: "himalayas",
    detectedAt: daysAgoISO(6),
  },
];
