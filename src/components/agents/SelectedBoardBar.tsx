"use client";

import Link from "next/link";
import type { BoardroomAgent } from "@/lib/boardroom-agents";
import { MIN_BOARD_SIZE } from "@/lib/boardroom-agents";
import { SITE } from "@/lib/config/site";

interface SelectedBoardBarProps {
  selectedAgents: BoardroomAgent[];
}

export function SelectedBoardBar({ selectedAgents }: SelectedBoardBarProps) {
  const count = selectedAgents.length;
  const canContinue = count >= MIN_BOARD_SIZE;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-workspace-surface/95 backdrop-blur-md border-t border-workspace-border shadow-medium">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        {/* Left — selected agents */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Avatars */}
          {count > 0 ? (
            <div className="flex -space-x-2 shrink-0">
              {selectedAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="w-11 h-11 rounded-full bg-accent-primary/15 border-2 border-workspace-surface
                             flex items-center justify-center text-xl
                             ring-1 ring-accent-primary/30"
                  title={agent.name}
                >
                  {agent.avatar}
                </div>
              ))}
            </div>
          ) : null}

          {/* Count text */}
          <div className="flex flex-col min-w-0">
            <span className="text-[13px] font-mono text-text-muted uppercase tracking-wide">
              Seçilen Kurul
            </span>
            <span className="text-lg font-medium text-text-primary">
              {count === 0
                ? "Henüz ajan seçilmedi"
                : `${count} ajan seçildi`}
            </span>
          </div>
        </div>

        {/* Right — CTA */}
        {canContinue ? (
          <Link
            href={SITE.paths.setup}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-lg font-semibold
                       bg-accent-primary text-white border border-accent-primary
                       hover:bg-accent-secondary
                       transition-all duration-150 min-h-[52px] shrink-0"
          >
            <span>Kurulu Oluştur</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        ) : (
          <div className="flex flex-col items-end shrink-0">
            <button
              disabled
              className="px-8 py-3.5 rounded-xl text-lg font-semibold
                         bg-workspace-elevated text-text-muted
                         border border-workspace-border
                         cursor-not-allowed min-h-[52px]"
            >
              Kurulu Oluştur
            </button>
            {count > 0 && count < MIN_BOARD_SIZE && (
              <span className="text-[13px] text-text-muted mt-1.5">
                En az {MIN_BOARD_SIZE} ajan seçin
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
