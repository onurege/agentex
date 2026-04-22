"use client";

import { useEffect, useRef } from "react";
import type { BoardroomAgent } from "@/lib/boardroom-agents";

interface AgentDetailDrawerProps {
  agent: BoardroomAgent | null;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onClose: () => void;
}

export function AgentDetailDrawer({
  agent,
  isSelected,
  onSelect,
  onDeselect,
  onClose,
}: AgentDetailDrawerProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!agent) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [agent, onClose]);

  if (!agent) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Drawer */}
      <div className="relative w-full max-w-[480px] bg-workspace-surface border-l border-workspace-border shadow-medium overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-workspace-surface/95 backdrop-blur-sm border-b border-workspace-border/50">
          <h2 className="text-xl font-semibold text-text-primary">
            Ajan Detayı
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-lg
                       text-text-secondary hover:text-text-primary
                       hover:bg-workspace-elevated
                       transition-colors duration-150"
            aria-label="Kapat"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 space-y-8">
          {/* Profile header */}
          <div className="flex flex-col items-center text-center">
            <div
              className={`
                w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-4
                ${
                  isSelected
                    ? "bg-accent-primary/20 ring-2 ring-accent-primary/40 ring-offset-2 ring-offset-workspace-surface"
                    : "bg-workspace-elevated border border-workspace-border"
                }
              `}
            >
              {agent.avatar}
            </div>
            <h3 className="text-2xl font-bold text-text-primary">
              {agent.name}
            </h3>
            <p className="text-lg text-text-secondary mt-1">{agent.title}</p>
          </div>

          {/* Bio */}
          <div>
            <h4 className="text-base font-semibold text-text-primary mb-2">
              Kısa Biyografi
            </h4>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              {agent.bio}
            </p>
          </div>

          {/* Expertise */}
          <div>
            <h4 className="text-base font-semibold text-text-primary mb-3">
              Uzmanlık Alanları
            </h4>
            <ul className="space-y-2">
              {agent.expertise.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-accent-primary mt-0.5 shrink-0">•</span>
                  <span className="text-[16px] text-text-secondary">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Document types */}
          <div>
            <h4 className="text-base font-semibold text-text-primary mb-3">
              Hangi belge türlerinde güçlüdür?
            </h4>
            <div className="flex flex-wrap gap-2">
              {agent.documentTypes.map((dt) => (
                <span
                  key={dt}
                  className="px-3 py-1.5 rounded-lg text-[14px] font-medium
                             bg-workspace-elevated text-text-secondary
                             border border-workspace-border"
                >
                  {dt}
                </span>
              ))}
            </div>
          </div>

          {/* Thinking style */}
          <div>
            <h4 className="text-base font-semibold text-text-primary mb-2">
              Bu ajan nasıl düşünür?
            </h4>
            <p className="text-[16px] text-text-secondary leading-relaxed">
              {agent.thinkingStyle}
            </p>
          </div>
        </div>

        {/* Footer action */}
        <div className="sticky bottom-0 px-6 py-4 bg-workspace-surface/95 backdrop-blur-sm border-t border-workspace-border/50">
          <button
            onClick={() => {
              if (isSelected) {
                onDeselect();
              } else {
                onSelect();
              }
              onClose();
            }}
            className={`
              w-full py-3.5 rounded-xl text-lg font-semibold
              transition-all duration-150 min-h-[52px]
              ${
                isSelected
                  ? "bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50"
                  : "bg-accent-primary text-white border border-accent-primary hover:bg-accent-secondary"
              }
            `}
          >
            {isSelected ? "Seçimi Kaldır" : "Bu Ajanı Seç"}
          </button>
        </div>
      </div>
    </div>
  );
}
