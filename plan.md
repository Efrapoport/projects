# SI-Dependent Companies Dashboard Tab — Implementation Plan

## Overview
Add a new **"SI-Dependent Companies"** tab to the dashboard that uses signal-based detection to find companies using Salesforce but fully reliant on System Integrators, consultants, and contractors — with zero in-house SF expertise. Includes tailored outreach templates for pitching in-house SF capabilities.

---

## 1. SI-Dependency Signal Detection Engine

Create `src/lib/si-signals.ts` — the core detection logic.

### Signals to detect (with proposed weights):

| Signal | Weight | Detection Method |
|--------|--------|-----------------|
| **Hiring SF consultant/contractor** | +25 | Job title contains "consultant", "contractor", "contract", "freelance" + Salesforce keywords |
| **Staffing agency posting SF role for company** | +20 | Job posted by known staffing agency (Robert Half, TEKsystems, Apex, etc.) with client company name |
| **"Managed services" language in job posts** | +15 | Description mentions "managed services", "outsourced administration", "third-party support" |
| **Small SI job posting mentioning client** | +20 | Job posted by a small/niche SI mentioning company as client (excludes Big 4/5) |
| **Salesforce technographic signal + no FTE postings** | +20 | Company detected using SF (BuiltWith/DNS) but has zero full-time SF role postings in 12 months |
| **Contract-to-hire or temp SF roles** | +15 | Job posts with "contract-to-hire", "temp", "6-month engagement", "SOW-based" |
| **Multiple short-term SF roles over time** | +10 | Pattern of repeated short-term SF role postings (churn = no retention = no in-house) |
| **RFP/procurement for SF services** | +10 | Public RFP mentions for "Salesforce implementation", "SF managed services" |
| **Small IT headcount + SF usage** | +10 | Company uses SF but LinkedIn shows <3 people with IT/tech titles |
| **Using enterprise SI (EXCLUDE)** | -100 | If signals point to Big 4/5 SI involvement, disqualify the lead entirely |

### Known SI firms list (for matching) — LONGTAIL FOCUS:
We are **not** targeting companies using Big 4/5 SIs (Deloitte, Accenture, Cognizant, Wipro, etc.) — those are enterprise accounts with big budgets and long contracts we can't displace.

Instead, target companies using **small/niche SIs and independent consultants**:

**Small SF-focused SIs** (~5-50 employees): Coastal Cloud, Penrod, Torrent Consulting, Kicksaw, Neocol, Plative, Roycon, Demand Chain, Traction on Demand, Simplus, Cloud Giants, OpFocus, Galvin Technologies, CopperHill Consulting, RelationEdge, Aptaria, Girikon, Corrao Group, Webner Solutions, Algoworks, etc.

**Solo/freelance consultants**: Detected via patterns like "independent Salesforce consultant", freelance platforms (Upwork, Toptal), or very small consultancies (<10 people).

**Staffing agencies** (placing contract SF resources): Robert Half, TEKsystems, Apex Systems, Kforce, Insight Global, Hays, Modis/Akkodis, Harvey Nash, Randstad, etc.

### Exclusion list (DO NOT target these companies' clients):
Deloitte Digital, Accenture, Slalom, Cognizant, Wipro, Infosys, IBM Consulting, Capgemini, PwC, KPMG, EY, Publicis Sapient, McKinsey Digital — if a company is using one of these as their SI, they're enterprise and out of scope.

---

## 2. Data Sourcing — Extend the Scraper

Modify `src/lib/scraper.ts` to add SI-focused search queries.

### New search queries to add:
- "Salesforce consultant" (contract roles)
- "Salesforce managed services"
- "Salesforce contractor"
- "Salesforce implementation partner"
- "contract Salesforce administrator"
- "Salesforce freelance"

### New scraper behavior:
- Tag jobs as `si_dependent_signal: true` when they match SI-dependency patterns
- Extract the **client company name** when an SI/staffing firm posts on behalf of a client
- Cross-reference: if a company appears in SI/consultant postings but NOT in direct FTE postings, boost their SI-dependency score

### Bundled fallback data:
Add `src/lib/si-dependent-data.ts` with ~30-50 pre-scraped SI-dependency signal examples as fallback data (similar pattern to existing `scraped-jobs-data.ts`).

---

## 3. SI-Dependent Lead Builder

Create `src/lib/si-lead-builder.ts` — transforms raw signals into scored SI-dependent leads.

