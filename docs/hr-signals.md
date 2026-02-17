# HR Signal Detection — How We Find First-Hire Salesforce Opportunities

> This document catalogs every change, data source, and filtering rule related to detecting companies
> that are hiring their **first dedicated Salesforce person** (admin, developer, architect, engineer).

---

## 1. What We're Looking For

We want to surface companies that are hiring a **dedicated Salesforce role** — not companies that
happen to mention "Salesforce" in a generic IT job description. The ideal lead is:

- Hiring a **Salesforce Administrator, Developer, Architect, or Engineer** as a dedicated role
- Showing **first-hire signals**: "build from scratch", "greenfield", "first Salesforce admin",
  "sole contributor", "standing up", "net new", "transition from spreadsheets", etc.
- Recently posted (within 30 days for high-weight, within 90 days for medium-weight)

---

## 2. Data Sources

### 2a. Job Board APIs (free, live)

| Source | Endpoint | Search Term | Notes |
|--------|----------|-------------|-------|
| **RemoteOK** | `remoteok.com/api?tag=salesforce` | `salesforce` | JSON API, remote-only roles |
| **Arbeitnow** | `arbeitnow.com/api/job-board-api?search=salesforce` | `salesforce` | European + US job board |
| **Jobicy** | `jobicy.com/api/v2/remote-jobs?tag=salesforce&count=50` | `salesforce` | Remote-first jobs |
| **Himalayas** | `himalayas.app/jobs/api?q=salesforce&limit=50` | `salesforce` | Remote job aggregator |

All 4 sources are queried in parallel on every `/api/leads` request (with a 30-minute in-memory cache).

### 2b. SerpAPI Google Jobs (paid, aggregated)

