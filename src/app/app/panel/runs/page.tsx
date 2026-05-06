"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { saveAuditEvent } from "@/lib/audit-log";
import { getPersistenceAdapter } from "@/lib/persistence/factory";
import type { RunListItem } from "@/lib/run-history";

type Scope = "mine" | "group" | "all";

const SCOPE_LABELS: Record<Scope, string> = {
  mine: "Kendim",
  group: "Grubum",
  all: "Hepsi",
};

interface FolderRow {
  id: string;
  name: string;
  ownerId: string;
  groupId: string | null;
  createdAt: string;
  runCount: number;
  isOwn: boolean;
}

// "All" + "Unassigned" pseudo-folders are rendered in the sidebar
// alongside real RunFolder entries; selectedFolderId carries the
// pseudo value so we can run a single filter per render.
const FOLDER_ALL = "__all__";
const FOLDER_UNASSIGNED = "__unassigned__";

const RISK_LABELS: Record<string, { label: string; style: string }> = {
  high: { label: "Yüksek", style: "text-accent-danger bg-accent-danger/10" },
  medium: { label: "Orta", style: "text-accent-warning bg-accent-warning/10" },
  low: { label: "Düşük", style: "text-accent-success bg-accent-success/10" },
};

const MODE_LABELS: Record<string, { label: string; style: string }> = {
  ai: { label: "AI", style: "text-accent-primary bg-accent-primary/10" },
  "ai-partial": { label: "AI Kısmi", style: "text-accent-info bg-accent-info/10" },
  fallback: { label: "Fallback", style: "text-text-muted bg-workspace-elevated" },
};

