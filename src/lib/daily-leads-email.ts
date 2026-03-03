import { Lead } from "./types";

/**
 * Filter leads detected within the last 24 hours.
 */
export function filterLast24Hours(leads: Lead[]): Lead[] {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return leads.filter((l) => l.firstDetected >= cutoff);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score: number): string {
  if (score >= 80) return "background: #d1fae5; color: #065f46;";
  if (score >= 60) return "background: #dbeafe; color: #1e40af;";
  return "background: #fef3c7; color: #92400e;";
}

function confidenceBadge(confidence: "high" | "medium" | "low"): string {
  const colors: Record<string, string> = {
    high: "background: #d1fae5; color: #065f46;",
    medium: "background: #fef3c7; color: #92400e;",
    low: "background: #fee2e2; color: #991b1b;",
  };
  return `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; ${colors[confidence]}">${confidence}</span>`;
}

function buildLeadCard(lead: Lead): string {
  const company = lead.company;

  // — Company header ——————————————————————————————————————————————————
  const companyWebsite = company.website
    ? `<a href="${escapeHtml(company.website)}" style="color: #2563eb; text-decoration: none; font-size: 12px;">Website</a>`
    : "";
  const companyLinkedin = company.linkedinUrl
    ? `<a href="${escapeHtml(company.linkedinUrl)}" style="color: #2563eb; text-decoration: none; font-size: 12px;">LinkedIn</a>`
    : "";
  const companyLinks = [companyWebsite, companyLinkedin].filter(Boolean).join(" &middot; ");

  const locationParts = [company.city, company.state, company.country].filter(Boolean);
  const location = locationParts.join(", ");

  // — Signals ————————————————————————————————————————————————————————
  const signalRows = lead.signals
    .map(
      (s) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; background: #ede9fe; color: #5b21b6;">${escapeHtml(s.category)}</span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
          <div style="font-size: 12px; font-weight: 600; color: #374151;">${s.url ? `<a href="${escapeHtml(s.url)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(s.title)}</a>` : escapeHtml(s.title)}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${escapeHtml(s.description)}</div>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
          <span style="font-size: 11px; color: #6b7280;">${escapeHtml(s.source)}</span>
        </td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
          <span style="font-size: 11px; font-weight: 600; color: #374151;">+${s.weight}</span>
        </td>
      </tr>`
    )
    .join("");

  // — Hiring Manager —————————————————————————————————————————————————
  let hiringManagerHtml = "";
  if (lead.hiringManager) {
    const hm = lead.hiringManager;
    const hmName = hm.name
      ? hm.linkedinUrl
        ? `<a href="${escapeHtml(hm.linkedinUrl)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(hm.name)}</a>`
        : escapeHtml(hm.name)
      : "Unknown";
    hiringManagerHtml = `
      <div style="margin-top: 12px; padding: 10px 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;">
        <div style="font-size: 11px; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Hiring Manager</div>
        <div style="font-size: 13px; color: #374151;">
          <strong>${hmName}</strong> — ${escapeHtml(hm.title)}
          &nbsp;${confidenceBadge(hm.confidence)}
          <span style="font-size: 11px; color: #9ca3af; margin-left: 4px;">(via ${escapeHtml(hm.source)})</span>
        </div>
      </div>`;
  }

  // — Contacts ———————————————————————————————————————————————————————
  let contactsHtml = "";
  if (lead.contacts.length > 0) {
    const contactRows = lead.contacts
      .map((c) => {
        const name = c.linkedinUrl
          ? `<a href="${escapeHtml(c.linkedinUrl)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(c.name)}</a>`
          : escapeHtml(c.name);
        const email = c.email
          ? `<a href="mailto:${escapeHtml(c.email)}" style="color: #2563eb; text-decoration: none; font-size: 12px;">${escapeHtml(c.email)}</a>`
          : `<span style="color: #9ca3af; font-size: 12px;">—</span>`;
        const conf = c.confidence ? ` ${confidenceBadge(c.confidence)}` : "";
        return `
        <tr>
          <td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #374151;">${name}</td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; color: #6b7280;">${escapeHtml(c.title)}</td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px;">${email}</td>
          <td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 12px; text-align: center;">${conf}</td>
        </tr>`;
      })
      .join("");

    contactsHtml = `
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Contacts</div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 4px 8px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Name</th>
              <th style="padding: 4px 8px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Title</th>
              <th style="padding: 4px 8px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Email</th>
              <th style="padding: 4px 8px; text-align: center; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Conf.</th>
            </tr>
          </thead>
          <tbody>${contactRows}</tbody>
        </table>
      </div>`;
  }

  // — Investor Relationships —————————————————————————————————————————
  let investorHtml = "";
  if (lead.investorRelationships && lead.investorRelationships.length > 0) {
    const investorRows = lead.investorRelationships
      .map(
        (ir) => `
        <div style="display: flex; align-items: center; padding: 4px 0; font-size: 12px;">
          <span style="font-weight: 600; color: #374151; min-width: 140px;">${escapeHtml(ir.investorName)}</span>
          <span style="color: #6b7280; margin: 0 8px;">${escapeHtml(ir.details)}</span>
          ${confidenceBadge(ir.confidence)}
        </div>`
      )
      .join("");

    investorHtml = `
      <div style="margin-top: 12px; padding: 10px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
        <div style="font-size: 11px; font-weight: 600; color: #1e40af; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Investor Connections</div>
        ${investorRows}
      </div>`;
  }

  // — Assembled card —————————————————————————————————————————————————
  return `
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <!-- Company Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #111827;">${escapeHtml(company.name)}</h3>
          <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
            ${escapeHtml(company.industry)}${company.employeeCount > 0 ? ` &middot; ${company.employeeCount.toLocaleString()} employees` : ""}${location ? ` &middot; ${escapeHtml(location)}` : ""}
          </div>
          ${companyLinks ? `<div style="margin-top: 4px;">${companyLinks}</div>` : ""}
        </div>
        <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; font-size: 14px; font-weight: 700; ${scoreColor(lead.score)}">${lead.score}/100</span>
      </div>

      <!-- Trigger Event -->
      <div style="padding: 10px 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Trigger Event</div>
        <div style="font-size: 13px; color: #374151;">${escapeHtml(lead.triggerEvent)}</div>
      </div>

      <!-- Signals Table -->
      <div style="margin-bottom: 4px;">
        <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">Signals</div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 4px 8px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Type</th>
              <th style="padding: 4px 8px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Signal</th>
              <th style="padding: 4px 8px; text-align: center; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Source</th>
              <th style="padding: 4px 8px; text-align: center; font-size: 10px; font-weight: 600; color: #9ca3af; text-transform: uppercase;">Weight</th>
            </tr>
          </thead>
          <tbody>${signalRows}</tbody>
        </table>
      </div>

      ${hiringManagerHtml}
      ${contactsHtml}
      ${investorHtml}

      <!-- Meta -->
      <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #9ca3af;">
        First detected: ${new Date(lead.firstDetected).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
        &middot; Status: <strong>${lead.status}</strong>
      </div>
    </div>`;
}

