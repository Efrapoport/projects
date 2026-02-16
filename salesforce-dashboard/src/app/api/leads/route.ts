import { NextRequest, NextResponse } from "next/server";
import { getAllLeads, getAvailableIndustries } from "@/lib/mock-data";
import { applyFilters } from "@/lib/filters";
import { Filters, DEFAULT_FILTERS, Timeframe, SignalSource } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Parse filter params
  const timeframe = (searchParams.get("timeframe") as Timeframe) || DEFAULT_FILTERS.timeframe;
  const companySizeMin = parseInt(searchParams.get("companySizeMin") || String(DEFAULT_FILTERS.companySizeMin), 10);
  const companySizeMax = parseInt(searchParams.get("companySizeMax") || String(DEFAULT_FILTERS.companySizeMax), 10);
  const industriesParam = searchParams.get("industries");
  const industries = industriesParam ? industriesParam.split(",") : [];
  const minScore = parseInt(searchParams.get("minScore") || "0", 10);
  const sourcesParam = searchParams.get("sources");
  const sources = sourcesParam ? (sourcesParam.split(",") as SignalSource[]) : [];

  const filters: Filters = {
    timeframe,
    companySizeMin,
    companySizeMax,
    industries,
    minScore,
    sources,
  };

  const allLeads = getAllLeads();
  const filtered = applyFilters(allLeads, filters);

  return NextResponse.json({
    leads: filtered,
    total: allLeads.length,
    filtered: filtered.length,
    industries: getAvailableIndustries(),
  });
}
