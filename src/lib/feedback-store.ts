// ── Company Blocklist Store ──────────────────────────────────────────
// Stores companies that users have marked as "not a real lead" so they
// are filtered out from future scrapes. Uses the same Redis / in-memory
// pattern as pipeline-store.

import type { PipelineUser } from "./pipeline-types";

const BLOCKLIST_KEY = "company-blocklist";

export interface BlocklistEntry {
  companyName: string;        // original casing
  normalizedName: string;     // lowercase trimmed (used for matching)
  reason: string;
  blockedBy: PipelineUser;
  blockedAt: string;          // ISO date
}

export type BlocklistData = BlocklistEntry[];

// ── Redis or in-memory storage ──────────────────────────────────────

const hasRedis = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let redis: import("@upstash/redis").Redis | null = null;
if (hasRedis) {
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

let memoryStore: BlocklistData = [];

export async function getBlocklist(): Promise<BlocklistData> {
  if (redis) {
    const data = await redis.get<BlocklistData>(BLOCKLIST_KEY);
    return data ?? [];
  }
  return memoryStore;
}

export async function getBlockedCompanyNames(): Promise<Set<string>> {
  const blocklist = await getBlocklist();
  return new Set(blocklist.map((e) => e.normalizedName));
}

export async function addToBlocklist(
  companyName: string,
  reason: string,
  user: PipelineUser
): Promise<BlocklistEntry> {
  const data = await getBlocklist();
  const normalizedName = companyName.toLowerCase().trim();

  // Don't duplicate
  if (data.some((e) => e.normalizedName === normalizedName)) {
    return data.find((e) => e.normalizedName === normalizedName)!;
  }

  const entry: BlocklistEntry = {
    companyName,
    normalizedName,
    reason,
    blockedBy: user,
    blockedAt: new Date().toISOString(),
  };

  data.push(entry);

  if (redis) {
    await redis.set(BLOCKLIST_KEY, data);
  } else {
    memoryStore = data;
  }

  return entry;
}

export async function removeFromBlocklist(companyName: string): Promise<void> {
  const data = await getBlocklist();
  const normalizedName = companyName.toLowerCase().trim();
  const filtered = data.filter((e) => e.normalizedName !== normalizedName);

  if (redis) {
    await redis.set(BLOCKLIST_KEY, filtered);
  } else {
    memoryStore = filtered;
  }
}
