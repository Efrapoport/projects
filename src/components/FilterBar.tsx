"use client";

import { Filters, Timeframe } from "@/lib/types";
import { SlidersHorizontal } from "lucide-react";

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  industries: string[];
  totalLeads: number;
  filteredLeads: number;
}

export function FilterBar({
  filters,
  onChange,
  industries,
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Filters
          </h2>
        </div>
        <span className="text-xs text-gray-400">
          Showing {filteredLeads} of {totalLeads} leads
        </span>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        {/* Timeframe */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Timeframe
          </label>
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

        {/* Company Size */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Company Size
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={filters.companySizeMin}
              onChange={(e) =>
                onChange({
                  ...filters,
                  companySizeMin: parseInt(e.target.value) || 0,
                })
              }
              className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min"
            />
            <span className="text-gray-400 text-xs">–</span>
            <input
              type="number"
              value={filters.companySizeMax}
              onChange={(e) =>
                onChange({
                  ...filters,
                  companySizeMax: parseInt(e.target.value) || 100000,
                })
              }
              className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Max"
            />
            <span className="text-[10px] text-gray-400">employees</span>
          </div>
        </div>

        {/* Industry */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Industry
          </label>
          <select
            multiple
            value={filters.industries}
            onChange={(e) => {
              const selected = Array.from(
                e.target.selectedOptions,
                (opt) => opt.value
              );
              onChange({ ...filters, industries: selected });
            }}
            className="w-44 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-[68px]"
          >
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>

        {/* Minimum Score */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Min Score
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={filters.minScore}
            onChange={(e) =>
              onChange({ ...filters, minScore: parseInt(e.target.value) })
            }
            className="w-28 accent-blue-600"
          />
          <span className="ml-2 text-xs text-gray-600 font-mono">
            {filters.minScore}
          </span>
        </div>

        {/* Reset */}
        <button
          onClick={() =>
            onChange({
              timeframe: "30d",
              companySizeMin: 0,
              companySizeMax: 100000,
              industries: [],
              minScore: 0,
              sources: [],
            })
          }
          className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
