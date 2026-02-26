"use client";

import { useState, useRef, useEffect } from "react";
import {
  Circle,
  UserPlus,
  Send,
  Handshake,
  Check,
  X,
  Ban,
  Clock,
} from "lucide-react";
import type { PipelineStage, PipelineEntry } from "@/lib/pipeline-types";
import { STAGE_CONFIG, STAGE_ORDER, IRRELEVANT_REASONS } from "@/lib/pipeline-types";

interface PipelineDropdownProps {
  leadId: string;
  entry: PipelineEntry | null;
  onUpdateStage: (leadId: string, stage: PipelineStage, note?: string) => void;
  onOutreachRequest: () => void;
}

const stageIcons: Record<PipelineStage, React.ReactNode> = {
  new: <Circle className="w-3.5 h-3.5" />,
  linkedin_requested: <UserPlus className="w-3.5 h-3.5" />,
  outreach_sent: <Send className="w-3.5 h-3.5" />,
  meeting_scheduled: <Handshake className="w-3.5 h-3.5" />,
  closed_won: <Check className="w-3.5 h-3.5" />,
  closed_lost: <X className="w-3.5 h-3.5" />,
  irrelevant: <Ban className="w-3.5 h-3.5" />,
};

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PipelineBadge({
  entry,
  onClick,
}: {
  entry: PipelineEntry | null;
  onClick: (e: React.MouseEvent) => void;
}) {
  const currentStage = entry?.currentStage ?? "new";
  const config = STAGE_CONFIG[currentStage];
  const lastEvent =
    entry?.history && entry.history.length > 0
      ? entry.history[entry.history.length - 1]
      : null;

  return (
    <div className="flex flex-col items-start">
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors hover:opacity-80 ${config.bgColor} ${config.color} ${config.borderColor}`}
      >
        {stageIcons[currentStage]}
        {config.label}
      </button>
      {lastEvent && (
        <span className="text-[9px] text-gray-400 mt-0.5 pl-0.5">
          {lastEvent.updatedBy.name.split(" ")[0]} &middot;{" "}
          {formatShortDate(lastEvent.updatedAt)}
        </span>
      )}
    </div>
  );
}

export function PipelineDropdown({
  leadId,
  entry,
  onUpdateStage,
  onOutreachRequest,
}: PipelineDropdownProps) {
  const currentStage = entry?.currentStage ?? "new";
  const [isOpen, setIsOpen] = useState(true);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>(IRRELEVANT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  function handleStageClick(stage: PipelineStage) {
    if (stage === currentStage) return;
    if (stage === "outreach_sent" && currentStage !== "outreach_sent") {
      onOutreachRequest();
      setIsOpen(false);
      return;
    }
    if (stage === "irrelevant") {
      setShowReasonPicker(true);
      return;
    }
    onUpdateStage(leadId, stage);
    setIsOpen(false);
  }

  function handleIrrelevantConfirm() {
    const reason = selectedReason === "Other" ? customReason.trim() || "Other" : selectedReason;
    onUpdateStage(leadId, "irrelevant", reason);
    setIsOpen(false);
  }

  const history = entry?.history ?? [];

  return (
    <div
      ref={dropdownRef}
      className="absolute z-50 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-3">
        {showReasonPicker ? (
          /* ── Reason picker for "Irrelevant" ────────────────────── */
          <>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Why is this lead irrelevant?
            </h4>
            <div className="space-y-1.5">
              {IRRELEVANT_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                    selectedReason === reason
                      ? "bg-slate-100 text-slate-800 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="irrelevant-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="w-3 h-3 text-slate-600"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>
            {selectedReason === "Other" && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Explain why..."
                autoFocus
                className="mt-2 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setShowReasonPicker(false)}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleIrrelevantConfirm}
                disabled={selectedReason === "Other" && !customReason.trim()}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-600 hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </>
        ) : (
          /* ── Stage list ────────────────────────────────────────── */
          <>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Update Pipeline Stage
            </h4>

            <div className="space-y-1">
              {STAGE_ORDER.map((stage) => {
                const config = STAGE_CONFIG[stage];
                const isCurrent = currentStage === stage;

                return (
                  <button
                    key={stage}
                    onClick={() => handleStageClick(stage)}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-sm transition-colors ${
                      isCurrent
                        ? `${config.bgColor} ${config.color} font-medium`
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        isCurrent
                          ? "border-current"
                          : "border-gray-300"
                      }`}
                    >
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                    </span>
                    {stageIcons[stage]}
                    <span className="flex-1">{config.label}</span>
                    {isCurrent && (
                      <span className="text-[9px] text-gray-400 font-normal">
                        current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  History
                </h5>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {history.map((event, i) => (
                    <div key={i} className="text-[10px] text-gray-500 flex items-center gap-1">
                      <span className="font-medium text-gray-600">
                        {event.updatedBy.name.split(" ")[0]}
                      </span>
                      <span>&rarr;</span>
                      <span>{STAGE_CONFIG[event.stage].label}</span>
                      <span className="text-gray-300 ml-auto">
                        {formatEventDate(event.updatedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
