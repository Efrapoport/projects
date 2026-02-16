"use client";

import { useState, useEffect, useCallback } from "react";
import { Lead, Filters, DEFAULT_FILTERS } from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { LeadTable } from "./LeadTable";
import { SignalPanel } from "./SignalPanel";
import { StatsBar } from "./StatsBar";
import { RefreshCw, Cloud, Mail } from "lucide-react";

interface ApiResponse {
  leads: Lead[];
  total: number;
  filtered: number;
  industries: string[];
  dataSource: "live" | "no_results";
}

export function Dashboard() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [dataSource, setDataSource] = useState<"live" | "no_results">("no_results");

  const fetchLeads = useCallback(async (refresh = false) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("timeframe", filters.timeframe);
    params.set("companySizeMin", String(filters.companySizeMin));
    params.set("companySizeMax", String(filters.companySizeMax));
    if (filters.industries.length)
      params.set("industries", filters.industries.join(","));
    if (filters.minScore) params.set("minScore", String(filters.minScore));
    if (filters.sources.length)
      params.set("sources", filters.sources.join(","));
    if (refresh) params.set("refresh", "true");

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      const data: ApiResponse = await res.json();
      setLeads(data.leads);
      setTotalLeads(data.total);
      setFilteredCount(data.filtered);
      setIndustries(data.industries);
      setDataSource(data.dataSource);
      setLastRefreshed(new Date());
    } catch {
      console.error("Failed to fetch leads");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const selectedLead = selectedLeadId
    ? leads.find((l) => l.id === selectedLeadId) || null
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  Salesforce First-Admin Radar
                </h1>
                <p className="text-xs text-gray-500">
                  Companies hiring their first Salesforce admin/developer
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  dataSource === "live"
                    ? "bg-green-100 text-green-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dataSource === "live" ? "bg-green-500" : "bg-amber-500"
                  }`}
                />
                {dataSource === "live" ? "Live Data" : "No Results"}
              </span>
              <span className="text-[10px] text-gray-400">
                Last refreshed:{" "}
                {lastRefreshed.toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <button
                onClick={() => fetchLeads(true)}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <a
                href="/api/digest/preview"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email Preview
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        <div className="space-y-4">
          {/* Stats */}
          <StatsBar leads={leads} />

          {/* Filters */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            industries={industries}
            totalLeads={totalLeads}
            filteredLeads={filteredCount}
          />

          {/* Content Area */}
          <div className="flex gap-4">
            {/* Lead Table */}
            <div className={selectedLead ? "flex-1 min-w-0" : "w-full"}>
              <LeadTable
                leads={leads}
                selectedLeadId={selectedLeadId}
                onSelectLead={(id) =>
                  setSelectedLeadId(id === selectedLeadId ? null : id)
                }
              />
            </div>

            {/* Signal Insight Panel (Side Peek) */}
            {selectedLead && (
              <div className="w-[420px] flex-shrink-0">
                <div className="sticky top-[65px]">
                  <SignalPanel
                    lead={selectedLead}
                    onClose={() => setSelectedLeadId(null)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
