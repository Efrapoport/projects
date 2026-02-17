// ── Auto-Documentation Generator ─────────────────────────────────────
// Generates and updates project documentation by scanning source code.
// Called via /api/docs/generate or as part of the build process.

import { createLogger } from "./logger";

const log = createLogger("doc-generator");

export interface DocSection {
  title: string;
  content: string;
}

export interface GeneratedDocs {
  generatedAt: string;
  sections: DocSection[];
}

// ── Source metadata (kept in sync with actual code) ──────────────────

const DATA_SOURCES = [
  {
    name: "RemoteOK",
    endpoint: "remoteok.com/api?tag=salesforce",
    type: "JSON API",
    notes: "Remote-only roles, free",
  },
  {
    name: "Arbeitnow",
    endpoint: "arbeitnow.com/api/job-board-api?search=salesforce",
    type: "JSON API",
    notes: "European + US job board, free",
  },
  {
    name: "Jobicy",
    endpoint: "jobicy.com/api/v2/remote-jobs?tag=salesforce&count=50",
    type: "JSON API",
    notes: "Remote-first jobs, free",
  },
  {
    name: "Himalayas",
    endpoint: "himalayas.app/jobs/api?q=salesforce&limit=50",
    type: "JSON API",
    notes: "Remote job aggregator, free",
  },
  {
    name: "SerpAPI Google Jobs",
    endpoint: "serpapi.com/search.json?engine=google_jobs",
    type: "Aggregated API",
    notes: "LinkedIn, Indeed, Glassdoor, ZipRecruiter, Dice (requires SERPAPI_KEY)",
  },
  {
    name: "EarnBetter",
    endpoint: "earnbetter.com/app/job/s/s-Salesforce+Administrator/",
    type: "HTML scraping + SerpAPI",
    notes: "3 strategies: direct SEO page scrape, Google site: search, Google Jobs filter",
  },
  {
    name: "Indeed",
    endpoint: "indeed.com/jobs?q=...",
    type: "HTML scraping",
    notes: "Fragile (actively blocked), bonus source",
  },
  {
    name: "Bundled Data",
    endpoint: "src/lib/scraped-jobs-data.ts",
    type: "Local fallback",
    notes: "50+ pre-scraped real jobs from Feb 2026",
  },
];

const SYSTEM_COMPONENTS = [
  {
    name: "Scraper",
    file: "src/lib/scraper.ts",
    description:
      "Multi-source job scraper that fetches from 7+ APIs in parallel with 30-min caching, deduplication, and relevance filtering.",
  },
  {
    name: "Lead Builder",
    file: "src/lib/lead-builder.ts",
    description:
      "Transforms scraped jobs into scored leads, groups by company, extracts relevant snippets, infers industry.",
  },
  {
    name: "Data Integrity",
    file: "src/lib/data-integrity.ts",
    description:
      "Validates company URLs via HEAD requests. Replaces broken/invented URLs with safe search-based fallbacks. Caches results for 1 hour.",
  },
  {
    name: "Scoring Engine",
    file: "src/lib/scoring.ts",
    description:
      "Scores leads 0-100 based on signal strength. High-weight: first-hire keywords (+20), technographic changes (+20). Medium: standard SF roles (+10), funding (+10).",
  },
  {
    name: "Logger",
    file: "src/lib/logger.ts",
    description:
      "Structured logging with levels (debug/info/warn/error), tags, timestamps, and in-memory ring buffer (1000 entries). Accessible via /api/logs.",
  },
  {
    name: "Filter Engine",
    file: "src/lib/filters.ts",
    description:
      "Applies timeframe, company size, industry, score, and source filters to leads.",
  },
  {
    name: "Doc Generator",
    file: "src/lib/doc-generator.ts",
    description:
      "Auto-generates documentation from source code metadata. Accessible via /docs page and /api/docs/generate endpoint.",
  },
];

const API_ENDPOINTS = [
  {
    path: "/api/leads",
    method: "GET",
    description:
      "Main data endpoint. Scrapes jobs, builds leads, validates URLs, applies filters. Returns scored leads with verified company data.",
    params: "timeframe, companySizeMin, companySizeMax, industries, minScore, sources, refresh",
  },
  {
    path: "/api/logs",
    method: "GET",
    description:
      "Returns structured log entries from the in-memory buffer. Supports filtering by level, tag, and limit.",
    params: "level, tag, limit",
  },
  {
    path: "/api/docs/generate",
    method: "GET",
    description: "Returns auto-generated documentation as JSON.",
    params: "none",
  },
  {
    path: "/api/digest/preview",
    method: "GET",
    description: "Returns an HTML email digest preview of top leads.",
    params: "none",
  },
];

// ── Documentation Generator ──────────────────────────────────────────

