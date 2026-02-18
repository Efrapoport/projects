# Investor Relationship Feature — Implementation Plan

## Overview
For every company/lead in the dashboard, show whether it has a relationship
to one of the user's tracked investors. Relationships include funding,
board seats, and portfolio overlap with other leads.

Data is mock/sample for now — designed so real APIs (Crunchbase, etc.) can
be plugged in later.

---

## 1. Data Model (types.ts)

Add these new interfaces:

```ts
interface Investor {
  id: string;
  name: string;           // e.g. "Sequoia Capital"
  logoUrl?: string;
  website?: string;
  linkedinUrl?: string;
}

type RelationshipType = "funding" | "board_seat" | "portfolio_overlap";

interface InvestorRelationship {
  investorId: string;
  investorName: string;
  type: RelationshipType;
  details: string;        // e.g. "Led Series B ($28M, Jan 2026)"
  confidence: "high" | "medium" | "low";
}
```

Extend the existing `Lead` interface:

```ts
interface Lead {
  // ... existing fields ...
  investorRelationships?: InvestorRelationship[];
}
```

---

## 2. Mock Investor Data (new file: `src/lib/investor-data.ts`)

Create a **seed catalog** of ~8-10 well-known investors with realistic
portfolio mappings to the existing sample companies. Examples:

| Investor         | Connected Leads            | Relationship Types        |
|------------------|----------------------------|---------------------------|
| Sequoia Capital  | NovaPay, BrightEdge AI     | funding, board_seat       |
| Accel Partners   | CloudKitchen, DataMesh     | funding                   |
| a16z             | BrightEdge AI              | funding, portfolio_overlap|
| Insight Partners | RetailStack, NovaPay       | funding                   |
| ...              | ...                        | ...                       |

This file exports:
- `INVESTOR_CATALOG`: Full list of known investors with portfolio data
- `getRelationshipsForCompany(companyName, trackedInvestorIds)`: Returns
  `InvestorRelationship[]` — only relationships involving the user's
  tracked investors

---

## 3. User's Tracked Investor List (localStorage persistence)

Since there's no database, store the user's selected investors in
**localStorage** via a React context:

**New file: `src/lib/investor-context.tsx`**
- `InvestorProvider` wraps the app
- `useInvestors()` hook exposes:
  - `trackedInvestors: Investor[]` — the user's current list
  - `addInvestor(investor)` / `removeInvestor(id)`
  - `isTracked(id): boolean`
- Persists to `localStorage` key `"tracked-investors"`
- Ships with a sensible default set (e.g. 3-4 pre-selected investors)

---

## 4. Lead Enrichment with Investor Data

**In `src/lib/lead-builder.ts`** (or a new helper called from it):

After building leads, run a pass that attaches `investorRelationships`
to each lead by calling `getRelationshipsForCompany()`.

Since investor matching is currently mock data, this is a simple
in-memory lookup — no API calls. When real APIs are added later, this
becomes an async enrichment step (same pattern as the existing
`batchEnrichEmployeeCounts`).

---

## 5. Scoring Integration (scoring.ts)

Add investor connection as a scoring signal:

| Condition                           | Points |
|-------------------------------------|--------|
| Has funding relationship to tracked investor | +10    |
| Has board seat connection            | +10    |
| Has portfolio overlap with another lead | +5     |

Cap still applies (max 100).

---

## 6. UI — Lead Table Badge (`LeadTable.tsx`)

Add a small **investor badge** on rows that have at least one investor
relationship:

- A subtle icon (e.g. Lucide `Handshake` or `Link2`) next to the
  company name
- Colored by strongest relationship: gold for funding/board, blue for
  portfolio overlap
- Tooltip on hover showing: "Connected to Sequoia Capital (Series B)"
- If multiple investors match, show count: "2 investor connections"

---

## 7. UI — SignalPanel Investor Section (`SignalPanel.tsx`)

Add a new **"Investor Connections"** section between "Why They Are Here"
and the signals grid:

```
┌─────────────────────────────────┐
│  🤝 Investor Connections (2)    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Sequoia Capital           │  │
│  │ 💰 Led Series B ($28M)   │  │
│  │ Confidence: High          │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Insight Partners          │  │
│  │ 📊 Portfolio overlap:     │  │
│  │    also invested in       │  │
│  │    RetailStack (lead #4)  │  │
│  │ Confidence: Medium        │  │
│  └───────────────────────────┘  │
│                                 │
│  No connection? [Dismiss]       │
└─────────────────────────────────┘
```

Each card shows:
- Investor name (+ logo if available)
- Relationship type with details
- Confidence badge
- Link to investor website/LinkedIn if available

---

## 8. UI — Investor Management Modal (`InvestorManager.tsx`)

A new component accessible from the dashboard header (button: "My
Investors" or similar):

- **Search/browse** the investor catalog
- **Add/remove** investors to tracked list (checkbox toggle)
- **Shows count** of leads connected to each investor
- Simple modal or slide-over panel
- Could also be accessed from the existing filter bar

---

## 9. File Change Summary

| File | Action | What Changes |
|------|--------|-------------|
| `src/lib/types.ts` | Edit | Add `Investor`, `InvestorRelationship`, `RelationshipType`; extend `Lead` |
| `src/lib/investor-data.ts` | **New** | Mock investor catalog + relationship lookup function |
| `src/lib/investor-context.tsx` | **New** | React context for tracked investors + localStorage |
| `src/lib/lead-builder.ts` | Edit | Attach `investorRelationships` to leads |
| `src/lib/scoring.ts` | Edit | Add investor connection scoring weights |
| `src/components/LeadTable.tsx` | Edit | Add investor badge column/icon |
| `src/components/SignalPanel.tsx` | Edit | Add "Investor Connections" section |
| `src/components/InvestorManager.tsx` | **New** | Investor list management UI |
| `src/components/Dashboard.tsx` | Edit | Wire up InvestorProvider + "My Investors" button |
| `src/app/layout.tsx` | Edit | Wrap app with InvestorProvider |

---

## 10. Implementation Order

1. **Data model** — types + mock data (no UI changes yet)
2. **Investor context** — provider, hook, localStorage
3. **Lead enrichment** — wire investor relationships into lead-builder
4. **Scoring** — add investor weights
5. **LeadTable badge** — visual indicator on rows
6. **SignalPanel section** — detailed investor cards
7. **InvestorManager** — add/remove investor UI
8. **Dashboard wiring** — button, provider, final integration
9. **Build & verify** — ensure everything compiles and renders

---

## Open Questions

- Should the filter bar support filtering leads by "has investor
  connection"? (Can add as a follow-up)
- Any preference on the "My Investors" button placement — header bar
  vs. filter area?
