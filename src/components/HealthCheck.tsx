"use client";

import { useState, useCallback } from "react";
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SkipForward,
  Loader2,
  X,
  Database,
  Clock,
} from "lucide-react";

interface SourceHealth {
  name: string;
  status: "ok" | "warn" | "error" | "skipped";
  latencyMs: number;
  jobCount: number;
  error?: string;
  details?: string;
}

interface HealthResponse {
  sources: SourceHealth[];
  storeSize: number;
  cacheAge: number | null;
  summary: {
    healthy: number;
    total: number;
    allHealthy: boolean;
  };
}

const statusStyles: Record<string, string> = {
  ok: "bg-white border-gray-200",
  warn: "bg-amber-50 border-amber-200",
  error: "bg-red-50 border-red-200",
  skipped: "bg-gray-50 border-gray-200 opacity-60",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />;
    case "warn":
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
    case "skipped":
      return <SkipForward className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
    default:
      return <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />;
  }
}

function StatusLabel({ status, jobCount, latencyMs }: SourceHealth) {
  switch (status) {
    case "ok":
      return (
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span>{jobCount} jobs</span>
          <span>{latencyMs}ms</span>
        </div>
      );
    case "warn":
      return (
        <div className="flex items-center gap-3 text-[10px] text-amber-600">
          <span>0 jobs</span>
          {latencyMs > 0 && <span>{latencyMs}ms</span>}
        </div>
      );
    case "skipped":
      return <span className="text-[10px] text-gray-400">Skipped</span>;
    default:
      return <span className="text-[10px] text-red-500">Failed</span>;
  }
}

export function HealthCheckButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: HealthResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    if (!data && !loading) runCheck();
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        title="Source Health Check"
      >
        <Activity className="w-3.5 h-3.5" />
        Health
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-gray-600" />
                <h2 className="text-sm font-bold text-gray-900">
                  Data Source Health Check
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {loading && !data && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <p className="text-sm text-gray-500">
                    Probing all data sources...
                  </p>
                  <p className="text-[10px] text-gray-400">
                    This calls each API independently — may take 15-20s
                  </p>
                </div>
              )}

              {error && (
                <div className="text-center py-6">
                  <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              {data && (
                <>
                  {/* Summary Banner */}
                  <div
                    className={`rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between ${
                      data.summary.allHealthy
                        ? "bg-green-50 border border-green-200"
                        : "bg-amber-50 border border-amber-200"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {data.summary.allHealthy ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span
                        className={`text-sm font-semibold ${
                          data.summary.allHealthy
                            ? "text-green-700"
                            : "text-amber-700"
                        }`}
                      >
                        {data.summary.healthy}/{data.summary.total} sources
                        returning data
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Database className="w-3 h-3" />
                        {data.storeSize} jobs in store
                      </span>
                      {data.cacheAge !== null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Cache {Math.round(data.cacheAge / 60000)}m old
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Source List */}
                  <div className="space-y-1.5">
                    {data.sources.map((src) => (
                      <div
                        key={src.name}
                        className={`px-3 py-2 rounded-lg border ${statusStyles[src.status] || statusStyles.error}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <StatusIcon status={src.status} />
                            <p className="text-xs font-medium text-gray-900">
                              {src.name}
                            </p>
                          </div>
                          <StatusLabel {...src} />
                        </div>
                        {src.error && (
                          <p className="text-[10px] text-red-500 mt-1 ml-6 max-w-full truncate">
                            {src.error}
                          </p>
                        )}
                        {src.details && (
                          <p className="text-[10px] text-gray-400 mt-1 ml-6">
                            {src.details}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Re-run button */}
                  <button
                    onClick={runCheck}
                    disabled={loading}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Activity className="w-3.5 h-3.5" />
                    )}
                    {loading ? "Checking..." : "Re-run Health Check"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
