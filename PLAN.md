# Investor Relationship Feature — Implementation Plan

## Overview
For every company/lead in the dashboard, show whether it has a funding
relationship to one of the user's tracked investors.

Data is mock/sample for now — designed so real APIs (Crunchbase, etc.) can
be plugged in later.

---

## Relationship Definition

A **"relationship"** in this system means:

> An investor participated in a **funding round** for the company.

This is the only relationship type tracked today: `type: "funding"`.

### What counts as a funding relationship

A funding relationship is established when an investor is listed as a
participant (lead or co-investor) in a company's equity financing round
(Seed, Series A, Series B, growth equity, take-private, etc.).

Examples:
- "Sequoia Capital **led** Vanta's Series B ($110M)" → funding, confidence: high
- "Tiger Global **participated** in Restaurant365's Series D" → funding, confidence: medium
- "Andreessen Horowitz rumored to have invested in early rounds" → funding, confidence: low

### Confidence levels

| Level    | Meaning                                                       |
|----------|---------------------------------------------------------------|
| **high** | Investor led the round (named lead in press release / filing) |
| **medium** | Investor participated but did not lead                      |
| **low**  | Investor rumored or inferred from secondary sources           |

### Types NOT currently tracked

The following relationship types are **not implemented** but may be
added in the future:

| Type               | Description                                          |
|--------------------|------------------------------------------------------|
| `board_seat`       | Investor holds a board seat at the company            |
| `portfolio_overlap`| Investor also funded another lead in the dashboard    |

These were excluded from v1 because:
- **board_seat**: requires separate data source (proxy statements, etc.)
- **portfolio_overlap**: naturally emerges from the funding data — if
  Investor X funded both Company A and Company B, and both appear as
  leads, the user will see that connection by browsing the dashboard

---

## 1. Data Model (types.ts)

```ts
interface Investor {
  id: string;
  name: string;           // e.g. "Sequoia Capital"
  logoUrl?: string;
  website?: string;
  linkedinUrl?: string;
}

type RelationshipType = "funding";

interface InvestorRelationship {
  investorId: string;
  investorName: string;
  type: RelationshipType;
  details: string;        // e.g. "Led Series B ($28M, Jan 2026)"
  confidence: "high" | "medium" | "low";
}
```

Extends the existing `Lead` interface:

```ts
interface Lead {
  // ... existing fields ...
  investorRelationships?: InvestorRelationship[];
}
```

---

## 2. Mock Investor Data (`src/lib/investor-data.ts`)

A seed catalog of 8 well-known investors with realistic funding
mappings to companies that appear in the scraped lead data.

| Investor            | Connected Leads                    | Confidence |
|---------------------|------------------------------------|------------|
| Sequoia Capital     | Vanta                              | high       |
| Accel               | G2, GoCardless                     | high       |
| Andreessen Horowitz | LogicGate, Blink Health            | high / low |
| Insight Partners    | KnowBe4, Smartsheet, Sprout Social | high / med |
| Craft Ventures      | Vanta                              | medium     |
| ICONIQ Growth       | G2, Restaurant365, Labcorp         | medium/low |
| Tiger Global        | Built Technologies, Restaurant365  | medium     |
| Thoma Bravo         | Filevine, Varonis, Comscore        | med / low  |

Exports:
- `INVESTOR_CATALOG` — full list of known investors
- `getRelationshipsForCompany(companyName, trackedIds)` — returns
  `InvestorRelationship[]` filtered to the user's tracked investors
- `countLeadsForInvestor(investorId, companyNames)` — count of leads
  connected to an investor (for the management UI)

---

## 3. User's Tracked Investor List (localStorage)

**File: `src/lib/investor-context.tsx`**

React context + `useInvestors()` hook:
- `trackedInvestors: Investor[]` — the user's current list
- `trackedIds: Set<string>` — for fast lookup
- `addInvestor(id)` / `removeInvestor(id)` / `isTracked(id)`
- Persists to `localStorage` key `"tracked-investors"`
- Default set: Sequoia, a16z, Insight Partners

---

## 4. Client-Side Enrichment

Investor relationship matching runs entirely **client-side** because:
- The tracked investor list lives in localStorage (browser-only)
- The mock data lookup is instant (in-memory map)
- No server-side changes to `lead-builder.ts` or `scoring.ts` needed

When real APIs are added later, enrichment would move server-side
(same pattern as `batchEnrichEmployeeCounts`).

---

## 5. UI — Lead Table Badge (`LeadTable.tsx`)

A small amber `Handshake` badge next to the company name when the lead
has at least one funding connection to a tracked investor:
- Single investor: shows investor name
- Multiple: shows "N investors"
- Tooltip with full investor list

---

## 6. UI — SignalPanel Investor Section (`SignalPanel.tsx`)