export default function PanelRunsPage() {
  const [allRuns, setAllRuns] = useState<RunListItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [scope, setScope] = useState<Scope>("group");
  const [resolvedScope, setResolvedScope] = useState<Scope>("group");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>(FOLDER_ALL);
  const [folderDraft, setFolderDraft] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderRenameDraft, setFolderRenameDraft] = useState("");
  const [renamingRunId, setRenamingRunId] = useState<string | null>(null);
  const [runRenameDraft, setRunRenameDraft] = useState("");
  const [movingRunId, setMovingRunId] = useState<string | null>(null);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch("/api/folders");
      if (!res.ok) return;
      setFolders((await res.json()) as FolderRow[]);
    } catch {
      // non-fatal
    }
  }, []);

  const loadRuns = useCallback(async (s: Scope) => {
    const adapter = await getPersistenceAdapter();
    const result = await adapter.runs.listRuns("", { limit: 100, scope: s });
    setAllRuns(result.runs);
    setResolvedScope(result.scope);
  }, []);

  useEffect(() => {
    loadRuns(scope)
      .catch((err) => {
        console.error("[runs] load failed:", err);
        setAllRuns([]);
      })
      .finally(() => setMounted(true));
    void fetchFolders();
  }, [loadRuns, scope, fetchFolders]);

  const createFolder = useCallback(async () => {
    const name = folderDraft.trim();
    if (!name) return;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const folder = (await res.json()) as FolderRow;
    setFolders((rows) => [...rows, folder].sort((a, b) => a.name.localeCompare(b.name)));
    setFolderDraft("");
    setSelectedFolderId(folder.id);
  }, [folderDraft]);

  const deleteFolder = useCallback(async (id: string) => {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    setFolders((rows) => rows.filter((f) => f.id !== id));
    if (selectedFolderId === id) setSelectedFolderId(FOLDER_ALL);
    // Runs in the deleted folder fall back to root — refresh so the
    // affected runs reflect their new folderId=null state in the UI.
    await loadRuns(scope);
  }, [selectedFolderId, loadRuns, scope]);

  const renameFolder = useCallback(async (id: string) => {
    const name = folderRenameDraft.trim();
    if (!name) {
      setRenamingFolderId(null);
      return;
    }
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setFolders((rows) =>
        rows
          .map((f) => (f.id === id ? { ...f, name } : f))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    }
    setRenamingFolderId(null);
  }, [folderRenameDraft]);

  const moveRun = useCallback(async (runId: string, folderId: string | null) => {
    const res = await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    if (res.ok) {
      setAllRuns((rows) =>
        rows.map((r) => (r.id === runId ? { ...r, folderId } : r)),
      );
      // Refresh folder counts.
      void fetchFolders();
    }
    setMovingRunId(null);
  }, [fetchFolders]);

  const renameRun = useCallback(async (runId: string) => {
    const name = runRenameDraft.trim();
    if (!name) {
      setRenamingRunId(null);
      return;
    }
    const res = await fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentName: name }),
    });
    if (res.ok) {
      setAllRuns((rows) =>
        rows.map((r) => (r.id === runId ? { ...r, documentName: name } : r)),
      );
    }
    setRenamingRunId(null);
  }, [runRenameDraft]);

  const handleDelete = useCallback(async (runId: string, docName: string) => {
    const adapter = await getPersistenceAdapter();
    await adapter.runs.deleteRun(runId);
    saveAuditEvent({
      action: "run_deleted",
      targetType: "run",
      targetId: runId,
      summary: `"${docName}" çalıştırması silindi`,
    });
    await loadRuns(scope);
    setDeleteConfirm(null);
  }, [loadRuns, scope]);

  // Filter runs
  let filtered = allRuns;
  if (selectedFolderId === FOLDER_UNASSIGNED) {
    filtered = filtered.filter((r) => r.folderId === null);
  } else if (selectedFolderId !== FOLDER_ALL) {
    filtered = filtered.filter((r) => r.folderId === selectedFolderId);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((r) => r.documentName.toLowerCase().includes(q));
  }
  if (modeFilter !== "all") {
    filtered = filtered.filter((r) => (r.analysisMode ?? "fallback") === modeFilter);
  }
  if (riskFilter !== "all") {
    filtered = filtered.filter((r) => r.verdictSeed.riskLevel === riskFilter);
  }

  const unassignedCount = allRuns.filter((r) => r.folderId === null).length;

  return (
    <div className="flex gap-6">
      {/* Folder sidebar */}
      <aside className="w-[240px] shrink-0">
        <div className="rounded-xl border border-workspace-border bg-workspace-surface p-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-text-muted mb-3">
            Klasörler
          </h3>

          <ul className="space-y-1 mb-4">
            <li>
              <button
                type="button"
                onClick={() => setSelectedFolderId(FOLDER_ALL)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[14px] flex items-center justify-between transition-colors ${
                  selectedFolderId === FOLDER_ALL
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-secondary hover:bg-workspace-elevated"
                }`}
              >
                <span>Tümü</span>
                <span className="text-[12px] text-text-muted">{allRuns.length}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => setSelectedFolderId(FOLDER_UNASSIGNED)}
                className={`w-full text-left px-3 py-2 rounded-lg text-[14px] flex items-center justify-between transition-colors ${
                  selectedFolderId === FOLDER_UNASSIGNED
                    ? "bg-accent-primary/10 text-accent-primary"
                    : "text-text-secondary hover:bg-workspace-elevated"
                }`}
              >
                <span>Atanmamış</span>
                <span className="text-[12px] text-text-muted">{unassignedCount}</span>
              </button>
            </li>
          </ul>

          {folders.length > 0 && (
            <ul className="space-y-1 mb-4 border-t border-workspace-border/40 pt-3">
              {folders.map((f) => (
                <li key={f.id} className="group relative">
                  {renamingFolderId === f.id ? (
                    <input
                      autoFocus
                      value={folderRenameDraft}
                      onChange={(e) => setFolderRenameDraft(e.target.value)}
                      onBlur={() => void renameFolder(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void renameFolder(f.id);
                        } else if (e.key === "Escape") {
                          setRenamingFolderId(null);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg text-[14px] bg-workspace-bg border border-accent-primary/40 text-text-primary outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(f.id)}
                      onDoubleClick={() => {
                        setRenamingFolderId(f.id);
                        setFolderRenameDraft(f.name);
                      }}
                      title="Çift tıkla: yeniden adlandır"
                      className={`w-full text-left px-3 py-2 rounded-lg text-[14px] flex items-center justify-between transition-colors ${
                        selectedFolderId === f.id
                          ? "bg-accent-primary/10 text-accent-primary"
                          : "text-text-secondary hover:bg-workspace-elevated"
                      }`}
                    >
                      <span className="truncate">{f.name}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[12px] text-text-muted">{f.runCount}</span>
                        {f.isOwn && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`"${f.name}" klasörünü sil?`)) void deleteFolder(f.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`"${f.name}" klasörünü sil?`)) void deleteFolder(f.id);
                              }
                            }}
                            className="text-[11px] text-text-muted hover:text-accent-danger opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          >
                            Sil
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 pt-2 border-t border-workspace-border/40">
            <input
              type="text"
              value={folderDraft}
              onChange={(e) => setFolderDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void createFolder();
                }
              }}
              placeholder="Yeni klasör"
              className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[13px] bg-workspace-bg border border-workspace-border text-text-primary placeholder:text-text-muted outline-none focus:border-accent-primary/40"
            />
            <button
              type="button"
              onClick={() => void createFolder()}
              disabled={folderDraft.trim().length === 0}
              className="px-3 py-2 rounded-lg text-[13px] font-semibold bg-accent-primary/10 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Ekle
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary mb-2">Runs</h1>
        <p className="text-lg text-text-secondary">
          Tamamlanan kurul tartışmaları ve sonuçları. {mounted && `${allRuns.length} kayıt`}
        </p>
      </div>

      {mounted && (
        <div className="mb-4 inline-flex rounded-xl border border-workspace-border bg-workspace-surface p-1">
          {(["mine", "group", "all"] as Scope[]).map((s) => {
            const isActive = resolvedScope === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setScope(s)}
                className={`px-4 py-2 text-[14px] font-medium rounded-lg transition-colors ${
                  isActive
                    ? "bg-accent-primary text-white"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {SCOPE_LABELS[s]}
              </button>
            );
          })}
        </div>
      )}

      {/* Search + Filters */}
      {mounted && allRuns.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Belge adı ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary placeholder:text-text-muted text-base min-h-[44px] min-w-[240px] focus:outline-none focus:border-accent-primary/40"
          />
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
          >
            <option value="all">Tüm Modlar</option>
            <option value="ai">AI</option>
            <option value="ai-partial">AI Kısmi</option>
            <option value="fallback">Fallback</option>
          </select>
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg bg-workspace-bg border border-workspace-border text-text-primary text-base min-h-[44px] focus:outline-none focus:border-accent-primary/40"
          >
            <option value="all">Tüm Risk</option>
            <option value="high">Yüksek Risk</option>
            <option value="medium">Orta Risk</option>
            <option value="low">Düşük Risk</option>
          </select>
          {(search || modeFilter !== "all" || riskFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setModeFilter("all"); setRiskFilter("all"); }}
              className="px-3 py-2 rounded-lg text-[14px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Filtreleri Temizle
            </button>
          )}
        </div>
      )}

      {!mounted ? (
        <div className="text-base text-text-muted py-8">Yükleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-workspace-surface border border-workspace-border p-10">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <span className="text-5xl mb-5">📋</span>
            <p className="text-xl font-semibold text-text-primary mb-2">
              {allRuns.length === 0 ? "Henüz çalıştırma kaydı bulunmuyor" : "Filtrelerle eşleşen sonuç yok"}
            </p>
            <p className="text-base text-text-secondary max-w-md">
              {allRuns.length === 0
                ? "Kurul tartışmaları tamamlandığında geçmiş çalıştırmalar burada listelenecek."
                : "Farklı filtreler deneyin veya arama terimini değiştirin."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((run) => {
            const risk = RISK_LABELS[run.verdictSeed.riskLevel] ?? RISK_LABELS.medium;
            const mode = MODE_LABELS[run.analysisMode ?? "fallback"] ?? MODE_LABELS.fallback;
            const expertCount = run.agentSnapshots.filter((a) => !a.isChief).length;
            const date = new Date(run.createdAt);
            const hasCustomPrompt = run.agentSnapshots.some((a) => a.promptSnapshot !== null);
            const isDeleting = deleteConfirm === run.id;

            return (
              <div
                key={run.id}
                className="flex items-center gap-4 p-5 rounded-xl bg-workspace-surface border border-workspace-border hover:border-accent-primary/20 transition-colors"
              >
                {/* Document icon */}
                <div className="w-12 h-12 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-accent-primary uppercase font-mono">
                    {run.documentName.split(".").pop()?.toUpperCase() ?? "DOC"}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {renamingRunId === run.id ? (
                    <input
                      autoFocus
                      value={runRenameDraft}
                      onChange={(e) => setRunRenameDraft(e.target.value)}
                      onBlur={() => void renameRun(run.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void renameRun(run.id);
                        } else if (e.key === "Escape") {
                          setRenamingRunId(null);
                        }
                      }}
                      className="w-full text-lg font-semibold text-text-primary px-2 py-1 rounded-md bg-workspace-bg border border-accent-primary/40 outline-none"
                    />
                  ) : (
                    <p
                      className="text-lg font-semibold text-text-primary truncate cursor-text"
                      title="Çift tıkla: yeniden adlandır"
                      onDoubleClick={() => {
                        setRenamingRunId(run.id);
                        setRunRenameDraft(run.documentName);
                      }}
                    >
                      {run.documentName}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base text-text-secondary">
                      {date.toLocaleDateString("tr-TR")} · {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-[13px] text-text-muted">· {expertCount} ajan</span>
                    {!run.isOwn && (
                      <span className="text-[12px] text-text-muted">
                        · Sahibi: <span className="font-medium text-text-secondary">{run.ownerName ?? run.ownerEmail}</span>
                      </span>
                    )}
                    {run.groupName && (
                      <span className="text-[11px] font-mono font-semibold text-accent-primary bg-accent-primary/10 px-1.5 py-0.5 rounded">
                        Grup: {run.groupName}
                      </span>
                    )}
                    {hasCustomPrompt && (
                      <span className="text-[11px] font-mono font-semibold text-accent-info bg-accent-info/10 px-1.5 py-0.5 rounded">
                        Özel Prompt
                      </span>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${mode.style}`}>
                  {mode.label}
                </span>
                <span className={`text-[13px] font-semibold px-3 py-1 rounded-full shrink-0 ${risk.style}`}>
                  {risk.label}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/app/runs/${run.id}`}
                    className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-accent-primary text-workspace-surface border border-accent-primary hover:bg-accent-secondary transition-colors min-h-[40px]"
                  >
                    Görüntüle
                  </Link>
                  <Link
                    href={`/app/runs/${run.id}/boardroom`}
                    className="px-4 py-2.5 rounded-lg text-[14px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 hover:text-text-primary transition-colors min-h-[40px]"
                  >
                    Oynat
                  </Link>
                  <a
                    href={`/api/runs/${run.id}/redline`}
                    title="Redline DOCX İndir (track-changes)"
                    className="px-3 py-2.5 rounded-lg text-[13px] font-medium bg-accent-primary/10 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/20 transition-colors min-h-[40px] inline-flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Redline
                  </a>
                  <a
                    href={`/api/runs/${run.id}/original`}
                    title="Orijinal DOCX İndir"
                    className="px-3 py-2.5 rounded-lg text-[13px] font-medium bg-workspace-elevated text-text-secondary border border-workspace-border hover:bg-workspace-border/50 hover:text-text-primary transition-colors min-h-[40px] inline-flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Orijinal
                  </a>

                  {/* Move to folder — opens an inline select on click */}
                  {movingRunId === run.id ? (
                    <select
                      autoFocus
                      value={run.folderId ?? ""}
                      onChange={(e) =>
                        void moveRun(run.id, e.target.value === "" ? null : e.target.value)
                      }
                      onBlur={() => setMovingRunId(null)}
                      className="px-3 py-2 rounded-lg text-[13px] font-medium bg-workspace-bg border border-accent-primary/40 text-text-primary outline-none min-h-[40px]"
                    >
                      <option value="">— atanmamış —</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMovingRunId(run.id)}
                      title="Klasöre taşı"
                      className="px-3 py-2.5 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-primary hover:bg-workspace-elevated border border-transparent hover:border-workspace-border transition-colors min-h-[40px] inline-flex items-center gap-1.5"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      {run.folderId
                        ? folders.find((f) => f.id === run.folderId)?.name ?? "Klasör"
                        : "Taşı"}
                    </button>
                  )}

                  {/* Delete */}
                  {isDeleting ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(run.id, run.documentName)}
                        className="px-3 py-2 rounded-lg text-[13px] font-semibold bg-accent-danger/15 text-accent-danger border border-accent-danger/30 hover:bg-accent-danger/25 transition-colors min-h-[40px]"
                      >
                        Onayla
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-2 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-secondary transition-colors min-h-[40px]"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(run.id)}
                      disabled={!run.isOwn}
                      className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 border border-transparent hover:border-accent-danger/20 transition-colors min-h-[40px] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-muted disabled:hover:border-transparent"
                      title={run.isOwn ? "Sil" : "Sadece sahibi silebilir"}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
