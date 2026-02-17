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

### 2c. Indeed HTML Scraping (free, fragile)

| Config | Value |
|--------|-------|
| **Method** | Direct HTML fetch + Cheerio parsing |
| **Queries** | `"salesforce administrator"`, `"first salesforce admin"` |
| **Parsing** | Tries 3 strategies: JSON in `<script>`, DOM selectors, then JSON-LD |

Indeed blocks scrapers aggressively. This source works intermittently and serves as a bonus
when available. SerpAPI's Google Jobs already captures Indeed results more reliably.

### 2d. Bundled Data (fallback)

If all live API calls fail (e.g., network proxy blocking outbound), the scraper falls back to
`src/lib/scraped-jobs-data.ts` — a bundled set of 50+ real Salesforce job postings from Feb 2026.
This ensures the dashboard always has data to display.

---

## 3. Filtering Pipeline

Every scraped job goes through these filters before appearing on the dashboard:

```
Raw jobs from all sources
    │
    ▼
[1] Dedup by company+title (case-insensitive)
    │
    ▼
[2] isSalesforcePrimaryRole() — relevance filter
    │
    ▼
[3] Title-level role filter — dedicated SF roles only
    │
    ▼
Dashboard leads
```

### 3a. Title-Level Role Filter

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

### 3b. Description-Level Relevance Filter

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

## 4. Scoring

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

## 5. Signal Display (SignalPanel)

The panel shows **relevant snippets** extracted from the job description, not the full text.
Sentences are scored by keyword relevance and only the top 3 are shown.

Each signal card displays:
- Signal title (e.g., "Hiring: Salesforce Administrator")
- Relevant snippet with keywords highlighted
- Detection date and source
- Points contribution
- **"View full posting"** link to the original job URL

---

## 6. Changelog

| Date | Change | Files |
|------|--------|-------|
| 2026-02-17 | Expanded disqualifying patterns: added "not mandatory/necessary/essential" without requiring "but" prefix; added "would be a plus/advantage/asset"; added "familiarity/exposure" weak signals | `scraper.ts` |
| 2026-02-17 | Stricter override: disqualifying + qualifying now requires 2+ qualifying signals instead of 1 | `scraper.ts` |
| 2026-02-17 | Title-level role filter: whitelist of dedicated SF roles, blacklist of non-SF roles (AWS, Java, DevOps, etc.) | `scraper.ts` |
| 2026-02-17 | Signal snippets: extract top 3 relevant sentences instead of showing full JD | `lead-builder.ts`, `SignalPanel.tsx` |
| 2026-02-17 | Added `url` field to Signal type for "View full posting" links | `types.ts`, `lead-builder.ts`, `SignalPanel.tsx` |
| 2026-02-17 | Added SerpAPI Google Jobs as aggregated source (LinkedIn, Indeed, Glassdoor, ZipRecruiter) | `scraper.ts` |
| 2026-02-17 | Initial relevance filter with qualifying/disqualifying patterns and test suite | `scraper.ts`, `salesforce-relevance.test.ts` |

---

## 7. Future Improvements

_Add planned changes here as they come up._

- [ ] Additional signal sources: Crunchbase funding events, BuiltWith technographic changes
- [ ] LinkedIn job posting API (requires LinkedIn partnership)
- [ ] Glassdoor company reviews mentioning Salesforce adoption
- [ ] Weighted scoring tuning based on conversion data
- [ ] Contact enrichment (Apollo/Hunter.io) for decision-maker emails
