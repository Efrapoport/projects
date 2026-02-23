"use client";

import { useState, useMemo } from "react";
import { X, Check, Search, DollarSign, ExternalLink } from "lucide-react";
import { useInvestors } from "@/lib/investor-context";
import { countLeadsForInvestor } from "@/lib/investor-data";

interface InvestorManagerProps {
  onClose: () => void;
  companyNames: string[];
}

export function InvestorManager({ onClose, companyNames }: InvestorManagerProps) {
  const { catalog, trackedIds, setTrackedIds } = useInvestors();
  const [search, setSearch] = useState("");

  // Local draft — start from the current tracked set
  const [draftIds, setDraftIds] = useState<Set<string>>(() => new Set(trackedIds));

  const filtered = search
    ? catalog.filter((inv) =>
        inv.name.toLowerCase().includes(search.toLowerCase()),
      )
    : catalog;

  const isDraftTracked = (id: string) => draftIds.has(id);

  const toggleInvestor = (id: string) => {
    setDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Detect whether the draft differs from the saved state
  const hasChanges = useMemo(() => {
    if (draftIds.size !== trackedIds.size) return true;
    for (const id of draftIds) {
      if (!trackedIds.has(id)) return true;
    }
    return false;
  }, [draftIds, trackedIds]);

  const handleUpdate = () => {
    setTrackedIds(Array.from(draftIds));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">My Investors</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Track investors to see funding connections on your leads
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search investors..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Investor List */}
        <div className="px-5 py-2 max-h-[360px] overflow-y-auto space-y-1.5">
          {filtered.map((investor) => {
            const tracked = isDraftTracked(investor.id);
            const leadCount = countLeadsForInvestor(investor.id, companyNames);

            return (
              <div
                key={investor.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                  tracked
                    ? "bg-blue-50 border-blue-200"
                    : "bg-white border-gray-200 hover:bg-gray-50"
                }`}
                onClick={() => toggleInvestor(investor.id)}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      tracked
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {investor.name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {investor.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {leadCount > 0 && (
                        <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                          <DollarSign className="w-3 h-3" />
                          {leadCount} lead{leadCount !== 1 ? "s" : ""} connected
                        </span>
                      )}
                      {investor.website && (
                        <a
                          href={investor.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-0.5"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    tracked
                      ? "bg-blue-600 border-blue-600"
                      : "border-gray-300"
                  }`}
                >
                  {tracked && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              No investors match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-[10px] text-gray-400">
            {draftIds.size} of {catalog.length} investors selected
          </p>
          <button
            onClick={handleUpdate}
            disabled={!hasChanges}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              hasChanges
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Update
          </button>
        </div>
      </div>
    </div>
  );
}
