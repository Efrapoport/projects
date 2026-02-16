"use client";

import { Lead } from "@/lib/types";
import { TrendingUp, Building2, Zap, Target } from "lucide-react";

interface StatsBarProps {
  leads: Lead[];
}

export function StatsBar({ leads }: StatsBarProps) {
  const hotLeads = leads.filter((l) => l.score >= 60).length;
  const avgScore = leads.length
    ? Math.round(leads.reduce((sum, l) => sum + l.score, 0) / leads.length)
    : 0;
  const totalSignals = leads.reduce((sum, l) => sum + l.signals.length, 0);
  const uniqueIndustries = new Set(leads.map((l) => l.company.industry)).size;

  const stats = [
    {
      label: "Hot Leads",
      value: hotLeads,
      sublabel: "Score 60+",
      icon: <Target className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50",
    },
    {
      label: "Avg Score",
      value: avgScore,
      sublabel: "Across all leads",
      icon: <TrendingUp className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50",
    },
    {
      label: "Signals",
      value: totalSignals,
      sublabel: "Total detected",
      icon: <Zap className="w-5 h-5 text-amber-600" />,
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
        <div
          key={stat.label}
          className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                {stat.value}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {stat.sublabel}
              </p>
            </div>
            <div className={`p-2.5 rounded-lg ${stat.bg}`}>{stat.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
