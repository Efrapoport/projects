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
