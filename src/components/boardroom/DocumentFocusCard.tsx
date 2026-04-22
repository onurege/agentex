"use client";

interface DocumentFocusCardProps {
  fileName: string;
  currentTopic: string | null;
}

export function DocumentFocusCard({ fileName, currentTopic }: DocumentFocusCardProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 py-3">
      {/* File type badge */}
      <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center mb-2">
        <span className="text-[11px] font-bold text-accent-primary uppercase font-mono">
          {fileName.split(".").pop()?.toUpperCase() ?? "DOC"}
        </span>
      </div>

      {/* File name */}
      <p className="text-[14px] font-medium text-text-primary truncate max-w-[180px]">
        {fileName}
      </p>

      {/* Current topic */}
      {currentTopic && (
        <div className="mt-2 px-3 py-1 rounded-md bg-accent-primary/10 border border-accent-primary/20">
          <p className="text-[12px] font-mono text-accent-primary truncate max-w-[160px]">
            {currentTopic}
          </p>
        </div>
      )}
    </div>
  );
}
