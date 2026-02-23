"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check, Send, RefreshCw } from "lucide-react";
import type { Lead } from "@/lib/types";
import {
  OUTREACH_TEMPLATES,
  selectBestTemplate,
  getOutreachContactName,
} from "@/lib/outreach-templates";

interface OutreachModalProps {
  lead: Lead;
  onClose: () => void;
  onSend: (message: string) => void; // marks as outreach_sent
}

export function OutreachModal({ lead, onClose, onSend }: OutreachModalProps) {
  const contactName = getOutreachContactName(lead);
  const bestTemplate = useMemo(() => selectBestTemplate(lead), [lead]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(bestTemplate.id);
  const [copied, setCopied] = useState(false);

  const selectedTemplate = OUTREACH_TEMPLATES.find(
    (t) => t.id === selectedTemplateId
  )!;

  const [message, setMessage] = useState(
    selectedTemplate.generate(lead, contactName)
  );

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = OUTREACH_TEMPLATES.find((t) => t.id === templateId)!;
    setMessage(template.generate(lead, contactName));
  }

  function handleRegenerate() {
    setMessage(selectedTemplate.generate(lead, contactName));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyAndSend() {
    await navigator.clipboard.writeText(message);
    onSend(message);
  }

  const toName = lead.hiringManager?.name
    ? `${lead.hiringManager.name}, ${lead.hiringManager.title}`
    : lead.contacts.length > 0
      ? `${lead.contacts[0].name}, ${lead.contacts[0].title}`
      : "Decision maker";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-600 to-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            <h2 className="text-sm font-bold">
              LinkedIn Message for {lead.company.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Context summary */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 text-xs text-gray-600 space-y-0.5">
          <p>
            <span className="font-medium text-gray-800">To:</span> {toName}
          </p>
          <p>
            <span className="font-medium text-gray-800">Context:</span>{" "}
            {lead.triggerEvent}
          </p>
          <p>
            <span className="font-medium text-gray-800">
              Score: {lead.score}
            </span>{" "}
            &middot; {lead.company.industry} &middot;{" "}
            {lead.company.employeeCount > 0
              ? `${lead.company.employeeCount.toLocaleString()} employees`
              : "Size unknown"}
          </p>
        </div>

        {/* Message editor */}
        <div className="px-5 py-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            className="w-full px-3 py-2.5 text-sm text-gray-800 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 leading-relaxed"
          />
        </div>

        {/* Template selector */}
        <div className="px-5 pb-3 flex items-center gap-2">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
            Template:
          </label>
          <select
            value={selectedTemplateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className="text-xs border border-gray-200 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-400"
          >
            {OUTREACH_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Regenerate
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-md transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleCopyAndSend}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy & Mark Sent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