An **"Investor Connections"** section between "Why They Are Here" and
"Likely Hiring Manager":
- Each connection displayed as a card with:
  - Investor name
  - Funding details (round, amount)
  - Confidence badge (high/medium/low)
  - Link to investor website
- Only shown when the lead has connections to tracked investors

---

## 7. UI — Investor Management Modal (`InvestorManager.tsx`)

Accessible from the "My Investors" button in the dashboard header:
- Search/browse the investor catalog
- Add/remove investors via checkbox toggle
- Shows count of leads connected to each investor
- Centered modal with search bar

---

## 8. File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/types.ts` | Edit | Add `Investor`, `InvestorRelationship`, `RelationshipType`; extend `Lead` |
| `src/lib/investor-data.ts` | **New** | Mock investor catalog + relationship lookup |
| `src/lib/investor-context.tsx` | **New** | React context for tracked investors + localStorage |
| `src/components/InvestorManager.tsx` | **New** | Investor list management UI |
| `src/components/LeadTable.tsx` | Edit | Add investor badge next to company name |
| `src/components/SignalPanel.tsx` | Edit | Add "Investor Connections" section |
| `src/components/Dashboard.tsx` | Edit | Add "My Investors" button + modal |
| `src/app/layout.tsx` | Edit | Wrap app with InvestorProvider |

---
---

# Contact Tracking Pipeline — Implementation Plan

## Overview

Add a sales pipeline to the dashboard so team members can track each lead
through outreach stages, see who on the team moved it and when, and get help
writing personalized LinkedIn connection messages.

**Multi-user**: uses Google OAuth (NextAuth.js) so each action is attributed
to the team member who performed it.

---

## Pipeline Stages

```
new → linkedin_requested → outreach_sent → meeting_scheduled → closed_won
                                                              → closed_lost
```

| Stage                | Badge Color | Icon   | Meaning                          |
|----------------------|-------------|--------|----------------------------------|
| `new`                | gray        | circle | No one has touched this lead yet |
| `linkedin_requested` | blue        | user   | LinkedIn friend request sent     |
| `outreach_sent`      | purple      | mail   | Personal outreach message sent   |
| `meeting_scheduled`  | amber       | handshake | Meeting is on the calendar    |
| `closed_won`         | green       | check  | Deal closed successfully         |
| `closed_lost`        | red         | x      | Lead did not convert             |

---

## 1. Authentication — Google OAuth

**Library**: `next-auth` v5 (Auth.js) with Google provider.

**New files**:
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `src/lib/auth.ts` — NextAuth config (Google client ID/secret from env)

**Modified files**:
- `src/app/layout.tsx` — wrap app with `<SessionProvider>`
- `src/components/Dashboard.tsx` — show logged-in user name/avatar in header,
  redirect to sign-in if not authenticated

**Environment variables** (`.env.local`):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
```

User identity from Google profile: `{ name, email, image }`.

---

## 2. Data Model

### Pipeline Types (`src/lib/pipeline-types.ts`)

```ts
type PipelineStage =
  | "new"
  | "linkedin_requested"
  | "outreach_sent"
  | "meeting_scheduled"
  | "closed_won"
  | "closed_lost";

interface PipelineEvent {
  stage: PipelineStage;
  updatedBy: {
    name: string;
    email: string;
  };
  updatedAt: string;    // ISO date
  note?: string;        // optional note from the user
}

