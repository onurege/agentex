"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { BusinessContext } from "@/lib/types";

interface ContextNodeData {
  context: BusinessContext;
  [key: string]: unknown;
}

function ContextNodeInner({ data }: NodeProps) {
  const { context } = data as unknown as ContextNodeData;

  if (!context || context.notes.length === 0) return null;

  return (
    <div
      className="w-[160px] bg-workspace-elevated border-2 border-pixel-purple/40 hover:border-pixel-purple/60 transition-colors relative"
      style={{ boxShadow: '3px 3px 0px rgba(0,0,0,0.4)' }}
    >
      {/* Köşe dekorasyonları */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-pixel-purple/60" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-pixel-purple/60" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-pixel-purple/60" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-pixel-purple/60" />

      {/* Başlık şeridi */}
      <div className="bg-pixel-purple/15 border-b-2 border-pixel-purple/30 px-2.5 py-1 flex items-center gap-1.5">
        <span className="text-xs">💬</span>
        <span className="text-2xs font-mono text-pixel-purple/80 uppercase tracking-wider">
          İŞ BAĞLAMI
        </span>
      </div>

      {/* İçerik */}
      <div className="p-2.5">
        <p className="text-xs font-mono text-text-secondary">
          {context.notes.length} iş notu
        </p>
        <p className="text-2xs font-mono text-text-muted mt-1 leading-relaxed line-clamp-2">
          {context.notes[0]}
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-workspace-surface !border-2 !border-pixel-purple/50 !rounded-none"
      />
    </div>
  );
}

export const ContextNode = memo(ContextNodeInner);
