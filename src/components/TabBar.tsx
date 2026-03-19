"use client";

import { Target, Users } from "lucide-react";

export type DashboardTab = "first-admin" | "si-dependent";

interface TabBarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const tabs: { id: DashboardTab; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "first-admin",
    label: "First-Admin Radar",
    icon: <Target className="w-4 h-4" />,
    description: "Companies hiring their first SF admin",
  },
  {
    id: "si-dependent",
    label: "SI-Dependent Companies",
    icon: <Users className="w-4 h-4" />,
    description: "Companies outsourcing all SF work to consultants",
  },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === tab.id
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          {tab.icon}
          <span>{tab.label}</span>
          <span className={`hidden lg:inline text-xs ${
            activeTab === tab.id ? "text-gray-400" : "text-gray-400"
          }`}>
            — {tab.description}
          </span>
        </button>
      ))}
    </div>
  );
}
