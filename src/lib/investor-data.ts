// ── Investor Catalog & Funding Relationships ─────────────────────────
//
// Catalog of 44 Salesforce-ecosystem investors (funds, angels, and
// family offices) tracked by users of this dashboard.
//
// COMPANY_FUNDING_MAP is populated as real funding data is discovered.
// Keys are lowercased company names from scraped leads.

import { Investor, InvestorRelationship } from "./types";

// ── Investor Catalog ────────────────────────────────────────────────

export const INVESTOR_CATALOG: Investor[] = [
  // ── Institutional Funds ──────────────────────────────────────────
  {
    id: "time-ventures",
    name: "Time Ventures",
    website: "https://www.thetimeventures.com",
    linkedinUrl: "https://www.linkedin.com/in/marcbenioff",
  },
  {
    id: "abstract",
    name: "Abstract Ventures",
    website: "https://www.abstract.com",
    linkedinUrl: "https://www.linkedin.com/company/abstract-ventures",
  },
  {
    id: "astar",
    name: "A* (AStar)",
    website: "https://www.a-star.co",
    linkedinUrl: "https://www.linkedin.com/in/hartz",
  },
  {
    id: "vesey",
    name: "Vesey Ventures",
    website: "https://www.vesey.vc",
    linkedinUrl: "https://www.linkedin.com/company/veseyventures",
  },
  {
    id: "svangel",
    name: "SV Angel",
    website: "https://svangel.com",
    linkedinUrl: "https://www.linkedin.com/company/sv-angel",
  },
  {
    id: "nfx",
    name: "NFX",
    website: "https://www.nfx.com",
    linkedinUrl: "https://www.linkedin.com/company/nfxvc",
  },
  {
    id: "conviction",
    name: "Conviction",
    website: "https://www.conviction.com",
    linkedinUrl: "https://www.linkedin.com/company/convictionvc",
  },
  {
    id: "valkyrie",
    name: "Valkyrie Ventures",
    website: "https://www.valkyrie.vc",
    linkedinUrl: "https://www.linkedin.com/in/elizabethenglishturner",
  },
  {
    id: "sunflower",
    name: "Sunflower VC",
    website: "https://sunflowercapital.co",
    linkedinUrl: "https://www.linkedin.com/in/liujiang1",
  },
  {
    id: "liquid2",
    name: "Liquid2 Ventures",
    website: "https://www.liquid2.vc",
    linkedinUrl: "https://www.linkedin.com/in/joe-montana-464701b",
  },
  {
    id: "operator-collective",
    name: "Operator Collective",
    website: "https://www.operatorcollective.com",
    linkedinUrl: "https://www.linkedin.com/company/operator-collective",
  },
  {
    id: "cb-access",
    name: "CB Access Fund LP",
  },
  {
    id: "g20",
    name: "G20 Ventures",
    website: "https://www.g20vc.com",
    linkedinUrl: "https://www.linkedin.com/company/g20-ventures",
  },
  {
    id: "deutch",
    name: "Deutch & Co",
  },

  // ── Notable Individual Investors ─────────────────────────────────
  {
    id: "michael-dell",
    name: "Michael Dell",
    website: "https://www.dellfamilyoffice.com",
    linkedinUrl: "https://www.linkedin.com/in/mdell",
  },
  {
    id: "george-kurtz",
    name: "George Kurtz",
    linkedinUrl: "https://www.linkedin.com/in/georgekurtz",
  },
  {
    id: "alex-dayon",
    name: "Alex Dayon",
    linkedinUrl: "https://www.linkedin.com/in/adayon",
  },
  {
    id: "diane-greene",
    name: "Diane Greene",
    linkedinUrl: "https://www.linkedin.com/in/diane-greene-574216159",
  },
  {
    id: "david-schmaier",
    name: "David Schmaier",
    linkedinUrl: "https://www.linkedin.com/in/david-schmaier-70476b43",
  },
  {
    id: "aaron-levie",
    name: "Aaron Levie",
    website: "https://www.box.com",
    linkedinUrl: "https://www.linkedin.com/in/boxaaron",
  },
  {
    id: "srini-tallapragada",
    name: "Srini Tallapragada",
    linkedinUrl: "https://www.linkedin.com/in/stallapr",
  },
  {
    id: "peter-high",
    name: "Peter High",
    website: "https://www.metisstrategy.com",
    linkedinUrl: "https://www.linkedin.com/in/peter-high-07a94a1",
  },
  {
    id: "susan-sobbott",
    name: "Susan Sobbott",
    linkedinUrl: "https://www.linkedin.com/in/susansobbott",
  },
  {
    id: "ronnen-harary",
    name: "Ronnen Harary",
  },
  {
    id: "abidali-neemuchwala",
    name: "Abidali Neemuchwala",
    linkedinUrl: "https://www.linkedin.com/in/abidali-neemuchwala",
  },

  // ── Angel Investors ──────────────────────────────────────────────
  {
    id: "yasmin-lukatz",
    name: "Yasmin Lukatz",
    website: "https://www.iconsv.org",
    linkedinUrl: "https://www.linkedin.com/in/yasmin-lukatz-3182251",
  },
  {
    id: "akhil-paul",
    name: "Akhil Paul",
    linkedinUrl: "https://www.linkedin.com/in/akhil--paul",
  },
  {
    id: "moran-levinovitz",
    name: "Moran Levinovitz",
    linkedinUrl: "https://www.linkedin.com/in/moranlevinovitz",
  },
  {
    id: "anu-bharadwaj",
    name: "Anu Bharadwaj",
    linkedinUrl: "https://www.linkedin.com/in/anutthara",
  },
  {
    id: "ashwin-srinivas",
    name: "Ashwin Srinivas",
  },
  {
    id: "ofir-ehrlich",
    name: "Ofir Ehrlich",
    linkedinUrl: "https://www.linkedin.com/in/ofirehrlich",
  },
  {
    id: "dror-shpindel",
    name: "Dror Shpindel",
  },
  {
    id: "dan-biderman",
    name: "Dan Biderman",
  },
  {
    id: "alon-arvatz",
    name: "Alon Arvatz",
    linkedinUrl: "https://www.linkedin.com/in/alon-arvatz",
  },
  {
    id: "barak-kaufman",
    name: "Barak Kaufman",
    linkedinUrl: "https://www.linkedin.com/in/barak-kaufman-a7759933",
  },
  {
    id: "joe-teplow",
    name: "Joe Teplow",
    linkedinUrl: "https://www.linkedin.com/in/joeteplow",
  },
  {
    id: "jay-mandelbaum",
    name: "Jay Mandelbaum",
    linkedinUrl: "https://www.linkedin.com/in/jay-mandelbaum-03972549",
  },
  {
    id: "alex-pinchev",
    name: "Alex Pinchev",
    website: "https://www.capriventures.com",
    linkedinUrl: "https://www.linkedin.com/in/alexpinchev",
  },
  {
    id: "aryeh-mergi",
    name: "Aryeh Mergi",
    linkedinUrl: "https://www.linkedin.com/in/aryehm",
  },
  {
    id: "steve-klein",
    name: "Steve Klein",
    website: "https://www.applecoreholdings.com",
    linkedinUrl: "https://www.linkedin.com/in/stevehklein",
  },
  {
    id: "gilly-ron",
    name: "Gilly Ron",
    linkedinUrl: "https://www.linkedin.com/in/gilly-ron-b9ab51",
  },
  {
    id: "dennis-shaya",
    name: "Dennis Shaya",
    linkedinUrl: "https://www.linkedin.com/in/dennis-shaya-1a41664",
  },
  {
    id: "john-ball",
    name: "John Ball",
    linkedinUrl: "https://www.linkedin.com/in/john-ball-b11655",
  },
  {
    id: "yoav-anaki",
    name: "Yoav Anaki",
    website: "https://yoav.us",
  },
];

