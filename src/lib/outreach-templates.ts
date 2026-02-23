import type { Lead } from "./types";

export interface OutreachTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[]; // trigger-event keywords that activate this template
  generate: (lead: Lead, contactName: string) => string;
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

export const OUTREACH_TEMPLATES: OutreachTemplate[] = [
  {
    id: "greenfield",
    name: "Greenfield CRM",
    description: "Company hiring first SF admin, no existing CRM",
    keywords: [
      "first",
      "greenfield",
      "from scratch",
      "initial setup",
      "sole contributor",
      "standing up",
      "net new",
      "founding",
      "build out",
    ],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I noticed ${lead.company.name} is hiring its first Salesforce admin — that's an exciting milestone for the team! I've helped several ${lead.company.industry.toLowerCase()} companies at a similar stage set up their Salesforce instance from scratch.

Would love to connect and share some learnings. Open to a quick chat?`,
  },
  {
    id: "migration",
    name: "Migration",
    description: "Company transitioning from HubSpot/spreadsheets",
    keywords: [
      "migrating",
      "migration",
      "transition",
      "moving from",
      "hubspot",
      "spreadsheet",
      "replacing",
      "switching",
    ],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I saw ${lead.company.name} is making the move to Salesforce — smart timing. Migrations can be tricky, especially getting data clean and workflows right from day one. I've guided a few ${lead.company.industry.toLowerCase()} teams through this exact transition.

Happy to share what worked (and what to avoid). Would you be open to connecting?`,
  },
  {
    id: "growth",
    name: "Growth Stage",
    description: "Scaling company adding SF team members",
    keywords: [
      "scaling",
      "growing",
      "expanding",
      "additional",
      "team",
      "series",
      "funded",
      "revenue operations",
    ],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

Congrats on the growth at ${lead.company.name}! I noticed you're building out the Salesforce team — always a sign of good things happening. I've worked with several fast-growing ${lead.company.industry.toLowerCase()} companies on scaling their SF operations.

Would love to connect and trade notes. Open to a brief chat?`,
  },
  {
    id: "general",
    name: "General",
    description: "Fallback for any lead",
    keywords: [],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I came across ${lead.company.name}'s Salesforce role and thought I'd reach out. I work with ${lead.company.industry.toLowerCase()} companies on their CRM strategy and have seen firsthand what makes a Salesforce rollout successful.

Would you be open to a quick conversation? Always happy to share what I've learned.`,
  },
];

/**
 * Pick the best template based on the lead's trigger event and signal descriptions.
 */
export function selectBestTemplate(lead: Lead): OutreachTemplate {
  const text = [
    lead.triggerEvent,
    ...lead.signals.map((s) => s.description),
    ...lead.signals.map((s) => s.title),
  ]
    .join(" ")
    .toLowerCase();

  for (const template of OUTREACH_TEMPLATES) {
    if (template.keywords.length === 0) continue;
    const matches = template.keywords.filter((kw) => text.includes(kw));
    if (matches.length >= 1) return template;
  }

  // Fallback to general
  return OUTREACH_TEMPLATES[OUTREACH_TEMPLATES.length - 1];
}

/**
 * Get the contact name to use in the message.
 */
export function getOutreachContactName(lead: Lead): string {
  if (lead.hiringManager?.name) return lead.hiringManager.name;
  if (lead.contacts.length > 0) return lead.contacts[0].name;
  return "there";
}
