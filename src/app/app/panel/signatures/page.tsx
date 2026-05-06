"use client";

// ============================================================
// Panel → İmza Onayları (T-6)
// ============================================================
//
// Lists SignaturePrecheck records visible to the viewer per the
// scope rules (super_admin sees all, group sees own + group). The
// stage-2 manager review controls (Onayla / Reddet) render only for
// authorized_user / super_admin; super_admin can override prior
// decisions. Other viewers see the queue as read-only — that's the
// 'transparency' bit.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Inbox,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface PrecheckRow {
  id: string;
  ownerId: string;
  ownerName: string | null;
  ownerEmail: string;
  groupId: string | null;
  sirkuFileName: string;
  petitionFileName: string;
  externalStatus: "matched" | "mismatch" | "unknown" | null;
  externalNote: string | null;
  userDecision: "approved" | "rejected";
  userDecisionNote: string | null;
  criticalOverride: boolean;
  decidedAt: string;
  managerReviewRequested: boolean;
  managerReviewedBy: string | null;
  managerReviewerName: string | null;
  managerReviewedAt: string | null;
  managerDecision: "approved" | "rejected" | null;
  managerDecisionNote: string | null;
  createdAt: string;
  isOwn: boolean;
}

type Filter = "all" | "pending" | "decided";

const FILTER_LABELS: Record<Filter, string> = {
  all: "Tümü",
  pending: "Onay Bekleyen",
  decided: "Karara Bağlanmış",
};

const EXTERNAL_LABEL: Record<NonNullable<PrecheckRow["externalStatus"]>, string> = {
  matched: "Eşleşiyor",
  mismatch: "Eşleşmiyor",
  unknown: "Belirsiz",
};