// Default investors pre-selected for new users (all investors)
export const DEFAULT_TRACKED_IDS = INVESTOR_CATALOG.map((inv) => inv.id);

// ── Company → Investor Funding Map ──────────────────────────────────
// Keys are lowercased company names.  Each entry lists the investor ID,
// round details, and confidence level.  Populated as real funding data
// is discovered for scraped leads.

interface FundingEntry {
  investorId: string;
  details: string;
  confidence: "high" | "medium" | "low";
}

const COMPANY_FUNDING_MAP: Record<string, FundingEntry[]> = {
  // ── NFX Portfolio (298 companies, 15 unicorns, 10 IPOs, 52 acquisitions) ──
  // Source: nfx.com/companies, Tracxn, Crunchbase, press releases
  "doordash": [
    { investorId: "nfx", details: "Seed investor; IPO 2020 — unicorn exit", confidence: "high" },
    { investorId: "svangel", details: "Portfolio company — delivery, IPO", confidence: "high" },
  ],
  "lyft": [
    { investorId: "nfx", details: "Seed investor; IPO 2019 — unicorn exit", confidence: "high" },
  ],
  "trulia": [
    { investorId: "nfx", details: "Seed investor; acquired by Zillow 2015", confidence: "high" },
  ],
  "patreon": [
    { investorId: "nfx", details: "Seed investor — unicorn", confidence: "high" },
  ],
  "poshmark": [
    { investorId: "nfx", details: "Seed investor; IPO 2021", confidence: "high" },
  ],
  "similarweb": [
    { investorId: "nfx", details: "Seed investor; NYSE IPO 2021 ($1.6B)", confidence: "high" },
  ],
  "playtika": [
    { investorId: "nfx", details: "Portfolio company — public company", confidence: "high" },
  ],
  "mammoth biosciences": [
    { investorId: "nfx", details: "Seed investor; Series D unicorn ($1B+)", confidence: "high" },
  ],
  "global-e": [
    { investorId: "nfx", details: "Portfolio company; Nasdaq IPO", confidence: "high" },
  ],
  "myheritage": [
    { investorId: "nfx", details: "Portfolio company — unicorn", confidence: "high" },
  ],
  "plarium": [
    { investorId: "nfx", details: "Portfolio company — acquired", confidence: "medium" },
  ],
  "moon active": [
    { investorId: "nfx", details: "Portfolio company — unicorn", confidence: "high" },
  ],
  "novig": [
    { investorId: "nfx", details: "Investment Feb 2026 — Entertainment Software", confidence: "high" },
  ],
  "anchorage digital": [
    { investorId: "nfx", details: "Portfolio company — Financial Software", confidence: "high" },
  ],
  "twostep therapeutics": [
    { investorId: "nfx", details: "Portfolio company — Biotechnology", confidence: "medium" },
  ],
  "medinas": [
    { investorId: "nfx", details: "Notable portfolio company", confidence: "high" },
  ],
  "lastminute.com": [
    { investorId: "nfx", details: "Portfolio company — marketplace", confidence: "medium" },
  ],
  "valora": [
    { investorId: "nfx", details: "Portfolio company; acquired by Stripe Dec 2025", confidence: "high" },
  ],

  // ── Conviction Portfolio (32 companies, 5 unicorns — AI-native focus) ──
  // Source: conviction.com, Tracxn, Fortune, CB Insights, Wikipedia
  "harvey": [
    { investorId: "conviction", details: "Early investor — legal AI ($3B valuation)", confidence: "high" },
  ],
  "mistral": [
    { investorId: "conviction", details: "Early investor — open-source AI ($6B valuation)", confidence: "high" },
  ],
  "mistral ai": [
    { investorId: "conviction", details: "Early investor — open-source AI ($6B valuation)", confidence: "high" },
  ],
  "baseten": [
    { investorId: "conviction", details: "Early investor — inference platform ($825M, unicorn 2025)", confidence: "high" },
  ],
  "sierra": [
    { investorId: "conviction", details: "Early investor — conversational AI ($4.5B valuation)", confidence: "high" },
    { investorId: "svangel", details: "Portfolio company — conversational AI", confidence: "high" },
  ],
  "cognition": [
    { investorId: "conviction", details: "Portfolio company — AI coding ($4B valuation)", confidence: "high" },
  ],
  "cognition labs": [
    { investorId: "conviction", details: "Portfolio company — AI coding ($4B valuation)", confidence: "high" },
  ],
  "cartesia": [
    { investorId: "conviction", details: "Portfolio company — AI research, Series A Dec 2024", confidence: "high" },
    { investorId: "astar", details: "$64M raise — real-time voice AI", confidence: "high" },
  ],
  "heygen": [
    { investorId: "conviction", details: "Portfolio company — AI video platform, Series A $60M", confidence: "high" },
  ],
  "essential": [
    { investorId: "conviction", details: "Portfolio company — AI (Ashish Vashwani, Niki Parmar)", confidence: "medium" },
  ],
  "culminate": [
    { investorId: "conviction", details: "Portfolio company — AI", confidence: "medium" },
  ],
  "latent": [
    { investorId: "conviction", details: "Portfolio company — AI", confidence: "medium" },
  ],
  "listen labs": [
    { investorId: "conviction", details: "Portfolio company — AI", confidence: "medium" },
  ],
  "minion": [
    { investorId: "conviction", details: "Portfolio company — AI (Alex Graveley)", confidence: "medium" },
  ],
  "mithril": [
    { investorId: "conviction", details: "Portfolio company — AI (Jared Quincy Davis)", confidence: "medium" },
  ],
  "open evidence": [
    { investorId: "conviction", details: "Portfolio company — AI evidence platform", confidence: "high" },
  ],
  "openevidence": [
    { investorId: "conviction", details: "Portfolio company — AI evidence platform", confidence: "high" },
  ],
  "runsybil": [
    { investorId: "conviction", details: "Portfolio company — AI (Ari Herbert-Voss)", confidence: "medium" },
  ],
  "sola": [
    { investorId: "conviction", details: "Portfolio company — AI (Jessica Wu, Neil Desmukh)", confidence: "medium" },
  ],
  "sunday": [
    { investorId: "conviction", details: "Portfolio company — Robotics (Tony Zhao, Cheng Chi)", confidence: "medium" },
  ],
  "thinking machines lab": [
    { investorId: "conviction", details: "Portfolio company — AI research", confidence: "medium" },
  ],
  "corridor": [
    { investorId: "conviction", details: "Seed investment $5.4M — most recent", confidence: "high" },
  ],
  "phylo": [
    { investorId: "conviction", details: "Portfolio company — Commercial Services", confidence: "medium" },
  ],
  "seek ai": [
    { investorId: "conviction", details: "Portfolio company; acquired by IBM Jun 2025", confidence: "high" },
  ],
  "contextual ai": [
    { investorId: "conviction", details: "Portfolio company — AI", confidence: "high" },
  ],
  "ideogram": [
    { investorId: "conviction", details: "Portfolio company — AI image generation", confidence: "high" },
  ],
  "wabi": [
    { investorId: "conviction", details: "Investment Nov 2025 — Software Development", confidence: "high" },
  ],
  "huxe": [
    { investorId: "conviction", details: "Seed investment Sep 2025", confidence: "high" },
  ],
  "foundry": [
    { investorId: "conviction", details: "Portfolio company — AI", confidence: "medium" },
  ],

  // ── Liquid2 Ventures Portfolio (800+ companies, 35 unicorns, 100 exits) ──
  // Source: liquid2.vc/portfolio, Tracxn, Crunchbase, Wikipedia, press releases
  "gitlab": [
    { investorId: "liquid2", details: "Seed investor $1.5M 2015; Nasdaq IPO Oct 2021 ($11B)", confidence: "high" },
  ],
  "rippling": [
    { investorId: "liquid2", details: "Early investor — HR/IT platform, unicorn", confidence: "high" },
    { investorId: "abstract", details: "Portfolio company — HR/IT platform, unicorn", confidence: "high" },
  ],
  "jasper ai": [
    { investorId: "liquid2", details: "Portfolio company — AI content, unicorn", confidence: "high" },
  ],
  "jasper": [
    { investorId: "liquid2", details: "Portfolio company — AI content, unicorn", confidence: "high" },
  ],
  "retool": [
    { investorId: "liquid2", details: "Portfolio company — internal tools, unicorn", confidence: "high" },
  ],
  "anduril": [
    { investorId: "liquid2", details: "Portfolio company — defense tech, unicorn", confidence: "high" },
    { investorId: "svangel", details: "Portfolio company — defense tech, unicorn", confidence: "high" },
  ],
  "applied intuition": [
    { investorId: "liquid2", details: "Portfolio company — autonomous vehicles, unicorn", confidence: "high" },
  ],
  "remote": [
    { investorId: "liquid2", details: "Portfolio company — global HR, unicorn", confidence: "high" },
    { investorId: "aaron-levie", details: "Angel investment — global HR, unicorn", confidence: "high" },
  ],
  "solugen": [
    { investorId: "liquid2", details: "Portfolio company — biotech/chemicals, unicorn", confidence: "high" },
  ],
  "astranis": [
    { investorId: "liquid2", details: "Portfolio company — satellite internet, unicorn", confidence: "high" },
  ],
  "stoke space": [
    { investorId: "liquid2", details: "Portfolio company — reusable rockets", confidence: "high" },
  ],
  "fanduel": [
    { investorId: "liquid2", details: "Portfolio company — sports betting, unicorn", confidence: "high" },
  ],
  "rappi": [
    { investorId: "liquid2", details: "Portfolio company — LatAm delivery, unicorn", confidence: "high" },
  ],
  "whatnot": [
    { investorId: "liquid2", details: "Portfolio company — live shopping, unicorn", confidence: "high" },
  ],
  "modern treasury": [
    { investorId: "liquid2", details: "Portfolio company — payment operations", confidence: "high" },
  ],
  "athelas": [
    { investorId: "liquid2", details: "Portfolio company — healthcare/diagnostics", confidence: "high" },
  ],
  "chipper cash": [
    { investorId: "liquid2", details: "Portfolio company — Africa fintech, unicorn", confidence: "high" },
  ],
  "mercury": [
    { investorId: "liquid2", details: "Portfolio company — startup banking", confidence: "high" },
    { investorId: "svangel", details: "Portfolio company — startup banking", confidence: "high" },
  ],
  "rupa health": [
    { investorId: "liquid2", details: "Portfolio company — lab testing platform", confidence: "medium" },
  ],

  // ── Time Ventures / Marc Benioff (48 fund + 209 angel investments) ──
  // Source: Crunchbase, CB Insights, Inc.com, Hustle Fund
  "commonwealth fusion systems": [
    { investorId: "time-ventures", details: "Portfolio company — fusion energy", confidence: "high" },
  ],
  "universal hydrogen": [
    { investorId: "time-ventures", details: "Portfolio company — hydrogen aviation", confidence: "high" },
  ],
  "ncx": [
    { investorId: "time-ventures", details: "Portfolio company — forestry/climate tech", confidence: "high" },
  ],
  "webai": [
    { investorId: "time-ventures", details: "Investment Jan 2026 — AI/Business Software", confidence: "high" },
  ],
  "laurel": [
    { investorId: "time-ventures", details: "Portfolio company — productivity software", confidence: "high" },
  ],
  "warp": [
    { investorId: "time-ventures", details: "Portfolio company — developer terminal", confidence: "high" },
  ],
  "you.com": [
    { investorId: "time-ventures", details: "Portfolio company — AI search engine", confidence: "high" },
  ],
  "telo trucks": [
    { investorId: "time-ventures", details: "Portfolio company — electric vehicles", confidence: "high" },
  ],
  "thrive global": [
    { investorId: "time-ventures", details: "Portfolio company — workplace wellness", confidence: "high" },
  ],
  "duetto": [
    { investorId: "time-ventures", details: "Portfolio company — hospitality revenue tech", confidence: "high" },
  ],
  "gigster": [
    { investorId: "time-ventures", details: "Portfolio company — AI/software development", confidence: "medium" },
  ],
  "vicarious": [
    { investorId: "time-ventures", details: "Portfolio company — AI/robotics", confidence: "medium" },
  ],
  "rainforest qa": [
    { investorId: "time-ventures", details: "Portfolio company — QA-as-a-Service", confidence: "medium" },
  ],
  "artera": [
    { investorId: "time-ventures", details: "Portfolio company — healthcare", confidence: "medium" },
  ],
  "vital bio": [
    { investorId: "time-ventures", details: "Portfolio company — biotech/health tech", confidence: "medium" },
  ],

  // ── Abstract Ventures (192 companies, 5 unicorns, 2 IPOs) ──
  // Source: abstractvc.com, Tracxn, Crunchbase
  "wise": [
    { investorId: "abstract", details: "Portfolio company — fintech, unicorn/IPO", confidence: "high" },
  ],
  "avalanche": [
    { investorId: "abstract", details: "Portfolio company — blockchain/smart contracts", confidence: "high" },
  ],
  "avantstay": [
    { investorId: "abstract", details: "Portfolio company — hospitality/short-term rentals", confidence: "high" },
  ],
  "bestow": [
    { investorId: "abstract", details: "Portfolio company — life insurance tech", confidence: "high" },
  ],
  "compound": [
    { investorId: "abstract", details: "Portfolio company — DeFi protocol", confidence: "high" },
  ],
  "crusoe": [
    { investorId: "abstract", details: "Portfolio company — AI cloud platform", confidence: "high" },
  ],
  "crossmint": [
    { investorId: "abstract", details: "Portfolio company — onchain platform", confidence: "high" },
  ],
  "polymarket": [
    { investorId: "abstract", details: "Portfolio company — prediction market", confidence: "high" },
  ],
  "recraft": [
    { investorId: "abstract", details: "Portfolio company — AI image generation", confidence: "high" },
  ],
  "optimism": [
    { investorId: "abstract", details: "Portfolio company — Ethereum L2", confidence: "high" },
  ],
  "proton": [
    { investorId: "abstract", details: "Portfolio company — AI-powered CRM for distributors", confidence: "medium" },
  ],
  "aaru": [
    { investorId: "abstract", details: "Series A ($1B valuation) — AI synthetic research", confidence: "high" },
    { investorId: "astar", details: "Series A ($1B valuation) — AI synthetic research", confidence: "high" },
  ],
  "truffle security": [
    { investorId: "abstract", details: "Series B $25M — AI-era identity security", confidence: "high" },
    { investorId: "sunflower", details: "Portfolio company — security", confidence: "high" },
  ],

  // ── A* / AStar (Kevin Hartz — 35+ companies in Fund I) ──
  // Source: TechCrunch, Tracxn, Crunchbase
  "ramp": [
    { investorId: "astar", details: "Fund I — fintech unicorn", confidence: "high" },
  ],
  "notion": [
    { investorId: "astar", details: "Fund I — productivity/workflow, unicorn", confidence: "high" },
    { investorId: "svangel", details: "Portfolio company — productivity, unicorn", confidence: "high" },
  ],
  "faire": [
    { investorId: "astar", details: "Fund I — wholesale marketplace, unicorn", confidence: "high" },
  ],
  "paraform": [
    { investorId: "astar", details: "Seed — recruiting marketplace", confidence: "high" },
  ],
  "aligned marketplace": [
    { investorId: "astar", details: "Seed — primary care startup", confidence: "medium" },
  ],
  "assort health": [
    { investorId: "astar", details: "Series B $76M — healthcare AI", confidence: "high" },
  ],
  "tavrn": [
    { investorId: "astar", details: "Series A $15M — legal AI workflows", confidence: "high" },
  ],

  // ── Vesey Ventures (14-27 companies — fintech/commerce focus) ──
  // Source: vesey.vc, Tracxn, Crunchbase
  "coast": [
    { investorId: "vesey", details: "Portfolio company — B2B fleet payments, $92M raised", confidence: "high" },
  ],
  "pointfive": [
    { investorId: "vesey", details: "Series A — cloud cost optimization (w/ Salesforce Ventures)", confidence: "high" },
  ],
  "grain": [
    { investorId: "vesey", details: "Portfolio company — fintech infrastructure", confidence: "high" },
  ],
  "proper": [
    { investorId: "vesey", details: "Portfolio company — B2B fintech/vertical software", confidence: "medium" },
  ],
  "nilus": [
    { investorId: "vesey", details: "Portfolio company — $10M funding round", confidence: "high" },
  ],
  "dualentry": [
    { investorId: "vesey", details: "Series A Oct 2025 — accounting", confidence: "high" },
  ],
  "stuut": [
    { investorId: "vesey", details: "Series A $29.5M — fintech", confidence: "high" },
  ],
  "finaloop": [
    { investorId: "vesey", details: "Series A $35M — e-commerce accounting", confidence: "high" },
  ],
  "advance": [
    { investorId: "vesey", details: "Seed $8.55M — insurance payments fintech", confidence: "medium" },
  ],
  "tonic security": [
    { investorId: "vesey", details: "Seed $7M — security", confidence: "medium" },
  ],

  // ── SV Angel / Ron Conway (300+ companies) ──
  // Source: svangel.com, Crunchbase, Wikipedia, CB Insights
  "openai": [
    { investorId: "svangel", details: "Portfolio company — AI research", confidence: "high" },
  ],
  "stripe": [
    { investorId: "svangel", details: "Portfolio company — payments, unicorn", confidence: "high" },
    { investorId: "aaron-levie", details: "Angel investment — payments, unicorn", confidence: "high" },
  ],
  "coinbase": [
    { investorId: "svangel", details: "Portfolio company — crypto exchange, IPO", confidence: "high" },
  ],
  "hugging face": [
    { investorId: "svangel", details: "Portfolio company — AI/ML platform", confidence: "high" },
  ],
  "together ai": [
    { investorId: "svangel", details: "Portfolio company — AI infrastructure", confidence: "high" },
  ],
  "reddit": [
    { investorId: "svangel", details: "Portfolio company; IPO 2024 — exit", confidence: "high" },
  ],
  "world labs": [
    { investorId: "svangel", details: "Series A 2024 — AI/spatial intelligence", confidence: "high" },
  ],

  // ── Valkyrie Ventures / Beth Turner (20+ companies, Fund I $45M) ──
  // Source: valkyrie.vc, LinkedIn, CB Insights
  "icarus": [
    { investorId: "valkyrie", details: "Fund I — autonomous drone startup", confidence: "high" },
  ],
  "acronym": [
    { investorId: "valkyrie", details: "Fund I — sales software", confidence: "high" },
  ],
  "periodic labs": [
    { investorId: "valkyrie", details: "Fund I — AI scientist platform", confidence: "high" },
  ],
  "flock safety": [
    { investorId: "valkyrie", details: "Prior investment (SV Angel era) — public safety tech", confidence: "high" },
  ],
  "elevenlabs": [
    { investorId: "valkyrie", details: "Prior investment (SV Angel era) — AI voice", confidence: "high" },
  ],
  "cascade space": [
    { investorId: "valkyrie", details: "Seed Jul 2025 — aerospace & defense", confidence: "high" },
  ],

  // ── Sunflower VC / Liu Jiang (72+ companies — B2B seed) ──
  // Source: sunflowercapital.co, Tracxn, PitchBook
  "e2b": [
    { investorId: "sunflower", details: "Series A $21M — open-source AI agent cloud", confidence: "high" },
  ],
  "tollbit": [
    { investorId: "sunflower", details: "Seed $7M (led) — AI content economics", confidence: "high" },
    { investorId: "operator-collective", details: "Portfolio company — AI content economics", confidence: "medium" },
  ],
  "letta": [
    { investorId: "sunflower", details: "Portfolio company — AI", confidence: "high" },
  ],
  "voidzero": [
    { investorId: "sunflower", details: "Series A Oct 2025 — developer tools", confidence: "high" },
  ],
  "karman industries": [
    { investorId: "sunflower", details: "Investment Jan 2026 — alternative energy", confidence: "high" },
  ],
  "serval": [
    { investorId: "sunflower", details: "Notable portfolio company", confidence: "high" },
  ],

  // ── Operator Collective (99 investments, 5 unicorns) ──
  // Source: operatorcollective.com, Crunchbase, TechCrunch
  "ironclad": [
    { investorId: "operator-collective", details: "Portfolio company — contract lifecycle, unicorn", confidence: "high" },
  ],
  "agentsync": [
    { investorId: "operator-collective", details: "Portfolio company — insurance licensing, unicorn", confidence: "high" },
  ],
  "guild education": [
    { investorId: "operator-collective", details: "Portfolio company — workforce re-skilling", confidence: "high" },
  ],
  "datagrail": [
    { investorId: "operator-collective", details: "Portfolio company — data privacy", confidence: "high" },
  ],
  "demostack": [
    { investorId: "operator-collective", details: "Series B $34M — SaaS demo platform", confidence: "high" },
  ],
  "spekit": [
    { investorId: "operator-collective", details: "Series B $45M — digital enablement", confidence: "high" },
  ],
  "textio": [
    { investorId: "operator-collective", details: "Portfolio company — business communications", confidence: "high" },
  ],
  "forethought ai": [
    { investorId: "operator-collective", details: "Portfolio company — AI customer service", confidence: "high" },
  ],
  "hightouch": [
    { investorId: "operator-collective", details: "Portfolio company — data activation", confidence: "high" },
  ],
  "hex": [
    { investorId: "operator-collective", details: "Portfolio company — data collaboration", confidence: "high" },
  ],
  "faros ai": [
    { investorId: "operator-collective", details: "Series A $20M — engineering intelligence", confidence: "high" },
  ],
  "distributional": [
    { investorId: "operator-collective", details: "Series A $19M — AI safety (w/ a16z)", confidence: "high" },
  ],
  "viven": [
    { investorId: "operator-collective", details: "Seed $35M — AI (w/ Khosla)", confidence: "high" },
  ],

  // ── G20 Ventures (64 investments — East Coast enterprise) ──
  // Source: g20vc.com, Tracxn, CB Insights
  "hometap": [
    { investorId: "g20", details: "Portfolio company — home equity investments", confidence: "high" },
  ],
  "cloudzero": [
    { investorId: "g20", details: "Series C $56M — cloud cost intelligence", confidence: "high" },
  ],
  "ripplematch": [
    { investorId: "g20", details: "Portfolio company — campus recruiting (board seat)", confidence: "high" },
  ],
  "siemplify": [
    { investorId: "g20", details: "Portfolio company; acquired by Google — SOAR platform", confidence: "high" },
  ],
  "128 technology": [
    { investorId: "g20", details: "Portfolio company; acquired by Juniper — networking", confidence: "high" },
  ],
  "fuze": [
    { investorId: "g20", details: "Portfolio company; acquired — cloud communications", confidence: "high" },
  ],
  "brandlight": [
    { investorId: "g20", details: "Portfolio company — AI search visibility", confidence: "medium" },
  ],
  "frame ai": [
    { investorId: "g20", details: "Portfolio company; exit Dec 2024 — AI data analytics", confidence: "high" },
  ],
  "via scientific": [
    { investorId: "g20", details: "Seed $5M (led) — scientific AI", confidence: "high" },
  ],
  "bonobo ai": [
    { investorId: "g20", details: "Portfolio company; acquired by Salesforce", confidence: "high" },
  ],
  "evergage": [
    { investorId: "g20", details: "Portfolio company — personalization", confidence: "medium" },
  ],

  // ── George Kurtz / CrowdStrike (12 investments, 2 unicorns) ──
  // Source: CB Insights, Tracxn, Wikipedia
  "grip security": [
    { investorId: "george-kurtz", details: "Angel investment — SaaS security platform", confidence: "high" },
  ],
  "doppel": [
    { investorId: "george-kurtz", details: "Angel investment — AI cybersecurity", confidence: "high" },
  ],
  "1password": [
    { investorId: "george-kurtz", details: "Angel investment — identity/password mgmt, unicorn", confidence: "high" },
  ],
  "tailscale": [
    { investorId: "george-kurtz", details: "Series C Apr 2025 — mesh VPN, unicorn", confidence: "high" },
  ],
  "lovable": [
    { investorId: "george-kurtz", details: "Angel investment — AI-assisted software dev", confidence: "high" },
  ],
  "viso trust": [
    { investorId: "george-kurtz", details: "Angel investment — third-party risk management", confidence: "medium" },
  ],
  "vanta": [
    { investorId: "george-kurtz", details: "CrowdStrike venture arm invested; Series D $150M ($4.15B valuation)", confidence: "high" },
  ],

  // ── Aaron Levie / Box (65 investments, 8 unicorns, 23 exits) ──
  // Source: CB Insights, Tracxn, Hustle Fund, Signal
  "robinhood": [
    { investorId: "aaron-levie", details: "Angel investment — trading platform, unicorn/IPO", confidence: "high" },
  ],
  "zenefits": [
    { investorId: "aaron-levie", details: "Angel investment — HR platform", confidence: "high" },
  ],
  "opendoor": [
    { investorId: "aaron-levie", details: "Angel investment — real estate tech, unicorn", confidence: "high" },
  ],
  "nova labs": [
    { investorId: "aaron-levie", details: "Board seat — telecom/Helium network", confidence: "high" },
  ],
  "method security": [
    { investorId: "aaron-levie", details: "Series A Nov 2025 — cybersecurity", confidence: "high" },
  ],

  // ── Diane Greene / VMware (8+ investments, 2 unicorns) ──
  // Source: Tracxn, Wikipedia, Berkeley Engineering
  "cloudera": [
    { investorId: "diane-greene", details: "Angel investment — big data/Hadoop", confidence: "high" },
  ],
  "nicira": [
    { investorId: "diane-greene", details: "Angel investment; acquired by VMware — SDN networking", confidence: "high" },
  ],
  "pilot": [
    { investorId: "diane-greene", details: "Angel investment — bookkeeping, unicorn", confidence: "high" },
  ],
  "meter": [
    { investorId: "diane-greene", details: "Angel investment — networking, unicorn", confidence: "high" },
  ],
  "korl": [
    { investorId: "diane-greene", details: "Seed May 2025 — enterprise software", confidence: "high" },
  ],
  "unity": [
    { investorId: "diane-greene", details: "Angel investment; IPO exit — game engine", confidence: "high" },
  ],

  // ── Alex Dayon / Salesforce (limited public data) ──
  // Source: GlobeNewsWire, LinkedIn, Valeo
  "dataiku": [
    { investorId: "alex-dayon", details: "Board member (Oct 2025) — enterprise AI ($350M ARR)", confidence: "high" },
  ],

  // ── David Schmaier / Salesforce (limited public data) ──
  // Source: PitchBook, Crunchbase
  "punchh": [
    { investorId: "david-schmaier", details: "Board seat — loyalty/CRM platform", confidence: "high" },
  ],
};

