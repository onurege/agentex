"use client";

import { REGULATION_TOPICS } from "@/lib/regulations/topics";
import type { RegulationPriority } from "@/lib/regulations/types";

interface Props {
  selected: Set<string>;
  onToggle: (topicId: string) => void;
}

const PRIORITY_DOT: Record<RegulationPriority, string> = {
  critical: "bg-accent-danger",
  high: "bg-accent-warning",
  medium: "bg-accent-info",
  low: "bg-text-tertiary",
};

export function TopicChips({ selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {REGULATION_TOPICS.map((topic) => {
        const isOn = selected.has(topic.id);
        return (
          <button
            key={topic.id}
            type="button"
            onClick={() => onToggle(topic.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border transition-colors ${
              isOn
                ? "bg-accent-primary/10 border-accent-primary/40 text-text-primary"
                : "bg-workspace-surface border-workspace-border text-text-tertiary hover:text-text-secondary"
            }`}
            title={topic.description}
            aria-pressed={isOn}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${PRIORITY_DOT[topic.priority]}`}
            />
            {topic.label}
          </button>
        );
      })}
    </div>
  );
}
