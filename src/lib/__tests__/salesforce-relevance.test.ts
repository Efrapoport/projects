/**
 * Test: isSalesforcePrimaryRole filter
 *
 * Run: npx tsx src/lib/__tests__/salesforce-relevance.test.ts
 */

import { isSalesforcePrimaryRole, ScrapedJob } from "../scraper";

function makeJob(title: string, description: string): ScrapedJob {
  return {
    title,
    company: "Test Co",
    location: "Remote",
    description,
    url: "https://example.com",
    source: "remoteok",
    detectedAt: new Date().toISOString(),
  };
}

// ── Test Cases ──────────────────────────────────────────────────────

const SHOULD_PASS = [
  {
    name: "Title: Salesforce Administrator",
    job: makeJob("Salesforce Administrator", "Manage CRM platform."),
  },
  {
    name: "Title: Sr Salesforce Admin",
    job: makeJob("Sr Salesforce Admin", "Own the Salesforce org."),
  },
  {
    name: "Title: SFDC Developer",
    job: makeJob("SFDC Developer", "Build custom Lightning components."),
  },
  {
    name: "Title: CRM Admin, description has qualifying context",
    job: makeJob(
      "CRM Administrator",
      "Manage and optimize our Salesforce platform. 3+ years of Salesforce experience required. Sales Cloud, Apex, Lightning."
    ),
  },
  {
    name: "Title: RevOps Manager, owns Salesforce instance",
    job: makeJob(
      "Revenue Operations Manager",
      "Own and administer our Salesforce instance. Build reports, manage integrations, and configure automation across Sales Cloud."
    ),
  },
  {
    name: "Title: generic, but core SF implementation role",
    job: makeJob(
      "Systems Administrator",
      "Lead the Salesforce implementation for our organization. Configure custom objects, flows, and manage the Salesforce environment end-to-end."
    ),
  },
];

const SHOULD_REJECT = [
  {
    name: "Salesforce is a bonus but not required",
    job: makeJob(
      "Marketing Operations Manager",
      "Manage marketing campaigns and analytics. Salesforce experience is a bonus but not required. Must know HubSpot."
    ),
  },
  {
    name: "Salesforce is a plus",
    job: makeJob(
      "Data Analyst",
      "Analyze business data and build dashboards. SQL required. Salesforce knowledge is a plus."
    ),
  },
  {
    name: "Nice to have: Salesforce",
    job: makeJob(
      "Software Engineer",
      "Build backend services. Python, AWS required. Nice to have: Salesforce, HubSpot, or other CRM experience."
    ),
  },
  {
    name: "Salesforce preferred but not required",
    job: makeJob(
      "Business Analyst",
      "Work with stakeholders to define requirements. Salesforce preferred but not required. Strong Excel skills needed."
    ),
  },
  {
    name: "Salesforce is optional",
    job: makeJob(
      "Project Manager",
      "Lead cross-functional projects. PMP required. Salesforce experience is optional but helpful."
    ),
  },
  {
    name: "Passing mention of Salesforce, no qualifying context",
    job: makeJob(
      "Account Executive",
      "Sell enterprise software. Use tools like Salesforce to track pipeline. Quota-carrying role."
    ),
  },
  {
    name: "Salesforce not mentioned at all",
    job: makeJob(
      "Frontend Developer",
      "Build React applications. TypeScript, Next.js required."
    ),
  },
  {
    name: "Ideally has Salesforce",
    job: makeJob(
      "Operations Associate",
      "Support the ops team with process improvement. Ideally has some Salesforce experience but we can train."
    ),
  },
  {
    name: "Salesforce is not mandatory",
    job: makeJob(
      "Customer Success Manager",
      "Manage key accounts and ensure retention. CRM skills needed. Salesforce is not mandatory."
    ),
  },
  {
    name: "Salesforce experience is not essential",
    job: makeJob(
      "Growth Marketing Lead",
      "Lead growth initiatives across paid channels. Salesforce experience is not essential but would be helpful."
    ),
  },
  {
    name: "Salesforce certification is not necessary",
    job: makeJob(
      "IT Support Specialist",
      "Provide L1/L2 support. Salesforce certification is not necessary. ITIL certification preferred."
    ),
  },
  {
    name: "Salesforce would be a plus",
    job: makeJob(
      "Product Manager",
      "Define product roadmap. Salesforce experience would be a plus. Must have shipped B2B products."
    ),
  },
  {
    name: "Salesforce would be an advantage",
    job: makeJob(
      "Business Development Rep",
      "Prospect and qualify leads. Salesforce knowledge would be an advantage but not required."
    ),
  },
  {
    name: "Familiarity with Salesforce is a bonus",
    job: makeJob(
      "Data Engineer",
      "Build data pipelines with Spark and Airflow. Familiarity with Salesforce is a bonus."
    ),
  },
];

// ── Run Tests ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

console.log("Testing isSalesforcePrimaryRole filter\n");

console.log("=== SHOULD PASS (primary Salesforce roles) ===\n");
for (const tc of SHOULD_PASS) {
  const result = isSalesforcePrimaryRole(tc.job);
  const status = result ? "PASS" : "FAIL";
  if (result) passed++;
  else failed++;
  console.log(`  [${status}] ${tc.name}`);
  if (!result) {
    console.log(`         Title: "${tc.job.title}"`);
    console.log(`         Desc:  "${tc.job.description.substring(0, 80)}..."`);
  }
}

console.log("\n=== SHOULD REJECT (Salesforce is bonus/optional/passing mention) ===\n");
for (const tc of SHOULD_REJECT) {
  const result = isSalesforcePrimaryRole(tc.job);
  const status = !result ? "PASS" : "FAIL";
  if (!result) passed++;
  else failed++;
  console.log(`  [${status}] ${tc.name}`);
  if (result) {
    console.log(`         Title: "${tc.job.title}"`);
    console.log(`         Desc:  "${tc.job.description.substring(0, 80)}..."`);
  }
}

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);

if (failed > 0) {
  process.exit(1);
}
