"use client";

import type { BoardroomAgent } from "@/lib/boardroom-agents";

interface AgentCardProps {
  agent: BoardroomAgent;
  isSelected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  onViewDetail: () => void;
}

export function AgentCard({
  agent,
  isSelected,
  onSelect,
  onDeselect,
  onViewDetail,
}: AgentCardProps) {
  return (
    <div
      className={`
        relative flex flex-col items-center p-6 rounded-xl
        transition-all duration-200
        min-w-[260px] min-h-[280px]
        ${
          isSelected
            ? "bg-accent-primary/10 border-2 border-accent-primary/50 shadow-glow-blue"
            : "bg-workspace-surface border border-workspace-border hover:border-text-muted/30"
        }
      `}
    >
      {/* Selected badge — text, not color-only */}
      {isSelected && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-primary/20 border border-accent-primary/30">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent-primary"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-[13px] font-semibold text-accent-primary">
            Seçildi
          </span>
        </div>
      )}

      {/* Avatar */}
      <div
        className={`
          w-16 h-16 rounded-full flex items-center justify-center text-3xl mb-4
          transition-all duration-200
          ${
            isSelected
              ? "bg-accent-primary/20 ring-2 ring-accent-primary/40 ring-offset-2 ring-offset-workspace-bg"
              : "bg-workspace-elevated border border-workspace-border"
          }
        `}
      >
        {agent.avatar}
      </div>

      {/* Name */}
      <h3 className="font-display text-lg font-semibold text-text-primary text-center leading-tight mb-1">
        {agent.name}
      </h3>

      {/* Title */}
      <p className="text-[15px] text-text-secondary text-center mb-3">
        {agent.title}
      </p>

      {/* Expertise tags */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-3">
        {agent.expertise.slice(0, 3).map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 rounded-md text-[13px] font-medium
                       bg-workspace-elevated text-text-secondary
                       border border-workspace-border"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Character line */}
      <p className="text-[14px] text-text-tertiary text-center italic leading-relaxed mb-5 px-2">
        &ldquo;{agent.characterLine}&rdquo;
      </p>

      {/* Actions */}
      <div className="mt-auto flex items-center gap-3 w-full">
        <button
          onClick={onViewDetail}
          className="flex-1 px-4 py-2.5 rounded-lg text-[15px] font-medium
                     bg-workspace-elevated text-text-secondary
                     border border-workspace-border
                     hover:bg-workspace-border/50 hover:text-text-primary
                     transition-colors duration-150 min-h-[44px]"
        >
          Detayı Gör
        </button>
        <button
          onClick={isSelected ? onDeselect : onSelect}
          className={`
            flex-1 px-4 py-2.5 rounded-lg text-[15px] font-semibold
            transition-all duration-150 min-h-[44px]
            ${
              isSelected
                ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/25"
                : "bg-accent-primary text-white border border-accent-primary hover:bg-accent-secondary"
            }
          `}
        >
          {isSelected ? "Seçimi Kaldır" : "Seç"}
        </button>
      </div>
    </div>
  );
}
