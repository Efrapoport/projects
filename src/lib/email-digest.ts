import { Lead } from "./types";

/**
 * Generate an HTML email digest of the top leads.
 */
export function generateDigestHtml(leads: Lead[], date: Date): string {
  const topLeads = leads
    .filter((l) => l.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const leadRows = topLeads
    .map(
      (lead) => `
    <tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-weight: 600; color: #111827; font-size: 14px;">${lead.company.name}</div>
        <div style="color: #6b7280; font-size: 12px; margin-top: 2px;">
          ${lead.company.industry} &middot; ${lead.company.employeeCount} employees &middot; ${lead.company.city}, ${lead.company.state}
        </div>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        <span style="
          display: inline-block;
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          ${lead.score >= 80 ? "background: #d1fae5; color: #065f46;" : lead.score >= 60 ? "background: #dbeafe; color: #1e40af;" : "background: #fef3c7; color: #92400e;"}
        ">${lead.score}</span>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
        <div style="color: #374151; font-size: 12px; max-width: 320px;">${lead.triggerEvent}</div>
      </td>
      <td style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
        <div style="display: flex; gap: 4px;">
          ${lead.signals
            .map(
              (s) =>
                `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; background: #f3f4f6; color: #6b7280; margin-right: 4px;">${s.source}</span>`
            )
            .join("")}
        </div>
      </td>
    </tr>
  `
    )
    .join("");

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
      <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">Daily Digest — ${formattedDate}</p>
    </div>

    <!-- Summary -->
    <div style="display: flex; gap: 12px; margin-bottom: 24px;">
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Hot Leads</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px;">${topLeads.filter((l) => l.score >= 60).length}</div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Total Leads</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px;">${topLeads.length}</div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
        <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Avg Score</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827; margin-top: 4px;">${topLeads.length ? Math.round(topLeads.reduce((s, l) => s + l.score, 0) / topLeads.length) : 0}</div>
      </div>
    </div>

    <!-- Leads Table -->
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
      <div style="padding: 16px; border-bottom: 1px solid #e5e7eb;">
        <h2 style="margin: 0; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Today's Top Leads</h2>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Company</th>
            <th style="padding: 8px 16px; text-align: center; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Score</th>
            <th style="padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Trigger Event</th>
            <th style="padding: 8px 16px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Sources</th>
          </tr>
        </thead>
        <tbody>
          ${leadRows}
        </tbody>
      </table>
    </div>

    <!-- Top Lead Details -->
    ${topLeads
      .slice(0, 3)
      .map(
        (lead) => `
    <div style="background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${lead.company.name}</h3>
        <span style="
          padding: 4px 10px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 700;
          ${lead.score >= 80 ? "background: #d1fae5; color: #065f46;" : "background: #dbeafe; color: #1e40af;"}
        ">${lead.score}/100</span>
      </div>
      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">${lead.triggerEvent}</p>
      ${lead.signals
        .map(
          (s) => `
        <div style="padding: 8px; background: #f9fafb; border-radius: 6px; margin-bottom: 4px;">
          <div style="font-size: 12px; font-weight: 600; color: #374151;">${s.title}</div>
          <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${s.description}</div>
        </div>
      `
        )
        .join("")}
      ${
        lead.contacts.length > 0
          ? `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f0f0f0;">
          <div style="font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Key Contacts</div>
          ${lead.contacts
            .map(
              (c) =>
                `<div style="font-size: 12px; color: #374151;"><strong>${c.name}</strong> — ${c.title}${c.email ? ` (${c.email})` : ""}</div>`
            )
            .join("")}
        </div>
      `
          : ""
      }
    </div>
    `
      )
      .join("")}

    <!-- Footer -->
    <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 11px;">
      <p>Salesforce First-Admin Radar &middot; Daily Digest</p>
      <p>View the full dashboard for more details and filtering options.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
