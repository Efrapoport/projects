import type { SIDependentLead } from "./types";

export interface SIOutreachTemplate {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  generate: (lead: SIDependentLead, contactName: string) => string;
}

function getFirstName(fullName: string): string {
  return fullName.split(" ")[0] || fullName;
}

export const SI_OUTREACH_TEMPLATES: SIOutreachTemplate[] = [
  {
    id: "cost_savings",
    name: "Cost Savings",
    description: "Pitch reducing SI dependency costs by hiring in-house",
    keywords: ["consultant", "consultancy", "contractor", "hourly", "retainer"],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I noticed ${lead.company.name} has been working with ${lead.knownSIPartners.length > 0 ? lead.knownSIPartners[0] : "outside consultants"} for Salesforce — totally normal at your stage. But I've seen companies like yours paying $150-250/hr for routine admin work that a dedicated hire handles for a fraction of the cost.

A full-time Salesforce admin typically pays for itself within 3-4 months when you factor in the hourly consulting fees you'd save. Plus you get someone who actually knows your business inside and out.

Would you be open to a quick chat about what that transition could look like for ${lead.company.name}?`,
  },
  {
    id: "control_speed",
    name: "Control & Speed",
    description: "Pitch faster iteration with in-house team",
    keywords: ["managed services", "outsourced", "third-party", "external"],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I came across ${lead.company.name} and noticed your Salesforce operations are handled externally. One pattern I've seen a lot: changes that should take hours end up taking days because they're sitting in a consultant's queue.

When you have someone in-house, your sales team gets a broken report fixed before lunch instead of next Tuesday. That speed compounds — especially in ${lead.company.industry.toLowerCase()}.

Would it be useful to chat about how other companies your size have made that shift? Happy to share what I've learned.`,
  },
  {
    id: "dependency_risk",
    name: "Consultant Dependency Risk",
    description: "Pitch reducing single-point-of-failure risk",
    keywords: ["freelance", "independent", "solo", "contract", "temp"],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

I noticed ${lead.company.name} relies on ${lead.knownSIPartners.length > 0 ? lead.knownSIPartners[0] : "external contractors"} for Salesforce work. Quick question — what happens if your consultant takes another client or moves on?

I've seen companies in that spot where their entire SF instance becomes a black box because the only person who understood it walked away. No documentation, no institutional knowledge, no one who can respond to an urgent issue on a Sunday night.

Building even a small amount of in-house capability is the best insurance policy. Would love to share how other ${lead.company.industry.toLowerCase()} companies have handled this. Open to a quick chat?`,
  },
  {
    id: "outgrowing_si",
    name: "Outgrowing Your SI",
    description: "Pitch transitioning from small SI to in-house team",
    keywords: ["si partner", "implementation", "partner", "agency", "staffing"],
    generate: (lead, contactName) =>
      `Hi ${getFirstName(contactName)},

Small SIs are great for getting Salesforce up and running — but at ${lead.company.name}'s stage${lead.company.employeeCount > 0 ? ` (${lead.company.employeeCount.toLocaleString()} employees)` : ""}, you probably need someone who lives in your business, not just visits it.

An in-house Salesforce person understands your sales process, knows the team by name, and can iterate on workflows in real time. That's hard to get from a consultant who's splitting time across 5 clients.

Would it be helpful to walk through what that hire looks like and how to make the transition smooth? Happy to connect.`,
  },
];

export function selectBestSITemplate(lead: SIDependentLead): SIOutreachTemplate {
  const text = lead.signals
    .map((s) => `${s.title} ${s.description}`)
    .join(" ")
    .toLowerCase();

  for (const template of SI_OUTREACH_TEMPLATES) {
    if (template.keywords.length === 0) continue;
    const matches = template.keywords.filter((kw) => text.includes(kw));
    if (matches.length >= 1) return template;
  }

  return SI_OUTREACH_TEMPLATES[SI_OUTREACH_TEMPLATES.length - 1];
}

export function getSIOutreachContactName(lead: SIDependentLead): string {
  if (lead.hiringManager?.name) return lead.hiringManager.name;
  if (lead.contacts.length > 0) return lead.contacts[0].name;
  return "there";
}
