import { Dashboard } from "@/components/Dashboard";
import { getAllLeads, getAvailableIndustries } from "@/lib/sample-data";
import { applyFilters } from "@/lib/filters";
import { DEFAULT_FILTERS } from "@/lib/types";

export default function Home() {
  const allLeads = getAllLeads();
  const industries = getAvailableIndustries();
  const filtered = applyFilters(allLeads, DEFAULT_FILTERS);

  return (
    <Dashboard
      initialData={{
        leads: filtered,
        total: allLeads.length,
        filtered: filtered.length,
        industries,
        dataSource: "demo",
      }}
    />
  );
}
