"use client";

import { useState, useMemo, useCallback } from "react";
import { Lead, Filters, DEFAULT_FILTERS } from "@/lib/types";
import { applyFilters } from "@/lib/filters";
import { FilterBar } from "./FilterBar";
import { LeadTable } from "./LeadTable";
import { SignalPanel } from "./SignalPanel";
import { StatsBar } from "./StatsBar";
import { RefreshCw, Cloud, Mail, AlertTriangle, Loader2 } from "lucide-react";
import { HealthCheckButton } from "./HealthCheck";

interface ApiResponse {
  leads: Lead[];
  total: number;
  industries: string[];
  dataSource?: "live" | "bundled" | "demo";
  warnings?: string[];
}

interface DashboardProps {
  initialData?: ApiResponse;
}

export function Dashboard({ initialData }: DashboardProps) {
  const hasInitial = !!(initialData?.leads?.length);

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  // allLeads stores the FULL unfiltered dataset; filters are applied client-side
  const [allLeads, setAllLeads] = useState<Lead[]>(hasInitial ? initialData.leads : []);
  const [industries, setIndustries] = useState<string[]>(hasInitial ? initialData.industries : []);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!hasInitial);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(hasInitial ? new Date() : null);
  const [dataSource, setDataSource] = useState<string>(initialData?.dataSource || "");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>(initialData?.warnings || []);

  // Client-side filtering — instant response when user changes timeframe/filters
  const filteredLeads = useMemo(
    () => applyFilters(allLeads, filters),
    [allLeads, filters]
  );

  const fetchLeads = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (refresh) params.set("refresh", "true");
    params.set("_t", String(Date.now()));

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}: ${res.statusText}`);
      }
      const data: ApiResponse = await res.json();
      setAllLeads(data.leads);
      setIndustries(data.industries);
      setDataSource(data.dataSource || "unknown");
      setLastRefreshed(new Date());
      setWarnings(data.warnings || []);

      if (data.leads.length === 0) {
        setError("No leads found. The scrapers returned 0 results.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(`Failed to fetch leads from API: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount only if no server-provided data
  useState(() => {
    if (!hasInitial) {
      fetchLeads();
    }
  });

  const selectedLead = selectedLeadId
    ? filteredLeads.find((l) => l.id === selectedLeadId) || null
    : null;

  // ── Loading state ──────────────────────────────────────────────────
  if (loading && allLeads.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600">Fetching leads from scraped sources...</p>
        </div>
      </div>
    );
  }

  // ── Error state (no data at all) ──────────────────────────────────
  if (!loading && allLeads.length === 0 && error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 max-w-lg text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No Leads Available</h2>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <p className="text-xs text-gray-500 mb-4">
            This likely means the /api/leads endpoint is unreachable or the scrapers
            returned no results. Check the browser console and terminal for details.
          </p>
          <button
            onClick={() => fetchLeads(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Data source label ─────────────────────────────────────────────
  const sourceLabel = dataSource === "live" ? "Live Scraped" : dataSource === "bundled" ? "Bundled (Real)" : "Data";
  const sourceColor = dataSource === "live" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700";
  const dotColor = dataSource === "live" ? "bg-green-500" : "bg-blue-500";

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
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sourceColor}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                {sourceLabel}
              </span>
              {lastRefreshed && (
                <span className="text-[10px] text-gray-400">
                  Last refreshed:{" "}
                  {lastRefreshed.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <HealthCheckButton />
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
          {/* Error Banner (non-fatal — we still have leads showing) */}
          {error && allLeads.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center justify-between">
              <span className="text-sm text-amber-700">{error}</span>
              <button
                onClick={() => fetchLeads(true)}
                className="text-xs font-medium text-amber-700 hover:text-amber-900 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Data freshness banner */}
          <div
            className={`rounded-lg px-4 py-3 flex items-center justify-between ${
              dataSource === "live"
                ? "bg-green-50 border border-green-200"
                : "bg-amber-50 border border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  dataSource === "live" ? "bg-green-500" : "bg-amber-500"
                }`}
              />
              <span className="text-sm text-gray-700">
                {dataSource === "live" ? (
                  <>
                    Showing <strong>live-scraped</strong> data
                    {lastRefreshed && (
                      <> as of{" "}
                        <strong>
                          {lastRefreshed.toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </strong>
                      </>
                    )}
                    .
                  </>
                ) : (
                  <>
                    Showing <strong>bundled</strong> data
                    {lastRefreshed
                      ? <> loaded at{" "}
                          <strong>
                            {lastRefreshed.toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </strong>.
                        </>
                      : <>.</>
                    }{" "}
                    Click <strong>&quot;Refresh&quot;</strong> in the top-right corner to pull
                    fresh results from all scrapers.
                  </>
                )}
              </span>
            </div>
            <button
              onClick={() => fetchLeads(true)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                dataSource === "live"
                  ? "text-green-700 bg-green-100 hover:bg-green-200"
                  : "text-amber-700 bg-amber-100 hover:bg-amber-200"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh Now"}
            </button>
          </div>

          {/* SerpAPI Quota Warning */}
          {warnings.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2.5 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                {warnings.map((w, i) => (
                  <p key={i} className="text-sm text-red-700">{w}</p>
                ))}
                <p className="text-[10px] text-red-500 mt-1">
                  Check the Health panel for details. Data from previous scrapes is still available.
                </p>
              </div>
            </div>
          )}

          {/* Stats */}
          <StatsBar leads={filteredLeads} />

          {/* Filters */}
          <FilterBar
            filters={filters}
            onChange={setFilters}
            industries={industries}
            totalLeads={allLeads.length}
            filteredLeads={filteredLeads.length}
          />

          {/* Content Area */}
          <div className="flex gap-4">
            {/* Lead Table */}
            <div className={selectedLead ? "flex-1 min-w-0" : "w-full"}>
              <LeadTable
                leads={filteredLeads}
                selectedLeadId={selectedLeadId}
                onSelectLead={(id) =>
                  setSelectedLeadId(id === selectedLeadId ? null : id)
                }
              />
            </div>

            {/* Signal Insight Panel (Side Peek) */}
            {selectedLead && (
              <div className="w-[420px] flex-shrink-0">
                <div className="sticky top-[65px] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col">
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
