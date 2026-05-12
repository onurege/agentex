// ============================================================
// Prompt Draft Store — Zustand + localStorage
// ============================================================
//
// "consulera_draft_prompt" namespace altında persist edilir;
// soru-cevap tabanlı taslak store'uyla (drf_) çarpışmaz.
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PromptChatMessage,
  PromptDraftDocument,
  PromptDraftSession,
  PromptDraftStatus,
} from "./types";

interface PromptDraftState {
  sessions: Record<string, PromptDraftSession>;

  createSession(): string;
  getSession(id: string): PromptDraftSession | undefined;
  listSessions(): PromptDraftSession[];
  deleteSession(id: string): void;

  appendMessage(sessionId: string, msg: PromptChatMessage): void;
  setStatus(sessionId: string, status: PromptDraftStatus, errorMessage?: string | null): void;
  applyAIResult(
    sessionId: string,
    assistantMessage: PromptChatMessage,
    draft: PromptDraftDocument,
  ): void;
  updateClauseBody(sessionId: string, clauseId: string, nextBody: string): void;
  updateClauseHeading(sessionId: string, clauseId: string, nextHeading: string): void;
  updateTitle(sessionId: string, nextTitle: string): void;
  updatePreamble(sessionId: string, next: string): void;
  updateClosing(sessionId: string, next: string): void;
  /** Server tarafına kaydedilince çağrılır; mevcut session'a server id + timestamp atar. */
  markSaved(sessionId: string, serverId: string, savedAt: string): void;
  /** DB'den yüklenmiş bir session'ı local store'a yerleştirir / overwrite eder. */
  hydrateFromServer(session: PromptDraftSession): void;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function bumpUpdated(s: PromptDraftSession): PromptDraftSession {
  return { ...s, updatedAt: nowISO() };
}

export const useDraftPromptStore = create<PromptDraftState>()(
  persist(
    (set, get) => ({
      sessions: {},

      createSession: () => {
        const id = genId("dpr");
        const now = nowISO();
        const session: PromptDraftSession = {
          id,
          createdAt: now,
          updatedAt: now,
          label: "Yeni prompt taslağı",
          messages: [],
          draft: null,
          status: "empty",
          errorMessage: null,
          serverId: null,
          savedAt: null,
        };
        set((s) => ({ sessions: { ...s.sessions, [id]: session } }));
        return id;
      },

      getSession: (id) => get().sessions[id],

      listSessions: () =>
        Object.values(get().sessions).sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),

      deleteSession: (id) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[id];
          return { sessions: next };
        }),

      appendMessage: (sessionId, msg) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                messages: [...existing.messages, msg],
              }),
            },
          };
        }),

      setStatus: (sessionId, status, errorMessage = null) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({ ...existing, status, errorMessage }),
            },
          };
        }),

      applyAIResult: (sessionId, assistantMessage, draft) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                messages: [...existing.messages, assistantMessage],
                draft,
                label: draft.title || existing.label,
                status: "ready",
                errorMessage: null,
              }),
            },
          };
        }),

      updateClauseBody: (sessionId, clauseId, nextBody) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing || !existing.draft) return s;
          const clauses = existing.draft.clauses.map((c) =>
            c.id === clauseId ? { ...c, body: nextBody } : c,
          );
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                draft: { ...existing.draft, clauses },
              }),
            },
          };
        }),

      updateClauseHeading: (sessionId, clauseId, nextHeading) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing || !existing.draft) return s;
          const clauses = existing.draft.clauses.map((c) =>
            c.id === clauseId ? { ...c, heading: nextHeading } : c,
          );
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                draft: { ...existing.draft, clauses },
              }),
            },
          };
        }),

      updateTitle: (sessionId, nextTitle) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing || !existing.draft) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                label: nextTitle || existing.label,
                draft: { ...existing.draft, title: nextTitle },
              }),
            },
          };
        }),

      updatePreamble: (sessionId, next) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing || !existing.draft) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                draft: { ...existing.draft, preamble: next },
              }),
            },
          };
        }),

      markSaved: (sessionId, serverId, savedAt) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: { ...existing, serverId, savedAt },
            },
          };
        }),

      hydrateFromServer: (session) =>
        set((s) => ({
          sessions: { ...s.sessions, [session.id]: session },
        })),

      updateClosing: (sessionId, next) =>
        set((s) => {
          const existing = s.sessions[sessionId];
          if (!existing || !existing.draft) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: bumpUpdated({
                ...existing,
                draft: { ...existing.draft, closing: next },
              }),
            },
          };
        }),
    }),
    { name: "consulera_draft_prompt" },
  ),
);

export { genId as generatePromptId };