interface PipelineEntry {
  leadId: string;
  currentStage: PipelineStage;
  history: PipelineEvent[];  // ordered oldest → newest
}
```

### Extends Lead type (`src/lib/types.ts`)

No change to the Lead interface itself — pipeline data lives in a separate
store keyed by `lead.id` and is joined client-side.

---

## 3. Server-Side Storage (`src/lib/pipeline-store.ts`)

JSON file at `data/pipeline.json`:
```json
{
  "lead-id-1": {
    "leadId": "lead-id-1",
    "currentStage": "outreach_sent",
    "history": [
      { "stage": "linkedin_requested", "updatedBy": { "name": "Jane", "email": "jane@co.com" }, "updatedAt": "2026-02-19T..." },
      { "stage": "outreach_sent", "updatedBy": { "name": "Jane", "email": "jane@co.com" }, "updatedAt": "2026-02-21T..." }
    ]
  }
}
```

Exports:
- `getAllPipelineEntries()` — read the full map
- `getPipelineEntry(leadId)` — single lead
- `updatePipelineStage(leadId, stage, user, note?)` — append event + update current stage

File is created automatically on first write if it doesn't exist.

---

## 4. API Routes (`src/app/api/pipeline/route.ts`)

| Method | Purpose | Body |
|--------|---------|------|
| `GET`  | Fetch all pipeline data | — |
| `POST` | Update a lead's stage | `{ leadId, stage, note? }` |

POST handler reads the authenticated user from the NextAuth session and
records their name/email in the event. Returns 401 if not logged in.

---

## 5. UI — Lead Table Stage Column (`LeadTable.tsx`)

Add a **"Stage"** column between Score and Trigger Event:

- **Color badge** showing current stage with icon (gray=New, blue=LinkedIn,
  purple=Outreach, amber=Meeting, green=Won, red=Lost)
- **Sub-text** below badge: `"{Name} · {date}"` from the most recent history event
- Badge is **clickable** — opens the stage dropdown

---

## 6. UI — Stage Dropdown (`PipelineDropdown.tsx`)

Appears as a popover anchored to the clicked badge:

- Vertical list of all 6 stages, current stage highlighted with a filled circle
- **History section** below: chronological list of past events
  (`"Jane → LinkedIn Req (Feb 19)"`)
- **Note input** at the bottom: optional text field
- **[Update]** button: saves the selected stage + note via POST /api/pipeline
- Special behavior: selecting `outreach_sent` opens the Outreach Modal instead

---

## 7. UI — Outreach Modal (`OutreachModal.tsx`)

Compact single-column modal that appears when advancing to `outreach_sent`:

```
┌─────────────────────────────────────────────┐
│  ✉ LinkedIn Message for {Company}      [X]  │
│  ─────────────────────────────────────────── │
│  To: {HiringManager.name}, {title}          │
│  Context: {triggerEvent}                    │
│  Score: {score} · {industry} · {size} emps  │
│  ─────────────────────────────────────────── │
│                                             │
│  {editable generated message}               │
│                                             │
│  ─────────────────────────────────────────── │
│  Template: [Greenfield CRM ▼]               │
│  ─────────────────────────────────────────── │
│  [Regenerate]  [Copy]  [Copy & Mark Sent →] │
└─────────────────────────────────────────────┘
```

**Message generation**: Template-based (no external AI API). Templates use
lead data to fill placeholders:
- `{contactName}` — hiring manager or first contact name
- `{companyName}` — company name
- `{triggerSummary}` — short version of trigger event
- `{industry}` — company industry
- `{companySize}` — employee count

### Templates (`src/lib/outreach-templates.ts`)

| Template Name      | When to use                                   |
|--------------------|-----------------------------------------------|
| Greenfield CRM     | Company hiring first SF admin, no existing CRM |
| Migration          | Company transitioning from HubSpot/spreadsheets |
| Growth Stage       | Scaling company adding SF team members          |
| General            | Fallback for any lead                           |

Auto-selects the best template based on signal keywords.

---

## 8. Dashboard Integration (`Dashboard.tsx`)

- Fetch pipeline data from `GET /api/pipeline` on mount (alongside leads)
- Pass `pipelineData` map to `LeadTable`
- Show logged-in user avatar + name in header (from NextAuth session)
- Add sign-out option

---

## 9. File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/pipeline-types.ts` | **New** | `PipelineStage`, `PipelineEvent`, `PipelineEntry` types |
| `src/lib/pipeline-store.ts` | **New** | Server-side JSON read/write for pipeline data |
| `src/lib/outreach-templates.ts` | **New** | LinkedIn message templates + auto-selection |
| `src/lib/auth.ts` | **New** | NextAuth config with Google provider |
| `src/app/api/auth/[...nextauth]/route.ts` | **New** | NextAuth API route handler |
| `src/app/api/pipeline/route.ts` | **New** | GET/POST pipeline API |
| `src/components/PipelineDropdown.tsx` | **New** | Clickable stage dropdown with history |
| `src/components/OutreachModal.tsx` | **New** | LinkedIn message generator modal |
| `src/lib/types.ts` | Edit | (no changes — pipeline data is separate) |
| `src/components/LeadTable.tsx` | Edit | Add Stage column with PipelineDropdown |
| `src/components/Dashboard.tsx` | Edit | Fetch pipeline data, show user, wire auth |
| `src/app/layout.tsx` | Edit | Wrap with SessionProvider |
| `package.json` | Edit | Add `next-auth` dependency |
| `data/pipeline.json` | **New** (auto-created) | Pipeline state file |

---

## 10. Implementation Order

1. Install `next-auth`, configure Google OAuth (`auth.ts` + route handler)
2. Wrap layout with `SessionProvider`, add user display to Dashboard header
3. Define pipeline types (`pipeline-types.ts`)
4. Build server-side store (`pipeline-store.ts` + `data/pipeline.json`)
5. Create pipeline API routes (`/api/pipeline`)
6. Build `PipelineDropdown` component
7. Add Stage column to `LeadTable` with clickable badges
8. Create outreach message templates (`outreach-templates.ts`)
9. Build `OutreachModal` component
10. Wire outreach modal into pipeline dropdown (trigger on `outreach_sent`)
11. Test end-to-end: sign in → change stage → generate message → copy
