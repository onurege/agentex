"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { UploadedDocument } from "@/lib/types";
import { formatFileSize } from "@/lib/utils";

interface DocumentNodeData {
  document: UploadedDocument;
  [key: string]: unknown;
}

function DocumentNodeInner({ data }: NodeProps) {
  const { document } = data as unknown as DocumentNodeData;

  if (!document) return null;

  return (
    <div
      className="w-[160px] bg-workspace-elevated border-2 border-accent-info/40 hover:border-accent-info/60 transition-colors relative"
      style={{ boxShadow: '3px 3px 0px rgba(0,0,0,0.4)' }}
    >
      {/* Köşe dekorasyonları */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-accent-info/60" />
      <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-accent-info/60" />
      <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-accent-info/60" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-accent-info/60" />

      {/* Başlık şeridi */}
      <div className="bg-accent-info/15 border-b-2 border-accent-info/30 px-2.5 py-1 flex items-center gap-1.5">
        <span className="text-xs">📄</span>
        <span className="text-2xs font-mono text-accent-info/80 uppercase tracking-wider">
          SÖZLEŞME
        </span>
      </div>

      {/* İçerik */}
      <div className="p-2.5">
        <p className="text-xs font-mono font-medium text-text-primary truncate">
          {document.name}
        </p>
        <p className="text-2xs font-mono text-text-muted mt-1">
          📏 {formatFileSize(document.size)}
        </p>
        <p className="text-2xs font-mono text-text-muted">
          📖 {document.pageCount} sayfa
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-workspace-surface !border-2 !border-accent-info/50 !rounded-none"
      />
    </div>
  );
}

export const DocumentNode = memo(DocumentNodeInner);