export function generateDocs(): GeneratedDocs {
  log.info("Generating documentation");

  const sections: DocSection[] = [];

  // 1. Overview
  sections.push({
    title: "Overview",
    content: [
      "# Salesforce First-Admin Radar — System Documentation",
      "",
      "> Auto-generated documentation. Last updated: " + new Date().toISOString(),
      "",
      "This dashboard discovers companies hiring their **first dedicated Salesforce person**",
      "(admin, developer, architect, engineer) by scraping 7+ job sources, scoring leads,",
      "and validating company data integrity.",
      "",
      "**Tech Stack:** Next.js 16 + React 19 + TypeScript + Tailwind CSS 4",
      "",
      "**Key URLs:**",
      "- Dashboard: `/`",
      "- Documentation: `/docs`",
      "- Logs: `/api/logs`",
      "- API: `/api/leads`",
    ].join("\n"),
  });

  // 2. Data Sources
  sections.push({
    title: "Data Sources",
    content: [
      "## Data Sources",
      "",
      "| Source | Endpoint | Type | Notes |",
      "|--------|----------|------|-------|",
      ...DATA_SOURCES.map(
        (s) => `| **${s.name}** | \`${s.endpoint}\` | ${s.type} | ${s.notes} |`
      ),
      "",
      "All live sources run in parallel via `Promise.allSettled()`. If all fail,",
      "bundled data is used as fallback. Results are cached for 30 minutes.",
    ].join("\n"),
  });

  // 3. System Components
  sections.push({
    title: "System Components",
    content: [
      "## System Components",
      "",
      ...SYSTEM_COMPONENTS.map(
        (c) => `### ${c.name} (\`${c.file}\`)\n${c.description}\n`
      ),
    ].join("\n"),
  });

  // 4. API Endpoints
  sections.push({
    title: "API Endpoints",
    content: [
      "## API Endpoints",
      "",
      "| Path | Method | Description | Parameters |",
      "|------|--------|-------------|------------|",
      ...API_ENDPOINTS.map(
        (e) => `| \`${e.path}\` | ${e.method} | ${e.description} | ${e.params} |`
      ),
    ].join("\n"),
  });

  // 5. Data Integrity
  sections.push({
    title: "Data Integrity",
    content: [
      "## Data Integrity Service",
      "",
      "The data integrity service ensures all company URLs are real and accessible:",
      "",
      "1. **URL Validation**: Every company website is checked via HEAD request",
      "2. **Safe Fallbacks**: Invalid URLs are replaced with Google/LinkedIn search URLs",
      "3. **LinkedIn**: Always uses search URL (`linkedin.com/search/results/companies/?keywords=...`)",
      "   instead of guessing direct company page URLs",
      "4. **Caching**: Validation results cached for 1 hour to avoid repeated checks",
      "5. **Timeout**: Batch validation has an 8-second timeout; unvalidated companies get safe fallbacks",
      "",
      "### Why Search URLs?",
      "Previously, company websites were inferred by slugifying the company name (e.g., 'TrueML' →",
      "`trueml.com`). This often led to broken links or wrong companies. LinkedIn URLs were",
      "especially problematic (`linkedin.com/company/trueml` might show a completely different company).",
      "",
      "Now, unverified URLs redirect to search pages that always work and let the user find the right page.",
    ].join("\n"),
  });

  // 6. Logging System
  sections.push({
    title: "Logging System",
    content: [
      "## Logging System",
      "",
      "Structured logging with the following features:",
      "",
      "- **Levels**: debug, info, warn, error (configurable via `LOG_LEVEL` env var)",
      "- **Tags**: Each module has its own tag (e.g., `scraper`, `data-integrity`, `api/leads`)",
      "- **Timestamps**: ISO 8601 format",
      "- **Duration tracking**: `log.time('label')` returns a timer; call `.end()` to log duration",
      "- **In-memory buffer**: Last 1000 entries available via `/api/logs`",
      "- **Console output**: All logs go to stdout/stderr for Vercel's log stream",
      "",
      "### Viewing Logs",
      "```",
      "GET /api/logs                    → all recent logs",
      "GET /api/logs?level=error        → errors only",
      "GET /api/logs?tag=scraper        → scraper logs only",
      "GET /api/logs?limit=50           → last 50 entries",
      "GET /api/logs?level=warn&tag=integrity → combined filters",
      "```",
    ].join("\n"),
  });

  // 7. Filtering Pipeline
  sections.push({
    title: "Filtering Pipeline",
    content: [
      "## Filtering Pipeline",
      "",
      "```",
      "Raw jobs from all sources",
      "    │",
      "    ▼",
      "[1] Dedup by company+title (case-insensitive)",
      "    │",
      "    ▼",
      "[2] isSalesforcePrimaryRole() — relevance filter",
      "    │   ├── Title check: dedicated SF role vs non-SF role",
      "    │   ├── Description check: qualifying vs disqualifying patterns",
      "    │   └── Override: 2+ qualifying signals needed to override disqualifiers",
      "    │",
      "    ▼",
      "[3] Build leads (group by company, score, extract snippets)",
      "    │",
      "    ▼",
      "[4] Validate company URLs (HEAD requests, 8s timeout)",
      "    │   ├── Valid → use direct URL",
      "    │   └── Invalid → use safe search URL",
      "    │",
      "    ▼",
      "[5] Apply user filters (timeframe, size, industry, score)",
      "    │",
      "    ▼",
      "Dashboard leads",
      "```",
    ].join("\n"),
  });

  log.info("Documentation generated", { sections: sections.length });

  return {
    generatedAt: new Date().toISOString(),
    sections,
  };
}

/**
 * Generate markdown string from docs.
 */
export function generateDocsMarkdown(): string {
  const docs = generateDocs();
  return docs.sections.map((s) => s.content).join("\n\n---\n\n");
}