### Lead structure (extend types.ts):
```ts
interface SIDependentLead {
  id: string;
  company: Company;
  dependencyScore: number;           // 0-100
  signals: SISignal[];
  knownSIPartners: string[];         // e.g. ["Deloitte", "Coastal Cloud"]
  estimatedSFComplexity: 'basic' | 'moderate' | 'complex';
  siRelationshipType: 'full_outsource' | 'staff_augmentation' | 'project_based';
  contacts: Contact[];
  hiringManager?: HiringManager;
  firstDetected: string;
  lastUpdated: string;
}

interface SISignal {
  id: string;
  category: 'consultant_hiring' | 'staffing_agency' | 'si_partner_posting' | 'managed_services' | 'no_fte_history' | 'contract_pattern' | 'rfp_signal' | 'small_it_team';
  source: string;
  title: string;
  description: string;
  detectedAt: string;
  weight: number;
  siPartnerName?: string;            // which SI/agency if applicable
  clientCompanyExtracted?: string;   // company name extracted from SI posting
}
```

### Scoring logic:
- Sum signal weights, cap at 100
- Bonus +10 if multiple distinct SIs detected (fragmented = no ownership)
- Bonus +10 if pattern spans 6+ months (entrenched dependency)
- **Auto-disqualify** if any Big 4/5 enterprise SI is detected as the partner (score → 0, filtered out)
- Minimum threshold: 30 to appear in results
- Ideal targets: companies using 1-2 person consultancies, freelancers, or small SF shops

---

## 4. UI Components

### 4a. Tab Navigation
Create `src/components/TabBar.tsx`:
- Two tabs: **"First-Admin Radar"** (existing) and **"SI-Dependent Companies"** (new)
- Render at the top of the Dashboard, above StatsBar
- Active tab state managed in Dashboard.tsx

### 4b. SI Dashboard View
Create `src/components/SIDashboard.tsx` — the main container for the new tab:
- **Stats bar**: Total SI-Dependent Companies found, Avg Dependency Score, Top SI Partners detected, Industries represented
- **Lead table** (reuse/adapt LeadTable patterns): Company name, dependency score badge, SI partner names, relationship type, signal count, expand for details
- **Signal panel** (reuse/adapt SignalPanel patterns): SI signals grouped by type, SI partner details, company profile, contacts, outreach button

### 4c. SI Outreach Templates
Create outreach templates in `src/lib/si-outreach-templates.ts`:

**Template 1 — "Cost Savings"**: "You're paying a small consultancy $150-250/hr for routine admin — a dedicated hire pays for itself in months"
**Template 2 — "Control & Speed"**: "Your consultant handles tickets in their queue — an in-house admin fixes things in minutes, not days"
**Template 3 — "Consultant Dependency Risk"**: "What happens when your freelancer takes another client? Your entire SF instance has no one who knows it"
**Template 4 — "Outgrowing Your SI"**: "Small SIs are great to get started, but at your stage you need someone who lives in your business, not visits it"

Each template takes: contact name, company name, SI partner name(s), estimated complexity, industry.

---

## 5. API Route

Create `src/app/api/si-leads/route.ts`:
- `GET /api/si-leads` — runs SI-focused scraping, builds SI-dependent leads, returns scored results
- Same timeout/fallback patterns as existing `/api/leads`
- Returns `{ leads: SIDependentLead[], total, topSIPartners, industries, dataSource }`

---

## 6. Integration with Existing Features

- **Pipeline management**: SI-dependent leads get their own pipeline stages (or reuse existing)
- **Outreach modal**: Adapt OutreachModal to use SI-specific templates when on the SI tab
- **Authentication**: Same auth system, same user tracking
- **Investor tracking**: Same investor relationship matching applies

---

## 7. File Changes Summary

| Action | File |
|--------|------|
| **Create** | `src/lib/si-signals.ts` — Signal detection engine + SI/staffing firm lists |
| **Create** | `src/lib/si-lead-builder.ts` — Lead builder for SI-dependent companies |
| **Create** | `src/lib/si-outreach-templates.ts` — 4 outreach templates |
| **Create** | `src/lib/si-dependent-data.ts` — Bundled fallback data |
| **Create** | `src/components/TabBar.tsx` — Tab navigation component |
| **Create** | `src/components/SIDashboard.tsx` — SI tab main container |
| **Create** | `src/app/api/si-leads/route.ts` — API endpoint |
| **Modify** | `src/lib/types.ts` — Add SIDependentLead, SISignal types |
| **Modify** | `src/lib/scraper.ts` — Add SI-focused queries + signal tagging |
| **Modify** | `src/components/Dashboard.tsx` — Add TabBar, conditional rendering |
| **Modify** | `src/app/page.tsx` — Pass SI data to Dashboard |

---

## 8. Implementation Order

1. Types & signal definitions (`types.ts`, `si-signals.ts`)
2. Scraper extensions (`scraper.ts`) + fallback data (`si-dependent-data.ts`)
3. Lead builder (`si-lead-builder.ts`)
4. API route (`api/si-leads/route.ts`)
5. Tab navigation (`TabBar.tsx`) + Dashboard integration (`Dashboard.tsx`)
6. SI Dashboard view (`SIDashboard.tsx`)
7. Outreach templates (`si-outreach-templates.ts`) + modal integration
8. Page.tsx integration + end-to-end testing
