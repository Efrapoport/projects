"use client";

import { Filters, Timeframe } from "@/lib/types";
import { Clock } from "lucide-react";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  totalLeads: number;
  filteredLeads: number;
}

export function FilterBar({
  filters,
  onChange,
  totalLeads,
  filteredLeads,
}: FilterBarProps) {
  const timeframes: { value: Timeframe; label: string }[] = [
    { value: "24h", label: "Last 24h" },
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-medium text-gray-500">
              Timeframe
            </span>
          </div>
          <div className="flex gap-1">
            {timeframes.map((tf) => (
              <button
                key={tf.value}
                onClick={() => onChange({ ...filters, timeframe: tf.value })}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  filters.timeframe === tf.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <span className="text-xs text-gray-400">
          Showing {filteredLeads} of {totalLeads} leads
        </span>
      </div>
    </div>
  );
}