| Config | Value |
|--------|-------|
| **Service** | [SerpAPI](https://serpapi.com) — Google Jobs engine |
| **Env var** | `SERPAPI_KEY` (set in Vercel) |
| **Queries** | `"salesforce administrator"`, `"salesforce developer"`, `"first salesforce admin"` |
| **Underlying sources** | LinkedIn, Indeed, Glassdoor, ZipRecruiter, Dice, and other boards indexed by Google Jobs |
| **Dedup** | Results are deduplicated by `company+title` within Google Jobs, then again globally |
| **Timeout** | 20s per query |

SerpAPI is the most valuable source because it aggregates across all major job boards.
If `SERPAPI_KEY` is not set, this source is skipped gracefully (no error).

### 2c. EarnBetter (via SerpAPI + direct scraping)

| Config | Value |
|--------|-------|
| **Method 1** | Direct HTML fetch of `earnbetter.com/app/job/browse/?q=salesforce` |
| **Method 2** | SerpAPI query: `"salesforce administrator earnbetter"` |
| **Source tag** | `earnbetter` (when confirmed from EarnBetter), otherwise `google_jobs` |

EarnBetter blocks direct scraping (403), so we primarily rely on SerpAPI Google Jobs
to pick up their listings. The direct fetch is attempted first as a bonus.

### 2d. Indeed HTML Scraping (free, fragile)

| Config | Value |
|--------|-------|
| **Method** | Direct HTML fetch + Cheerio parsing |
| **Queries** | `"salesforce administrator"`, `"first salesforce admin"` |
| **Parsing** | Tries 3 strategies: JSON in `<script>`, DOM selectors, then JSON-LD |

Indeed blocks scrapers aggressively. This source works intermittently and serves as a bonus
when available. SerpAPI's Google Jobs already captures Indeed results more reliably.

### 2e. Bundled Data (fallback)

If all live API calls fail (e.g., network proxy blocking outbound), the scraper falls back to
`src/lib/scraped-jobs-data.ts` — a bundled set of 50+ real Salesforce job postings from Feb 2026.
This ensures the dashboard always has data to display.

---

## 3. Data Integrity Service

The data integrity service (`src/lib/data-integrity.ts`) ensures all company URLs are real
and accessible. Previously, company websites were guessed by slugifying the name (e.g.,
"TrueML" → `trueml.com`), which often led to broken links or wrong companies.

### How it works:

1. **URL Validation**: Every company website is checked via HEAD request
2. **Safe Fallbacks**: Invalid URLs are replaced with Google search URLs
3. **LinkedIn**: Always uses search URL (`linkedin.com/search/results/companies/?keywords=...`)
   instead of guessing direct company page URLs — this always works
4. **Caching**: Validation results cached for 1 hour to avoid repeated checks
5. **Timeout**: Batch validation has an 8-second timeout; unvalidated companies get safe fallbacks

### UI Indicators:

- Green checkmark: Website URL verified (responds with 2xx)
- Amber warning: Website unverified — link goes to Google search for the company
- "Find on LinkedIn" button: Always opens LinkedIn company search
- "Search Website" button: Opens Google search (when website is unverified)

---

## 4. Filtering Pipeline

Every scraped job goes through these filters before appearing on the dashboard:

```
Raw jobs from all sources (7+ APIs in parallel)
    │
    ▼
[1] Dedup by company+title (case-insensitive)
    │
    ▼
[2] isSalesforcePrimaryRole() — relevance filter
    │   ├── Title check: dedicated SF role vs non-SF role
    │   ├── Description check: qualifying vs disqualifying patterns
    │   └── Override: 2+ qualifying signals needed to override disqualifiers
    │
    ▼
[3] Build leads (group by company, score, extract snippets)
    │
    ▼
[4] Validate company URLs (HEAD requests, 8s timeout)
    │   ├── Valid → use direct URL (green checkmark)
    │   └── Invalid → use safe search URL (amber warning)
    │
    ▼
[5] Apply user filters (timeframe, size, industry, score)
    │
    ▼
Dashboard leads
```

### 4a. Title-Level Role Filter

**Accepted titles** (dedicated Salesforce roles):
```
salesforce|sfdc + admin|administrator|developer|engineer|architect|
                  consultant|specialist|analyst|manager|lead|coordinator
```

**Rejected titles** (non-SF roles that mention Salesforce):
```
aws, azure, gcp, java, .net, python, ruby, php, angular, react, node.js,
devops, data engineer, data scientist, machine learning, security, network,
infrastructure, support engineer, help desk, desktop, hardware
```

Examples:
- "Salesforce Administrator" -> ACCEPT
- "AWS Solutions Architect - Salesforce Integration" -> REJECT
- "Java Developer - Salesforce Platform Team" -> REJECT
- "DevOps Engineer (Salesforce CI/CD)" -> REJECT

### 4b. Description-Level Relevance Filter

When the title doesn't clearly indicate a Salesforce role, the description is analyzed:

**Disqualifying patterns** (job rejected):
- "Salesforce is not mandatory/required/necessary/essential"
- "Salesforce experience is a bonus/plus/nice-to-have/preferred/optional"
- "Salesforce would be a plus/advantage/asset"
- "Familiarity with Salesforce is a bonus/helpful"
- "Ideally has Salesforce experience"
- "Nice to have: ... Salesforce"

**Qualifying patterns** (job accepted):
- Role keywords: "Salesforce admin/developer/engineer/architect"
- Ownership verbs: "manage/own/administer/build/implement/configure ... Salesforce"
- Platform context: "Salesforce platform/instance/environment/deployment/migration"
- Experience: "3+ years of Salesforce"
- Explicit requirement: "Salesforce experience required/essential/mandatory"
- Certification: "Salesforce certif..."
- Core tools: "Sales Cloud, Service Cloud, Apex, Lightning, SOQL, Visualforce, Flow Builder"

**Override logic**: If disqualifying language is present, the job needs **2+ independent qualifying
signals** to override. A single weak match (like "Salesforce certif" in a sentence saying
"certification is not necessary") is not enough.

---

## 5. Scoring

Leads are scored 0-100 based on signal strength:

| Signal | Weight | Condition |
|--------|--------|-----------|
| **First-hire keywords** | +20 | "build from scratch", "greenfield", "sole contributor", "first salesforce", "standing up", "net new", "founding", etc. |
| **Standard SF role** | +10 | "salesforce administrator", "salesforce developer", "salesforce engineer", "crm implementation" |
| **Technographic (new SF detection)** | +20 | BuiltWith/Wappalyzer detects Salesforce adoption within 30 days |
| **Technographic (older)** | +10 | SF adoption detected within 90 days |
| **DNS/Infrastructure** | +20 | DNS CNAME/SPF pointing to Salesforce within 30 days |
| **Funding round** | +10 | Series A or B (likely building out CRM/GTM ops) |
| **Executive hire** | +10 | VP Sales, Head of RevOps, etc. |
| **AppExchange review** | +10 | Public footprint signal |

---

## 6. Signal Display (SignalPanel)

The panel shows **relevant snippets** extracted from the job description, not the full text.
Sentences are scored by keyword relevance and only the top 3 are shown.

Each signal card displays:
- Signal title (e.g., "Hiring: Salesforce Administrator")
- Relevant snippet with keywords highlighted
- Detection date and source
- Points contribution
- **"View full posting"** link to the original job URL

---

## 7. Logging System

The structured logging system (`src/lib/logger.ts`) captures every step of the pipeline:

- **Levels**: debug, info, warn, error (configurable via `LOG_LEVEL` env var)
- **Tags**: Each module has its own tag (scraper, lead-builder, data-integrity, api/leads, doc-generator)
- **Timestamps**: ISO 8601 format
- **Duration tracking**: `log.time('label')` returns a timer; call `.end()` to log duration
- **In-memory buffer**: Last 1000 entries available via `/api/logs`
- **Console output**: All logs go to stdout/stderr for Vercel's log stream

### Viewing Logs

```
GET /api/logs                    → all recent logs
GET /api/logs?level=error        → errors only
GET /api/logs?tag=scraper        → scraper logs only
GET /api/logs?limit=50           → last 50 entries
GET /api/logs?level=warn&tag=integrity → combined filters
```

---

## 8. Documentation System

Documentation is auto-generated from source code metadata:

- **Web page**: Visit `/docs` for a formatted, always-current documentation page
- **JSON API**: `GET /api/docs/generate` returns structured documentation
- **Source file**: `docs/hr-signals.md` (this file) is the master reference
- **Auto-updating**: The `/docs` page regenerates from `src/lib/doc-generator.ts` on every load

---

## 9. System Architecture

| Component | File | Description |
|-----------|------|-------------|
| **Scraper** | `src/lib/scraper.ts` | Multi-source job scraper (7+ APIs in parallel, 30-min cache) |
| **Lead Builder** | `src/lib/lead-builder.ts` | Transforms jobs → scored leads with URL validation |
| **Data Integrity** | `src/lib/data-integrity.ts` | Validates company URLs via HEAD requests |
| **Scoring Engine** | `src/lib/scoring.ts` | Scores leads 0-100 based on signal strength |
| **Logger** | `src/lib/logger.ts` | Structured logging with in-memory buffer |
| **Filter Engine** | `src/lib/filters.ts` | Timeframe, size, industry, score filters |
| **Doc Generator** | `src/lib/doc-generator.ts` | Auto-generates documentation from source code |

### API Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/api/leads` | GET | Main data endpoint — scrape, build, validate, filter |
| `/api/logs` | GET | View structured log entries |
| `/api/docs/generate` | GET | Auto-generated documentation (JSON) |
| `/api/digest/preview` | GET | Email digest preview (HTML) |

### Pages

| Path | Description |
|------|-------------|
| `/` | Main dashboard |
| `/docs` | Auto-generated documentation page |

---

## 10. Changelog

| Date | Change | Files |
|------|--------|-------|
| 2026-02-17 | Added structured logging system with levels, tags, timing, and in-memory buffer | `logger.ts`, all modules |
| 2026-02-17 | Added data integrity service: URL validation, safe fallbacks, verification badges | `data-integrity.ts`, `lead-builder.ts`, `LeadTable.tsx`, `SignalPanel.tsx` |
| 2026-02-17 | Added EarnBetter as job source (direct scraping + SerpAPI fallback) | `scraper.ts`, `types.ts` |
| 2026-02-17 | Added auto-updating documentation system with /docs page and /api/docs/generate | `doc-generator.ts`, `/docs/page.tsx`, `/api/docs/generate/route.ts` |
| 2026-02-17 | Added /api/logs endpoint for viewing structured logs | `/api/logs/route.ts` |
| 2026-02-17 | Company URLs now validated via HEAD requests instead of being invented | `lead-builder.ts`, `data-integrity.ts` |
| 2026-02-17 | LinkedIn links now use search URLs (always work) instead of guessed direct links | `lead-builder.ts`, `data-integrity.ts` |
| 2026-02-17 | Expanded disqualifying patterns: added "not mandatory/necessary/essential" without requiring "but" prefix; added "would be a plus/advantage/asset"; added "familiarity/exposure" weak signals | `scraper.ts` |
| 2026-02-17 | Stricter override: disqualifying + qualifying now requires 2+ qualifying signals instead of 1 | `scraper.ts` |
| 2026-02-17 | Title-level role filter: whitelist of dedicated SF roles, blacklist of non-SF roles (AWS, Java, DevOps, etc.) | `scraper.ts` |
| 2026-02-17 | Signal snippets: extract top 3 relevant sentences instead of showing full JD | `lead-builder.ts`, `SignalPanel.tsx` |
| 2026-02-17 | Added `url` field to Signal type for "View full posting" links | `types.ts`, `lead-builder.ts`, `SignalPanel.tsx` |
| 2026-02-17 | Added SerpAPI Google Jobs as aggregated source (LinkedIn, Indeed, Glassdoor, ZipRecruiter) | `scraper.ts` |
| 2026-02-17 | Initial relevance filter with qualifying/disqualifying patterns and test suite | `scraper.ts`, `salesforce-relevance.test.ts` |

---

## 11. Future Improvements

_Add planned changes here as they come up._

- [ ] Additional signal sources: Crunchbase funding events, BuiltWith technographic changes
- [ ] LinkedIn job posting API (requires LinkedIn partnership)
- [ ] Glassdoor company reviews mentioning Salesforce adoption
- [ ] Weighted scoring tuning based on conversion data
- [ ] Contact enrichment (Apollo/Hunter.io) for decision-maker emails
- [ ] Database persistence (PostgreSQL) for lead history
- [ ] Authentication and user accounts
- [ ] Export leads as CSV/Excel