export default function PanelSignaturesPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "user";
  const canDecide = role === "authorized_user" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const [rows, setRows] = useState<PrecheckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<
    Record<string, { decision: "approved" | "rejected" | null; note: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (f: Filter) => {
    setLoading(true);
    setError(null);
    try {
      const url =
        f === "all"
          ? "/api/signatures/precheck-records"
          : `/api/signatures/precheck-records?filter=${f}`;
      const res = await fetch(url);
      if (!res.ok) {
        setError("Kayıtlar yüklenemedi");
        return;
      }
      setRows((await res.json()) as PrecheckRow[]);
    } catch {
      setError("Ağ hatası");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows(filter);
  }, [fetchRows, filter]);

  const counts = useMemo(() => {
    const pending = rows.filter(
      (r) => r.managerReviewRequested && r.managerDecision === null,
    ).length;
    return { total: rows.length, pending };
  }, [rows]);

  async function submitDecision(
    id: string,
    decision: "approved" | "rejected",
    note: string,
  ) {
    if (decision === "rejected" && note.trim().length === 0) {
      setError("Red sebebi zorunlu");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/signatures/precheck-records/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manager_decide",
          decision,
          note: note.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Karar kaydedilemedi");
        return;
      }
      void fetchRows(filter);
      setDecisionDraft((d) => ({ ...d, [id]: { decision: null, note: "" } }));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">
          İmza Onayları
        </h1>
        <p className="text-lg text-text-secondary">
          Kullanıcıların gönderdiği imza sirküsü ve belge ön kontrolleri ile karar
          durumları. {counts.pending > 0 && (
            <span className="inline-flex items-center gap-1 text-accent-warning font-semibold ml-1">
              <AlertCircle size={16} /> {counts.pending} kayıt yönetici onayı bekliyor
            </span>
          )}
        </p>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-workspace-border bg-workspace-surface p-1">
        {(["pending", "decided", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors ${
              filter === f
                ? "bg-accent-primary text-white"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-accent-danger/30 bg-accent-danger/[0.06] px-4 py-3 text-[14px] text-accent-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-base text-text-muted py-8">Yükleniyor...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-10 flex flex-col items-center text-center">
          <Inbox size={48} className="text-text-muted mb-3" />
          <p className="text-xl font-semibold text-text-primary mb-1">
            {filter === "pending"
              ? "Bekleyen onay yok"
              : filter === "decided"
                ? "Karar verilmiş kayıt yok"
                : "Henüz kayıt yok"}
          </p>
          <p className="text-base text-text-secondary">
            Kullanıcılar imza ön-kontrol kararı kaydettiğinde buraya düşer.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const draft =
              decisionDraft[r.id] ?? { decision: null, note: "" };
            const decisionLocked =
              r.managerDecision !== null && !isSuperAdmin;
            const showManagerControls =
              canDecide && r.managerReviewRequested && !decisionLocked;
            const isBusy = busyId === r.id;

            return (
              <div
                key={r.id}
                className="rounded-xl bg-workspace-surface border border-workspace-border p-5"
              >
                <header className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} className="text-accent-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-primary">
                      {r.sirkuFileName}{" "}
                      <span className="text-text-muted font-normal">↔</span>{" "}
                      {r.petitionFileName}
                    </p>
                    <p className="text-[13px] text-text-muted mt-0.5">
                      {new Date(r.createdAt).toLocaleString("tr-TR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      · Sahibi:{" "}
                      <span className="text-text-secondary">
                        {r.ownerName ?? r.ownerEmail}
                      </span>
                    </p>
                  </div>
                  <StatusBadges row={r} />
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <DetailBlock title="TTSG sonucu">
                    {r.externalStatus ? (
                      <>
                        <span className="font-semibold text-text-primary">
                          {EXTERNAL_LABEL[r.externalStatus]}
                        </span>
                        {r.externalNote && (
                          <p className="text-[13px] text-text-secondary mt-1">
                            {r.externalNote}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-text-muted">Doğrulama yok</span>
                    )}
                  </DetailBlock>

                  <DetailBlock title="Kullanıcı kararı">
                    <span
                      className={`font-semibold ${
                        r.userDecision === "approved"
                          ? "text-accent-success"
                          : "text-accent-danger"
                      }`}
                    >
                      {r.userDecision === "approved" ? "Onayladı" : "Reddetti"}
                    </span>
                    {r.userDecisionNote && (
                      <p className="text-[13px] text-text-secondary mt-1">
                        {r.userDecisionNote}
                      </p>
                    )}
                  </DetailBlock>
                </div>

                {(r.managerDecision || r.managerReviewRequested) && (
                  <div className="rounded-lg bg-workspace-bg border border-workspace-border/60 p-3 mb-3">
                    <p className="text-[12px] uppercase tracking-wide text-text-muted font-semibold mb-1">
                      Yönetici Onayı
                    </p>
                    {r.managerDecision ? (
                      <>
                        <span
                          className={`font-semibold ${
                            r.managerDecision === "approved"
                              ? "text-accent-success"
                              : "text-accent-danger"
                          }`}
                        >
                          {r.managerDecision === "approved"
                            ? "Onaylandı"
                            : "Reddedildi"}
                        </span>{" "}
                        <span className="text-[13px] text-text-muted">
                          —{" "}
                          {r.managerReviewerName ?? "—"}
                          {r.managerReviewedAt &&
                            ` · ${new Date(r.managerReviewedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}`}
                        </span>
                        {r.managerDecisionNote && (
                          <p className="text-[13px] text-text-secondary mt-1">
                            {r.managerDecisionNote}
                          </p>
                        )}
                      </>
                    ) : (
                      <span className="text-accent-warning font-semibold">
                        Onay bekliyor
                      </span>
                    )}
                  </div>
                )}

                {showManagerControls && (
                  <div className="border-t border-workspace-border/40 pt-3">
                    <p className="text-[13px] font-semibold text-text-secondary mb-2">
                      {r.managerDecision !== null && isSuperAdmin
                        ? "Mevcut kararı override et:"
                        : "Yönetici kararını ver:"}
                    </p>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setDecisionDraft((d) => ({
                            ...d,
                            [r.id]: { ...draft, decision: "approved" },
                          }))
                        }
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-semibold border transition-colors ${
                          draft.decision === "approved"
                            ? "border-accent-success bg-accent-success/10 text-accent-success"
                            : "border-workspace-border text-text-secondary hover:border-accent-success/40"
                        }`}
                      >
                        <ShieldCheck size={16} />
                        Onayla
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setDecisionDraft((d) => ({
                            ...d,
                            [r.id]: { ...draft, decision: "rejected" },
                          }))
                        }
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[14px] font-semibold border transition-colors ${
                          draft.decision === "rejected"
                            ? "border-accent-danger bg-accent-danger/10 text-accent-danger"
                            : "border-workspace-border text-text-secondary hover:border-accent-danger/40"
                        }`}
                      >
                        <XCircle size={16} />
                        Reddet
                      </button>
                    </div>
                    {draft.decision && (
                      <>
                        <textarea
                          value={draft.note}
                          onChange={(e) =>
                            setDecisionDraft((d) => ({
                              ...d,
                              [r.id]: { ...draft, note: e.target.value },
                            }))
                          }
                          placeholder={
                            draft.decision === "rejected"
                              ? "Red sebebi (zorunlu)"
                              : "Not (opsiyonel)"
                          }
                          className="w-full rounded-lg bg-workspace-bg border border-workspace-border px-3 py-2 text-[14px] text-text-primary min-h-[64px] resize-none focus:outline-none focus:border-accent-primary/40 mb-2"
                        />
                        <button
                          type="button"
                          disabled={
                            isBusy ||
                            (draft.decision === "rejected" &&
                              draft.note.trim().length === 0)
                          }
                          onClick={() =>
                            void submitDecision(
                              r.id,
                              draft.decision!,
                              draft.note,
                            )
                          }
                          className="px-4 py-2 rounded-lg text-[14px] font-semibold bg-accent-primary text-white hover:bg-accent-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isBusy ? "Kaydediliyor..." : "Kararı kaydet"}
                        </button>
                      </>
                    )}
                  </div>
                )}

                {r.managerDecision !== null && !isSuperAdmin && canDecide && (
                  <p className="text-[12px] text-text-muted italic mt-1">
                    Karar kilitli — yalnızca super admin override edebilir.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-workspace-bg border border-workspace-border/60 p-3">
      <p className="text-[12px] uppercase tracking-wide text-text-muted font-semibold mb-1">
        {title}
      </p>
      {children}
    </div>
  );
}

function StatusBadges({ row }: { row: PrecheckRow }) {
  const badges: React.ReactNode[] = [];
  if (row.criticalOverride) {
    badges.push(
      <span
        key="override"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-semantic-negative/10 text-semantic-negative border border-semantic-negative/40"
        title="Kullanıcı, ön kontroldeki kritik uyumsuzluğa rağmen imza karşılaştırmasına manuel onayla devam etti."
      >
        <ShieldAlert size={10} className="inline mr-1" />
        Kullanıcı kritik uyarıyı geçti
      </span>,
    );
  }
  if (row.managerDecision === "approved") {
    badges.push(
      <span
        key="ma"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-success/10 text-accent-success border border-accent-success/30"
      >
        Yönetici: Onaylandı
      </span>,
    );
  } else if (row.managerDecision === "rejected") {
    badges.push(
      <span
        key="mr"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-danger/10 text-accent-danger border border-accent-danger/30"
      >
        Yönetici: Reddedildi
      </span>,
    );
  } else if (row.managerReviewRequested) {
    badges.push(
      <span
        key="pending"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-warning/10 text-accent-warning border border-accent-warning/30"
      >
        Onay Bekliyor
      </span>,
    );
  }
  if (row.userDecision === "rejected") {
    badges.push(
      <span
        key="ur"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent-danger/10 text-accent-danger border border-accent-danger/30"
      >
        <ShieldAlert size={10} className="inline mr-1" />
        Kullanıcı reddetti
      </span>,
    );
  } else {
    badges.push(
      <span
        key="ua"
        className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-workspace-elevated text-text-muted border border-workspace-border"
      >
        <CheckCircle2 size={10} className="inline mr-1" />
        Kullanıcı onayladı
      </span>,
    );
  }
  return <div className="flex flex-wrap gap-1.5 shrink-0">{badges}</div>;
}
