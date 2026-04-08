"use client";

import { useWorkspaceStore } from "@/lib/store";
import { Zap } from "lucide-react";

const PIXEL_CHARS = ["👔", "📊", "⚖️", "🧮", "🤝", "🚀"];

export function CanvasEmptyState() {
  const loadDemo = useWorkspaceStore((s) => s.loadDemoScenario);

  return (
    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
      <div className="text-center space-y-6 pointer-events-auto max-w-[400px] px-4">

        {/* Pixel ofis sahnesi */}
        <div className="flex items-end justify-center gap-3 mb-2">
          {/* Masa */}
          <div className="relative">
            {/* Boş masa — kağıtlar */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {PIXEL_CHARS.slice(0,3).map((ch, i) => (
                <div
                  key={i}
                  className="w-9 h-9 bg-workspace-elevated border border-workspace-border flex items-center justify-center text-lg opacity-30"
                  style={{ boxShadow: '2px 2px 0px rgba(0,0,0,0.4)' }}
                >
                  {ch}
                </div>
              ))}
            </div>
            {/* Masa yüzeyi */}
            <div
              className="h-2 bg-workspace-surface border-t-2 border-workspace-border"
              style={{ width: '140px', boxShadow: '0 3px 0px rgba(0,0,0,0.4)' }}
            />
            {/* Masa ayakları */}
            <div className="flex justify-between px-2">
              <div className="w-1.5 h-4 bg-workspace-border" />
              <div className="w-1.5 h-4 bg-workspace-border" />
            </div>
          </div>

          {/* Boş sandalye */}
          <div className="opacity-20 mb-3">
            <div className="w-8 h-6 bg-workspace-elevated border border-workspace-border mx-auto" />
            <div className="w-6 h-1 bg-workspace-border mx-auto" />
            <div className="flex justify-between px-0.5">
              <div className="w-1 h-3 bg-workspace-border" />
              <div className="w-1 h-3 bg-workspace-border" />
            </div>
          </div>
        </div>

        {/* Başlık */}
        <div>
          <div
            className="inline-block bg-accent-primary/10 border border-accent-primary/30 px-3 py-1 mb-3"
            style={{ boxShadow: '2px 2px 0px rgba(0,0,0,0.4)' }}
          >
            <span className="font-mono text-xs text-accent-primary">📋 TOPLANTI ODASI BOŞ</span>
          </div>
          <h2 className="text-sm font-semibold text-text-primary font-mono">
            Sözleşme İnceleme Çalışma Alanı
          </h2>
          <p className="text-xs text-text-secondary mt-2 font-mono leading-relaxed">
            Ekip, toplantı odasında toplanmayı bekliyor.<br />
            Bir sözleşme yükle ve masayı doldur.
          </p>
        </div>

        {/* Adımlar — pixel art tarzı ok zinciri */}
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {[
            { icon: "📄", label: "Yükle" },
            { icon: "→", label: "" },
            { icon: "💬", label: "Bağlam" },
            { icon: "→", label: "" },
            { icon: "🤖", label: "Ajan Ekle" },
            { icon: "→", label: "" },
            { icon: "▶", label: "Başlat" },
          ].map((step, i) => (
            step.icon === "→"
              ? <span key={i} className="text-text-muted font-mono text-xs">→</span>
              : (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className="w-8 h-8 bg-workspace-elevated border border-workspace-border flex items-center justify-center text-sm"
                    style={{ boxShadow: '1px 1px 0px rgba(0,0,0,0.4)' }}
                  >
                    {step.icon}
                  </div>
                  {step.label && (
                    <span className="text-2xs text-text-muted font-mono">{step.label}</span>
                  )}
                </div>
              )
          ))}
        </div>

        {/* Demo butonu */}
        <button
          onClick={() => loadDemo()}
          className="pixel-btn inline-flex items-center gap-2 px-4 py-2 text-xs font-mono text-accent-primary bg-accent-primary/10 border-2 border-accent-primary/40 hover:bg-accent-primary/20 transition-colors"
        >
          <Zap size={12} />
          DEMO SENARYOSU YÜKLE
        </button>
      </div>
    </div>
  );
}