/**
 * Generate a comprehensive daily leads digest email for all leads
 * detected in the past 24 hours, including full detail cards for every lead.
 */
export function generateDailyLeadsEmail(allLeads: Lead[], date: Date): string {
  const newLeads = filterLast24Hours(allLeads).sort((a, b) => b.score - a.score);

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hotLeads = newLeads.filter((l) => l.score >= 60);
  const warmLeads = newLeads.filter((l) => l.score >= 40 && l.score < 60);
  const coldLeads = newLeads.filter((l) => l.score < 40);
  const avgScore = newLeads.length
    ? Math.round(newLeads.reduce((s, l) => s + l.score, 0) / newLeads.length)
    : 0;

  // Quick-glance summary table
  const summaryRows = newLeads
    .map(
      (lead) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 600; color: #111827; font-size: 13px;">${escapeHtml(lead.company.name)}</div>
        <div style="color: #6b7280; font-size: 11px;">${escapeHtml(lead.company.industry)}${lead.company.city ? ` &middot; ${escapeHtml(lead.company.city)}, ${escapeHtml(lead.company.state)}` : ""}</div>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; ${scoreColor(lead.score)}">${lead.score}</span>
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #374151; max-width: 280px;">${escapeHtml(lead.triggerEvent)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #6b7280;">${lead.contacts.length > 0 ? `${lead.contacts.length} contact${lead.contacts.length > 1 ? "s" : ""}` : "—"}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 12px; color: #6b7280;">${lead.hiringManager ? "Yes" : "—"}</td>
    </tr>`
    )
    .join("");

  // Full detail cards for every lead
  const leadCards = newLeads.map(buildLeadCard).join("");

  // No-leads fallback
  if (newLeads.length === 0) {
    return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 800px; margin: 0 auto; padding: 24px;">
    <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); border-radius: 12px; padding: 24px; margin-bottom: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Salesforce First-Admin Radar</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Daily Leads Digest — ${formattedDate}</p>
    </div>
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; text-align: center;">
      <div style="font-size: 40px; margin-bottom: 12px;">&#128269;</div>
      <h2 style="margin: 0 0 8px; font-size: 18px; color: #374151;">No New Leads Today</h2>
      <p style="margin: 0; font-size: 14px; color: #6b7280;">No new Salesforce admin leads were detected in the past 24 hours. Check back tomorrow!</p>
    </div>
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
      <p>Salesforce First-Admin Radar &middot; Daily Digest</p>
    </div>
  </div>
</body>
</html>`.trim();
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 800px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #2563eb, #4f46e5); border-radius: 12px; padding: 24px; margin-bottom: 24px; color: white;">
      <h1 style="margin: 0; font-size: 20px; font-weight: 700;">Salesforce First-Admin Radar</h1>
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Daily Leads Digest — ${formattedDate}</p>
    </div>

    <!-- Summary Stats -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">New Leads</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px;">${newLeads.length}</div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 11px; color: #065f46; text-transform: uppercase; letter-spacing: 0.05em;">Hot (60+)</div>
        <div style="font-size: 28px; font-weight: 700; color: #065f46; margin-top: 4px;">${hotLeads.length}</div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 11px; color: #92400e; text-transform: uppercase; letter-spacing: 0.05em;">Warm (40-59)</div>
        <div style="font-size: 28px; font-weight: 700; color: #92400e; margin-top: 4px;">${warmLeads.length}</div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Avg Score</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px;">${avgScore}</div>
      </div>
    </div>

    <!-- Quick-Glance Summary Table -->
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
      <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">At a Glance — ${newLeads.length} New Lead${newLeads.length !== 1 ? "s" : ""}</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 6px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Company</th>
            <th style="padding: 6px 12px; text-align: center; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Score</th>
            <th style="padding: 6px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Trigger</th>
            <th style="padding: 6px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Contacts</th>
            <th style="padding: 6px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #6b7280; text-transform: uppercase;">Hiring Mgr</th>
          </tr>
        </thead>
        <tbody>
          ${summaryRows}
        </tbody>
      </table>
    </div>

    <!-- Section: Hot Leads (60+) -->
    ${hotLeads.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 700; color: #065f46; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #d1fae5;">&#128293; Hot Leads (Score 60+)</h2>
      ${hotLeads.map(buildLeadCard).join("")}
    </div>` : ""}

    <!-- Section: Warm Leads (40-59) -->
    ${warmLeads.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 700; color: #92400e; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #fde68a;">&#9888;&#65039; Warm Leads (Score 40–59)</h2>
      ${warmLeads.map(buildLeadCard).join("")}
    </div>` : ""}

    <!-- Section: Cold Leads (<40) -->
    ${coldLeads.length > 0 ? `
    <div style="margin-bottom: 8px;">
      <h2 style="font-size: 16px; font-weight: 700; color: #6b7280; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb;">&#10052;&#65039; Other Leads (Score &lt;40)</h2>
      ${coldLeads.map(buildLeadCard).join("")}
    </div>` : ""}

    <!-- Footer -->
    <div style="text-align: center; padding: 24px 16px; color: #9ca3af; font-size: 11px;">
      <p style="margin: 0 0 4px;">Salesforce First-Admin Radar &middot; Daily Leads Digest</p>
      <p style="margin: 0;">View the full dashboard for filtering, pipeline tracking, and outreach tools.</p>
    </div>
  </div>
</body>
</html>`.trim();
}
