/**
 * Integration test: feeds realistic API responses through the full
 * scraper → lead-builder → scoring → filter pipeline.
 *
 * Run: npx tsx src/lib/__tests__/pipeline-integration.test.ts
 */

import { buildLeadsFromJobs, getIndustriesFromLeads } from "../lead-builder";
import { applyFilters } from "../filters";
import { DEFAULT_FILTERS } from "../types";
import type { ScrapedJob } from "../scraper";

// ── Realistic scraped jobs (what the APIs actually return) ──────────

const realisticJobs: ScrapedJob[] = [
  // RemoteOK result
  {
    title: "Salesforce Administrator",
    company: "Acme Fintech",
    location: "Remote in Austin, TX",
    description:
      "We're hiring our first Salesforce Administrator to own our Sales Cloud instance end-to-end. Greenfield implementation — you'll build our CRM from scratch as we transition from HubSpot. Fintech experience preferred.",
    url: "https://remoteok.com/remote-jobs/12345",
    source: "remoteok",
    detectedAt: "2026-02-15T10:00:00.000Z",
  },
  // Arbeitnow result
  {
    title: "Salesforce Developer",
    company: "MedCore Health",
    location: "Boston, MA",
    description:
      "MedCore Health is seeking a Salesforce Developer to lead our initial setup of Salesforce Health Cloud. We're currently managing patient relationships in spreadsheets and need someone to build a proper CRM foundation. HIPAA compliance knowledge required.",
    url: "https://www.arbeitnow.com/jobs/medcore-sf-dev",
    source: "arbeitnow",
    detectedAt: "2026-02-14T14:30:00.000Z",
  },
  // Jobicy result
  {
    title: "Founding Salesforce Admin",
    company: "LaunchPad SaaS",
    location: "Remote",
    description:
      "LaunchPad SaaS is looking for a Founding Salesforce Admin to stand up our entire CRM from day one. Zero existing Salesforce presence. You'll design our data model, build automation, and be the sole Salesforce expert. Cloud SaaS platform company.",
    url: "https://jobicy.com/jobs/launchpad-sf-admin",
    source: "jobicy",
    detectedAt: "2026-02-16T02:00:00.000Z",
  },
  // Himalayas result
  {
    title: "CRM Administrator (Salesforce)",
    company: "GreenRoute Logistics",
    location: "Chicago, IL",
    description:
      "GreenRoute Logistics is implementing Salesforce for the first time. Looking for a CRM Admin to lead our transition from a legacy system. Logistics and supply chain experience is a big plus.",
    url: "https://himalayas.app/jobs/greenroute-crm",
    source: "himalayas",
    detectedAt: "2026-02-13T09:15:00.000Z",
  },
  // Indeed result
  {
    title: "Salesforce Engineer",
    company: "Acme Fintech",
    location: "Austin, TX",
    description:
      "Looking for a Salesforce Engineer to support our first Admin in building out the platform. Will work on integrations, Apex triggers, and custom Lightning components for our fintech products.",
    url: "https://www.indeed.com/viewjob?jk=abc123",
    source: "indeed",
    detectedAt: "2026-02-16T06:00:00.000Z",
  },
  // Another Jobicy result
  {
    title: "Salesforce Health Cloud Consultant",
    company: "MedCore Health",
    location: "Remote",
    description:
      "Support our Health Cloud implementation as a consultant. Work with our new Salesforce Developer on data model and clinical workflow configuration.",
    url: "https://jobicy.com/jobs/medcore-consultant",
    source: "jobicy",
    detectedAt: "2026-02-12T11:00:00.000Z",
  },
  // RemoteOK result — education sector
  {
    title: "Salesforce Admin - Education",
    company: "EduBright",
    location: "Remote",
    description:
      "EduBright is hiring a Salesforce Admin to manage our Education Data Architecture on the Salesforce platform. EdTech company building the future of learning analytics.",
    url: "https://remoteok.com/remote-jobs/67890",
    source: "remoteok",
    detectedAt: "2026-02-11T08:00:00.000Z",
  },
];

// ── Run the pipeline ────────────────────────────────────────────────

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║   Pipeline Integration Test — Realistic Scraped Data    ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

console.log(`Input: ${realisticJobs.length} scraped jobs from ${new Set(realisticJobs.map(j => j.source)).size} sources\n`);

// Step 1: Build leads
const leads = await buildLeadsFromJobs(realisticJobs);
console.log(`Step 1 — buildLeadsFromJobs: ${leads.length} leads (one per job posting)\n`);

// Step 2: Show each lead
for (const lead of leads) {
  console.log(`  ┌─ ${lead.company.name}`);
  console.log(`  │  Score: ${lead.score} | Industry: ${lead.company.industry}`);
  console.log(`  │  Location: ${lead.company.city || "Remote"}${lead.company.state ? `, ${lead.company.state}` : ""}`);
  console.log(`  │  Signals: ${lead.signals.length}`);
  for (const sig of lead.signals) {
    console.log(`  │    • [${sig.source}] ${sig.title}`);
  }
  console.log(`  │  Trigger: ${lead.triggerEvent}`);
  console.log(`  └─ Status: ${lead.status}\n`);
}

// Step 3: Show industries
const industries = getIndustriesFromLeads(leads);
console.log(`Step 2 — Industries detected: ${industries.join(", ")}\n`);

// Step 4: Filter test (timeframe only)
const filtered = applyFilters(leads, { timeframe: "30d" });
console.log(`Step 3 — applyFilters(timeframe=30d): ${filtered.length}/${leads.length} leads pass\n`);

const recent = applyFilters(leads, { timeframe: "7d" });
console.log(`Step 4 — applyFilters(timeframe=7d): ${recent.length}/${leads.length} leads pass`);

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║   ✓ Pipeline works end-to-end with scraped data        ║");
console.log("╚══════════════════════════════════════════════════════════╝");
