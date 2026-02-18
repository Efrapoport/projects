"use client";

import { Lead, SignalSource } from "@/lib/types";
import {
  Linkedin,
  Search,
  Globe,
  Database,
  FileText,
  Wifi,
  Newspaper,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from "lucide-react";

interface LeadTableProps {
  leads: Lead[];
  selectedLeadId: string | null;
  onSelectLead: (id: string) => void;
}

const sourceIcons: Record<SignalSource, React.ReactNode> = {
  linkedin: <Linkedin className="w-3.5 h-3.5 text-blue-600" />,
  indeed: <Search className="w-3.5 h-3.5 text-purple-600" />,
  google_jobs: <Globe className="w-3.5 h-3.5 text-blue-500" />,
  remoteok: <Globe className="w-3.5 h-3.5 text-red-500" />,
  arbeitnow: <Search className="w-3.5 h-3.5 text-cyan-600" />,
  jobicy: <Globe className="w-3.5 h-3.5 text-violet-500" />,
  himalayas: <Search className="w-3.5 h-3.5 text-emerald-600" />,
  earnbetter: <Globe className="w-3.5 h-3.5 text-orange-500" />,
  greenhouse: <FileText className="w-3.5 h-3.5 text-green-600" />,
  lever: <FileText className="w-3.5 h-3.5 text-orange-500" />,
  builtwith: <Database className="w-3.5 h-3.5 text-amber-600" />,
  wappalyzer: <Globe className="w-3.5 h-3.5 text-teal-600" />,
  crunchbase: <Database className="w-3.5 h-3.5 text-red-500" />,
  apollo: <Search className="w-3.5 h-3.5 text-indigo-500" />,
  appexchange: <Globe className="w-3.5 h-3.5 text-blue-500" />,
  dns: <Wifi className="w-3.5 h-3.5 text-gray-600" />,
  news: <Newspaper className="w-3.5 h-3.5 text-gray-500" />,
  wellfound: <Globe className="w-3.5 h-3.5 text-pink-500" />,
  "startup.jobs": <Search className="w-3.5 h-3.5 text-lime-600" />,
  ziprecruiter: <Search className="w-3.5 h-3.5 text-sky-600" />,
  glassdoor: <Globe className="w-3.5 h-3.5 text-green-500" />,
  builtin: <Globe className="w-3.5 h-3.5 text-indigo-500" />,
};

function ScoreBadge({ score }: { score: number }) {
  let color = "bg-gray-100 text-gray-700";
  if (score >= 80) color = "bg-emerald-100 text-emerald-800";
  else if (score >= 60) color = "bg-blue-100 text-blue-800";
  else if (score >= 40) color = "bg-amber-100 text-amber-800";
  else if (score >= 20) color = "bg-orange-100 text-orange-800";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${color}`}
    >
      {score}
    </span>
  );
}

function getUniqueSources(lead: Lead): SignalSource[] {
  const sources = new Set(lead.signals.map((s) => s.source));
  return Array.from(sources);
}

export function LeadTable({
  leads,
  selectedLeadId,
  onSelectLead,
}: LeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm">
        <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">No leads match your filters.</p>
        <p className="text-gray-400 text-xs mt-1">
          Try adjusting the timeframe or company size range.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Hot Leads
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Trigger Event
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Industry
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                Sources
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {leads.map((lead) => (
              <tr
                key={lead.id}
                onClick={() => onSelectLead(lead.id)}
                className={`cursor-pointer transition-colors ${
                  selectedLeadId === lead.id
                    ? "bg-blue-50 border-l-2 border-l-blue-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {lead.company.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-gray-900">
                          {lead.company.name}
                        </span>
                        {lead.company.websiteVerified ? (
                          <span title="Website verified">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          </span>
                        ) : (
                          <span title="Links go to search (unverified)">
                            <AlertCircle className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                        <a
                          href={lead.company.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                      <span className="text-xs text-gray-400">
                        {lead.company.city}, {lead.company.state}
                      </span>
                      {lead.hiringManager && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <UserCheck className={`w-3 h-3 ${
                            lead.hiringManager.confidence === "high"
                              ? "text-green-500"
                              : lead.hiringManager.confidence === "medium"
                                ? "text-blue-400"
                                : "text-gray-400"
                          }`} />
                          <span className="text-[10px] text-gray-500 truncate max-w-[180px]">
                            {lead.hiringManager.name
                              ? `${lead.hiringManager.name} (${lead.hiringManager.title})`
                              : lead.hiringManager.title}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ScoreBadge score={lead.score} />
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs text-gray-600 max-w-xs truncate">
                    {lead.triggerEvent}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {lead.company.industry}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-500">
                    {lead.company.employeeCount > 0
                      ? lead.company.employeeCount.toLocaleString()
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {getUniqueSources(lead).map((src) => (
                      <span key={src} title={src}>
                        {sourceIcons[src]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
