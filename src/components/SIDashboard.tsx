"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { SIDependentLead } from "@/lib/types";
import { RefreshCw, Loader2, AlertTriangle, Search, Users, Building2, TrendingUp, Briefcase, X, ExternalLink, Linkedin, Clock, Send, Copy, Check } from "lucide-react";
import {
  SI_OUTREACH_TEMPLATES,
  selectBestSITemplate,
  getSIOutreachContactName,
} from "@/lib/si-outreach-templates";

// ── Types ────────────────────────────────────────────────────────────

interface SIApiResponse {
  leads: SIDependentLead[];
  total: number;
  industries: string[];
  topSIPartners: string[];
  dataSource?: "live" | "bundled" | "error";
}

interface SIDashboardProps {
  initialData?: SIApiResponse;
}

// ── Stats Bar ────────────────────────────────────────────────────────

function SIStatsBar({ leads, topSIPartners }: { leads: SIDependentLead[]; topSIPartners: string[] }) {
  const highDependency = leads.filter((l) => l.dependencyScore >= 60).length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((sum, l) => sum + l.dependencyScore, 0) / leads.length)
    : 0;
  const totalSignals = leads.reduce((sum, l) => sum + l.signals.length, 0);
  const uniqueIndustries = new Set(leads.map((l) => l.company.industry)).size;

  const stats = [
    {
      label: "High Dependency",
      value: highDependency,
      sublabel: "Score 60+",
      icon: <Users className="w-5 h-5 text-red-600" />,
      bg: "bg-red-50",
    },
    {
      label: "Avg Score",
      value: avgScore,
      sublabel: "Dependency score",
      icon: <TrendingUp className="w-5 h-5 text-orange-600" />,
      bg: "bg-orange-50",
    },
    {
      label: "SI Signals",
      value: totalSignals,
      sublabel: "Total detected",
      icon: <Briefcase className="w-5 h-5 text-amber-600" />,
      bg: "bg-amber-50",
    },
    {
      label: "Industries",
      value: uniqueIndustries,
      sublabel: "Represented",
      icon: <Building2 className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">{stat.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{stat.sublabel}</p>
            </div>
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>{stat.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Score Badge ──────────────────────────────────────────────────────

function DependencyBadge({ score }: { score: number }) {
  let color = "bg-gray-100 text-gray-700";
  if (score >= 80) color = "bg-red-100 text-red-800";
  else if (score >= 60) color = "bg-orange-100 text-orange-800";
  else if (score >= 40) color = "bg-amber-100 text-amber-800";

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

// ── Relationship Type Badge ─────────────────────────────────────────

function RelationshipBadge({ type }: { type: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    full_outsource: { text: "Full Outsource", color: "bg-red-100 text-red-700" },
    staff_augmentation: { text: "Staff Aug", color: "bg-orange-100 text-orange-700" },
    project_based: { text: "Project-Based", color: "bg-yellow-100 text-yellow-700" },
  };
  const { text, color } = labels[type] || { text: type, color: "bg-gray-100 text-gray-700" };
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${color}`}>{text}</span>;
}

// ── SI Signal Card ──────────────────────────────────────────────────

const siCategoryColors: Record<string, string> = {
  consultant_hiring: "bg-red-50 text-red-700 border-red-200",
  staffing_agency: "bg-orange-50 text-orange-700 border-orange-200",
  si_partner_posting: "bg-amber-50 text-amber-700 border-amber-200",
  managed_services: "bg-yellow-50 text-yellow-700 border-yellow-200",
  no_fte_history: "bg-purple-50 text-purple-700 border-purple-200",
  contract_pattern: "bg-blue-50 text-blue-700 border-blue-200",
  rfp_signal: "bg-teal-50 text-teal-700 border-teal-200",
  small_it_team: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const siCategoryLabels: Record<string, string> = {
  consultant_hiring: "Hiring Consultant",
  staffing_agency: "Staffing Agency",
  si_partner_posting: "SI Partner Posting",
  managed_services: "Managed Services",
  no_fte_history: "No FTE History",
  contract_pattern: "Contract Pattern",
  rfp_signal: "RFP Signal",
  small_it_team: "Small IT Team",
};

// ── SI Signal Panel ─────────────────────────────────────────────────

function SISignalPanel({ lead, onClose }: { lead: SIDependentLead; onClose: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{lead.company.name}</h2>
            <p className="text-orange-100 text-xs mt-0.5">
              {lead.company.industry}
              {lead.company.employeeCount > 0 && <> &middot; {lead.company.employeeCount.toLocaleString()} employees</>}
              {(lead.company.city || lead.company.state) && <> &middot; {lead.company.city}{lead.company.city && lead.company.state && ", "}{lead.company.state}</>}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <a
            href={lead.company.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
          >
            <Search className="w-3 h-3" /> Search Website
          </a>
          <a
            href={lead.company.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
          >
            <Linkedin className="w-3 h-3" /> Find on LinkedIn
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Dependency Summary */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">
            SI Dependency Analysis
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-bold text-red-700">
              {lead.dependencyScore}
              <span className="text-sm font-normal text-red-500">/100</span>
            </span>
            <div className="text-[10px] text-red-600 space-y-0.5">
              <p>Dependency Score &middot; {lead.signals.length} signal{lead.signals.length !== 1 ? "s" : ""}</p>
              <p>Complexity: <span className="font-medium capitalize">{lead.estimatedSFComplexity}</span></p>
            </div>
          </div>
        </div>

        {/* Known SI Partners */}
        {lead.knownSIPartners.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <h3 className="text-xs font-semibold text-orange-800 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Known SI Partners ({lead.knownSIPartners.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {lead.knownSIPartners.map((partner) => (
                <span
                  key={partner}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"
                >
                  {partner}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-orange-600 mt-2">
              <RelationshipBadge type={lead.siRelationshipType} />
              <span className="ml-1">relationship detected</span>
            </p>
          </div>
        )}

        {/* Signals */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            SI-Dependency Signals ({lead.signals.length})
          </h3>
          <div className="space-y-2">
            {lead.signals.map((signal) => (
              <div
                key={signal.id}
                className={`border rounded-lg p-3 ${siCategoryColors[signal.category] || "bg-gray-50 text-gray-700 border-gray-200"}`}
              >
                <div className="flex items-start gap-2">
                  <Briefcase className="w-4 h-4 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                        {siCategoryLabels[signal.category] || signal.category}
                      </span>
                      <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded">
                        +{signal.weight} pts
                      </span>
                    </div>
                    <p className="text-sm font-semibold mt-1">{signal.title}</p>
                    <p className="text-xs mt-1 leading-relaxed opacity-80">{signal.description}</p>
                    {signal.siPartnerName && (
                      <p className="text-[10px] mt-1 font-medium opacity-70">
                        SI: {signal.siPartnerName}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] opacity-60">
                      <Clock className="w-3 h-3" />
                      {signal.detectedAt ? new Date(signal.detectedAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      }) : "Unknown date"}
                    </div>
                    {signal.url && (
                      <a
                        href={signal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View posting
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contacts */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Suggested Contacts
          </h3>
          {lead.contacts.length > 0 ? (
            <div className="space-y-2">
              {lead.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                    <p className="text-xs text-gray-500">{contact.title}</p>
                  </div>
                  {contact.linkedinUrl && (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 border border-gray-200 rounded-lg bg-gray-50 text-center">
              <p className="text-xs text-gray-400">No contacts found yet</p>
              <a
                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent("VP operations OR CTO OR IT director " + lead.company.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                <Search className="w-3 h-3" /> Search on LinkedIn
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SI Outreach Modal ───────────────────────────────────────────────

function SIOutreachModal({
  lead,
  onClose,
}: {
  lead: SIDependentLead;
  onClose: () => void;
}) {
  const contactName = getSIOutreachContactName(lead);
  const bestTemplate = useMemo(() => selectBestSITemplate(lead), [lead]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(bestTemplate.id);
  const [copied, setCopied] = useState(false);

  const selectedTemplate = SI_OUTREACH_TEMPLATES.find((t) => t.id === selectedTemplateId)!;
  const [message, setMessage] = useState(selectedTemplate.generate(lead, contactName));

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = SI_OUTREACH_TEMPLATES.find((t) => t.id === templateId)!;
    setMessage(template.generate(lead, contactName));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-600 to-red-600 text-white">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            <h2 className="text-sm font-bold">Outreach for {lead.company.name}</h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-600 space-y-0.5">
          <p><span className="font-medium text-gray-800">Company:</span> {lead.company.name}</p>
          <p><span className="font-medium text-gray-800">SI Partners:</span> {lead.knownSIPartners.join(", ") || "Unknown"}</p>
          <p><span className="font-medium text-gray-800">Dependency Score:</span> {lead.dependencyScore} &middot; {lead.company.industry}</p>
        </div>

        <div className="px-5 py-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={10}
            className="w-full px-3 py-2.5 text-sm text-gray-800 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 leading-relaxed"
          />
        </div>

        <div className="px-5 pb-3 flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Template:</label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-400"
          >
            {SI_OUTREACH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end bg-gray-50">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-4 py-2 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
          >
            {copied ? (
              <><Check className="w-3 h-3" /> Copied</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy to Clipboard</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lead Table ──────────────────────────────────────────────────────

function SILeadTable({
  leads,
  selectedLeadId,
  onSelectLead,
  onOutreachRequest,
}: {
  leads: SIDependentLead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
  onOutreachRequest: (lead: SIDependentLead) => void;
}) {
  if (leads.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
        <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No SI-dependent companies detected.</p>
        <p className="text-gray-400 text-xs mt-1">Try refreshing to pull fresh data from scrapers.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          SI-Dependent Companies
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Dependency</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">SI Partners</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Industry</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Signals</th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Outreach</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead.id)}
                className={`cursor-pointer transition-colors ${
                  selectedLeadId === lead.id
                    ? "bg-orange-50 border-l-2 border-l-orange-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {lead.company.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{lead.company.name}</span>
                      {(lead.company.city || lead.company.state) && (
                        <p className="text-xs text-gray-400">
                          {lead.company.city}{lead.company.city && lead.company.state && ", "}{lead.company.state}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <DependencyBadge score={lead.dependencyScore} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {lead.knownSIPartners.slice(0, 2).map((partner) => (
                      <span
                        key={partner}
                        className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium"
                      >
                        {partner}
                      </span>
                    ))}
                    {lead.knownSIPartners.length > 2 && (
                      <span className="text-[10px] text-gray-400">
                        +{lead.knownSIPartners.length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RelationshipBadge type={lead.siRelationshipType} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {lead.company.industry}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">{lead.signals.length}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOutreachRequest(lead);
                    }}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-md transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    Message
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main SI Dashboard Component ─────────────────────────────────────

export function SIDashboard({ initialData }: SIDashboardProps) {
  const [allLeads, setAllLeads] = useState<SIDependentLead[]>(initialData?.leads || []);
  const [topSIPartners, setTopSIPartners] = useState<string[]>(initialData?.topSIPartners || []);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [outreachLead, setOutreachLead] = useState<SIDependentLead | null>(null);
  const [loading, setLoading] = useState(!initialData?.leads?.length);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>(initialData?.dataSource || "");

  const fetchSILeads = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (refresh) params.set("refresh", "true");
    params.set("_t", String(Date.now()));

    try {
      const res = await fetch(`/api/si-leads?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SIApiResponse = await res.json();
      setAllLeads(data.leads);
      setTopSIPartners(data.topSIPartners);
      setDataSource(data.dataSource || "unknown");
      if (data.leads.length === 0) {
        setError("No SI-dependent companies found. Try refreshing.");
      }
    } catch (err) {
      setError(`Failed to fetch SI leads: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount if no initial data
  useEffect(() => {
    if (!initialData?.leads?.length) {
      fetchSILeads();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedLead = selectedLeadId
    ? allLeads.find((l) => l.id === selectedLeadId) || null
    : null;

  // Loading state
  if (loading && allLeads.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Analyzing job postings for SI dependency signals...</p>
        </div>
      </div>
    );
  }

  // Error state (no data)
  if (!loading && allLeads.length === 0 && error) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 max-w-lg text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No SI-Dependent Companies Found</h2>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <button
            onClick={() => fetchSILeads(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {allLeads.length} companies detected as SI-dependent
          {dataSource === "bundled" && " (bundled data)"}
        </p>
        <button
          onClick={() => fetchSILeads(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Stats */}
      <SIStatsBar leads={allLeads} topSIPartners={topSIPartners} />

      {/* Top SI Partners bar */}
      {topSIPartners.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Top SIs:</span>
            {topSIPartners.slice(0, 8).map((partner) => (
              <span key={partner} className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium">
                {partner}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex gap-4">
        <div className={selectedLead ? "flex-1 min-w-0" : "w-full"}>
          <SILeadTable
            leads={allLeads}
            selectedLeadId={selectedLeadId}
            onSelectLead={(id) => setSelectedLeadId(id === selectedLeadId ? null : id)}
            onOutreachRequest={(lead) => setOutreachLead(lead)}
          />
        </div>

        {selectedLead && (
          <div className="w-[420px] flex-shrink-0">
            <div className="sticky top-[65px] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <SISignalPanel lead={selectedLead} onClose={() => setSelectedLeadId(null)} />
            </div>
          </div>
        )}
      </div>

      {/* Outreach Modal */}
      {outreachLead && (
        <SIOutreachModal lead={outreachLead} onClose={() => setOutreachLead(null)} />
      )}
    </div>
  );
}