// ── Lookup Function ─────────────────────────────────────────────────

/**
 * Returns investor relationships for a given company, filtered to only
 * include the user's tracked investors.
 */
export function getRelationshipsForCompany(
  companyName: string,
  trackedIds: Set<string>,
): InvestorRelationship[] {
  const key = companyName.toLowerCase().trim();
  const entries = COMPANY_FUNDING_MAP[key];
  if (!entries) return [];

  const investorMap = new Map(INVESTOR_CATALOG.map((inv) => [inv.id, inv]));

  return entries
    .filter((entry) => trackedIds.has(entry.investorId))
    .map((entry) => {
      const investor = investorMap.get(entry.investorId)!;
      return {
        investorId: entry.investorId,
        investorName: investor.name,
        type: "funding" as const,
        details: entry.details,
        confidence: entry.confidence,
      };
    });
}

/**
 * Returns the count of leads (by company name) that have at least one
 * funding relationship with a given investor.
 */
export function countLeadsForInvestor(
  investorId: string,
  companyNames: string[],
): number {
  let count = 0;
  for (const name of companyNames) {
    const key = name.toLowerCase().trim();
    const entries = COMPANY_FUNDING_MAP[key];
    if (entries?.some((e) => e.investorId === investorId)) {
      count++;
    }
  }
  return count;
}
