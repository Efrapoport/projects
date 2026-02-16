"use client";

import { Lead, Signal, SignalCategory } from "@/lib/types";
import {
  X,
  ExternalLink,
  Mail,
  Linkedin,
  Clock,
  AlertCircle,
  TrendingUp,
  Globe,
  Briefcase,
  Server,
  Newspaper,
  UserPlus,
} from "lucide-react";

interface SignalPanelProps {
  lead: Lead;
  onClose: () => void;
}

const categoryLabels: Record<SignalCategory, string> = {
  technographic: "Technographic",
  job_posting: "Job Posting",
  financial: "Financial / Funding",
  public_footprint: "Public Footprint",
  infrastructure: "Infrastructure",
  executive_hire: "Executive Hire",
};

const categoryIcons: Record<SignalCategory, React.ReactNode> = {
  technographic: <Globe className="w-4 h-4" />,
  job_posting: <Briefcase className="w-4 h-4" />,
  financial: <TrendingUp className="w-4 h-4" />,
  public_footprint: <Newspaper className="w-4 h-4" />,
  infrastructure: <Server className="w-4 h-4" />,
  executive_hire: <UserPlus className="w-4 h-4" />,
};

const categoryColors: Record<SignalCategory, string> = {
  technographic: "bg-teal-50 text-teal-700 border-teal-200",
  job_posting: "bg-blue-50 text-blue-700 border-blue-200",
  financial: "bg-amber-50 text-amber-700 border-amber-200",
  public_footprint: "bg-purple-50 text-purple-700 border-purple-200",
  infrastructure: "bg-gray-50 text-gray-700 border-gray-200",
  executive_hire: "bg-green-50 text-green-700 border-green-200",
};

function highlightKeywords(text: string): React.ReactNode {
  const keywords = [
    "first",
    "build from scratch",
    "greenfield",
    "initial setup",
    "sole contributor",
    "owning our instance",
    "transition from",
    "migrating from",
    "standing up",
    "net new",
    "founding",
    "salesforce",
    "hubspot",
    "spreadsheets",
  ];

  // Build a single regex from all keywords
  const escaped = keywords.map((kw) =>
    kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");

  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 text-yellow-900 px-0.5 rounded font-medium"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SignalCard({ signal }: { signal: Signal }) {
  return (
    <div
      className={`border rounded-lg p-3 ${categoryColors[signal.category]}`}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{categoryIcons[signal.category]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
              {categoryLabels[signal.category]}
            </span>
            <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded">
              +{signal.weight} pts
            </span>
          </div>
          <p className="text-sm font-semibold mt-1">{signal.title}</p>
          <p className="text-xs mt-1 opacity-80">{signal.description}</p>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] opacity-60">
            <Clock className="w-3 h-3" />
            {formatDate(signal.detectedAt)}
            <span className="mx-1">|</span>
            <span className="capitalize">{signal.source}</span>
          </div>
        </div>
      </div>

      {/* Job Description Snippet */}
      {signal.raw && (
        <div className="mt-3 p-2.5 bg-white/50 rounded-md border border-current/10">
          <div className="flex items-center gap-1 mb-1.5">
            <AlertCircle className="w-3 h-3 opacity-60" />
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-60">
              Job Description Excerpt
            </span>
          </div>
          <p className="text-xs leading-relaxed">
            {highlightKeywords(signal.raw)}
          </p>
        </div>
      )}
    </div>
  );
}

export function SignalPanel({ lead, onClose }: SignalPanelProps) {
  // Sort signals by weight descending
  const sortedSignals = [...lead.signals].sort((a, b) => b.weight - a.weight);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{lead.company.name}</h2>
            <p className="text-blue-100 text-xs mt-0.5">
              {lead.company.industry} &middot; {lead.company.employeeCount}{" "}
              employees &middot; {lead.company.city}, {lead.company.state}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
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
            <Globe className="w-3 h-3" /> Website
          </a>
          <a
            href={lead.company.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
          >
            <Linkedin className="w-3 h-3" /> LinkedIn
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Why They Are Here */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h3 className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">
            Why They Are Here
          </h3>
          <p className="text-sm text-amber-900">{lead.triggerEvent}</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-2xl font-bold text-amber-700">
              {lead.score}
              <span className="text-sm font-normal text-amber-500">/100</span>
            </span>
            <span className="text-[10px] text-amber-600">
              Lead Score &middot; {lead.signals.length} signal
              {lead.signals.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Signals */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Signals ({sortedSignals.length})
          </h3>
          <div className="space-y-2">
            {sortedSignals.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        </div>

        {/* Direct Contacts */}
        {lead.contacts.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Direct Contacts ({lead.contacts.length})
            </h3>
            <div className="space-y-2">
              {lead.contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-2.5 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center text-white text-xs font-bold">
                      {contact.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {contact.name}
                      </p>
                      <p className="text-xs text-gray-500">{contact.title}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title={contact.email}
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5 italic">
              Sourced from Apollo / Hunter.io / LinkedIn
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
