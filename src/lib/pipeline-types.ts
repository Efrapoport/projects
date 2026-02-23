export type PipelineStage =
  | "new"
  | "linkedin_requested"
  | "outreach_sent"
  | "meeting_scheduled"
  | "closed_won"
  | "closed_lost";

export interface PipelineUser {
  name: string;
  email: string;
}

export interface PipelineEvent {
  stage: PipelineStage;
  updatedBy: PipelineUser;
  updatedAt: string; // ISO date
  note?: string;
}

export interface PipelineEntry {
  leadId: string;
  currentStage: PipelineStage;
  history: PipelineEvent[]; // ordered oldest → newest
}

export type PipelineData = Record<string, PipelineEntry>;

// ── Display helpers ─────────────────────────────────────────────────

export const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; bgColor: string; borderColor: string; icon: string }
> = {
  new: {
    label: "New",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    borderColor: "border-gray-200",
    icon: "circle",
  },
  linkedin_requested: {
    label: "LinkedIn Sent",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    borderColor: "border-blue-200",
    icon: "user-plus",
  },
  outreach_sent: {
    label: "Outreach Sent",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    borderColor: "border-purple-200",
    icon: "send",
  },
  meeting_scheduled: {
    label: "Meeting",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    borderColor: "border-amber-200",
    icon: "handshake",
  },
  closed_won: {
    label: "Won",
    color: "text-green-700",
    bgColor: "bg-green-100",
    borderColor: "border-green-200",
    icon: "check",
  },
  closed_lost: {
    label: "Lost",
    color: "text-red-700",
    bgColor: "bg-red-100",
    borderColor: "border-red-200",
    icon: "x",
  },
};

export const STAGE_ORDER: PipelineStage[] = [
  "new",
  "linkedin_requested",
  "outreach_sent",
  "meeting_scheduled",
  "closed_won",
  "closed_lost",
];
