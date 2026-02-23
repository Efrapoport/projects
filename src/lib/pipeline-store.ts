import type {
  PipelineData,
  PipelineEntry,
  PipelineStage,
  PipelineUser,
} from "./pipeline-types";

const PIPELINE_KEY = "pipeline-data";

// ── Redis or in-memory storage ──────────────────────────────────────
// Use Upstash Redis when credentials are available. Otherwise fall back
// to a simple in-memory store so pipeline updates still work locally.

const hasRedis = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let redis: import("@upstash/redis").Redis | null = null;
if (hasRedis) {
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

// In-memory fallback (persists within a single server process / dev session)
let memoryStore: PipelineData = {};

export async function getAllPipelineEntries(): Promise<PipelineData> {
  if (redis) {
    const data = await redis.get<PipelineData>(PIPELINE_KEY);
    return data ?? {};
  }
  return memoryStore;
}

export async function getPipelineEntry(
  leadId: string
): Promise<PipelineEntry | null> {
  const data = await getAllPipelineEntries();
  return data[leadId] ?? null;
}

export async function updatePipelineStage(
  leadId: string,
  stage: PipelineStage,
  user: PipelineUser,
  note?: string
): Promise<PipelineEntry> {
  const data = await getAllPipelineEntries();

  const existing = data[leadId];
  const entry: PipelineEntry = existing ?? {
    leadId,
    currentStage: "new",
    history: [],
  };

  entry.currentStage = stage;
  entry.history.push({
    stage,
    updatedBy: user,
    updatedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  });

  data[leadId] = entry;

  if (redis) {
    await redis.set(PIPELINE_KEY, data);
  } else {
    memoryStore = data;
  }

  return entry;
}
