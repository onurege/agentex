"use client";

import { useEffect, useState } from "react";
import { getPersistenceMode } from "@/lib/persistence/factory";
import {
  hasLocalDataToMigrate,
  markMigrationDismissed,
  migrateLocalToServer,
  type MigrationSummary,
} from "@/lib/persistence/migrate-local";

type Status = "idle" | "running" | "done" | "error";

export function MigrationBanner() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Only show in db mode with unmigrated local data.
    if (getPersistenceMode() !== "db") return;
    if (hasLocalDataToMigrate()) setVisible(true);
  }, []);

  if (!visible) return null;

  const handleMigrate = async () => {
    setStatus("running");
    setErrorMsg(null);
    try {
      const result = await migrateLocalToServer();
      setSummary(result);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDismiss = () => {
    markMigrationDismissed();
    setVisible(false);
  };

  const handleClose = () => {
    setVisible(false);
  };

  if (status === "done" && summary) {
    return (
      <div className="rounded-xl bg-accent-success/10 border border-accent-success/30 p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-accent-success mb-1">
              Aktarım tamamlandı
            </h3>
            <p className="text-[14px] text-text-secondary">
              {summary.runs.imported} çalıştırma, {summary.audit.imported} denetim
              olayı ve {summary.agents.synced} ajan profili sunucuya aktarıldı.
              {(summary.runs.skipped > 0 || summary.audit.skipped > 0) && (
                <>
                  {" "}
                  ({summary.runs.skipped + summary.audit.skipped} kayıt önceden
                  mevcuttu.)
                </>
              )}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary text-[20px] leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-accent-info/10 border border-accent-info/30 p-5 mb-6">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Yerel verileriniz bulundu
          </h3>
          <p className="text-[14px] text-text-secondary leading-relaxed">
            Önceki oturumlarınıza ait çalıştırmalar, denetim günlüğü ve ajan
            özelleştirmeleri yerel depolamada duruyor. Bunları sunucuya
            aktarmak ister misiniz? Aktarım idempotenttir — sonradan tekrar
            çalıştırılabilir.
          </p>
          {status === "error" && errorMsg && (
            <p className="mt-3 text-[13px] text-accent-danger">
              Hata: {errorMsg}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={handleMigrate}
            disabled={status === "running"}
            className="px-4 py-2 rounded-lg text-[14px] font-semibold
                       bg-accent-primary text-workspace-surface border border-accent-primary
                       hover:bg-accent-secondary transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {status === "running" ? "Aktarılıyor…" : "Aktar"}
          </button>
          <button
            onClick={handleDismiss}
            disabled={status === "running"}
            className="px-4 py-2 rounded-lg text-[14px] font-medium
                       bg-transparent text-text-secondary border border-workspace-border
                       hover:bg-workspace-elevated transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Yoksay
          </button>
        </div>
      </div>
    </div>
  );
}
