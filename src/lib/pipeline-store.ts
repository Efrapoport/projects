import { Redis } from "@upstash/redis";
import type {
  PipelineData,
  PipelineEntry,
  PipelineStage,
  PipelineUser,
} from "./pipeline-types";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const PIPELINE_KEY = "pipeline-data";

export async function getAllPipelineEntries(): Promise<PipelineData> {
  const data = await redis.get<PipelineData>(PIPELINE_KEY);
  return data ?? {};
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
  await redis.set(PIPELINE_KEY, data);

  return entry;
}
