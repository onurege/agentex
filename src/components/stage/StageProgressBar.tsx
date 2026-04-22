"use client";

import { SITE } from "@/lib/config/site";

export type StageStep = (typeof SITE.stageSteps)[number]["key"];

interface StageProgressBarProps {
  currentStep: StageStep;
}

const STEP_ICONS: Record<StageStep, string> = {
  "agent-gallery": "👥",
  "board-setup": "📋",
  boardroom: "🏛️",
  verdict: "⚖️",
};

function getStepStatus(
  stepIndex: number,
  currentIndex: number,
): "completed" | "active" | "upcoming" {
  if (stepIndex < currentIndex) return "completed";
  if (stepIndex === currentIndex) return "active";
  return "upcoming";
}

export function StageProgressBar({ currentStep }: StageProgressBarProps) {
  const steps = SITE.stageSteps;
  const currentIndex = steps.findIndex((s) => s.key === currentStep);
  const nextStep = currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null;

  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-workspace-border/40 bg-workspace-surface/60 backdrop-blur-sm shrink-0">
      {/* Steps */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const status = getStepStatus(i, currentIndex);
          return (
            <div key={step.key} className="flex items-center">
              {/* Step block */}
              <div
                className={`
                  flex items-center gap-2.5 px-4 py-2 rounded-lg transition-all duration-200
                  ${status === "active"
                    ? "bg-accent-primary/15 border border-accent-primary/40 shadow-glow-blue"
                    : status === "completed"
                      ? "bg-accent-success/10 border border-accent-success/20"
                      : "bg-workspace-bg/50 border border-workspace-border/30"
                  }
                `}
              >
                {/* Status indicator */}
                <div className="flex items-center justify-center w-7 h-7 rounded-full shrink-0">
                  {status === "completed" ? (
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-accent-success"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <span className="text-base">{STEP_ICONS[step.key]}</span>
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col">
                  <span
                    className={`
                      text-[13px] font-mono leading-none
                      ${status === "active"
                        ? "text-accent-primary"
                        : status === "completed"
                          ? "text-accent-success"
                          : "text-text-muted"
                      }
                    `}
                  >
                    {status === "completed"
                      ? "Tamamlandı"
                      : status === "active"
                        ? "Aktif"
                        : `Adım ${step.index}`}
                  </span>
                  <span
                    className={`
                      text-[16px] font-medium leading-tight mt-0.5
                      ${status === "active"
                        ? "text-text-primary"
                        : status === "completed"
                          ? "text-text-secondary"
                          : "text-text-tertiary"
                      }
                    `}
                  >
                    {step.label}
                  </span>
                </div>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div
                  className={`
                    w-8 h-[2px] mx-1
                    ${i < currentIndex
                      ? "bg-accent-success/40"
                      : "bg-workspace-border/40"
                    }
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Next step label */}
      {nextStep && (
        <div className="flex items-center gap-2 text-[16px] shrink-0">
          <span className="text-text-muted">Sıradaki Adım:</span>
          <span className="text-text-primary font-medium">{nextStep.label}</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-text-muted"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      )}

      {/* Completed state */}
      {!nextStep && currentStep === "verdict" && (
        <div className="flex items-center gap-2 text-[16px] shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent-success"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-accent-success font-medium">Tamamlandı</span>
        </div>
      )}
    </div>
  );
}
