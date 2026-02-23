import fs from "fs";
import path from "path";
import type {
  PipelineData,
  PipelineEntry,
  PipelineStage,
  PipelineUser,
} from "./pipeline-types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "pipeline.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readData(): PipelineData {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    return {};
  }
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  return JSON.parse(raw) as PipelineData;
}

function writeData(data: PipelineData): void {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getAllPipelineEntries(): PipelineData {
  return readData();
}

export function getPipelineEntry(leadId: string): PipelineEntry | null {
  const data = readData();
  return data[leadId] ?? null;
}

export function updatePipelineStage(
  leadId: string,
  stage: PipelineStage,
  user: PipelineUser,
  note?: string
): PipelineEntry {
  const data = readData();

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
  writeData(data);

  return entry;
}
