// ============================================================
// Draft Module — Zustand Store
// ============================================================
//
// Sıfırdan sözleşme oturumları. Her oturum bir şablon üstünde
// kullanıcının doldurduğu cevaplar + kapattığı opsiyonel maddeler
// + AI önerisi kabul edilen override'lardan ibaret. LocalStorage'a
// ayrı namespace altında persist edilir (boardroom + compare ile
// çarpışmaz).
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  DraftSession,
  DraftStatus,
  TemplateId,
} from "./types";

interface DraftState {
  sessions: Record<string, DraftSession>;
  currentSessionId: string | null;

  createSession(templateId: TemplateId): string;
  getSession(id: string): DraftSession | undefined;
  listSessions(): DraftSession[];
  updateAnswer(sessionId: string, questionId: string, value: unknown): void;
  toggleClause(sessionId: string, clauseId: string, enabled: boolean): void;
  acceptAISuggestion(
    sessionId: string,
    clauseId: string,
    text: string,
  ): void;
  setManualEdit(
    sessionId: string,
    clauseId: string,
    field: "title" | "body",
    value: string,
  ): void;
  clearManualEdit(sessionId: string, clauseId: string): void;
  setStatus(sessionId: string, status: DraftStatus): void;
  deleteSession(id: string): void;
}

function generateId(): string {
  return `drf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentSessionId: null,

      createSession: (templateId) => {
        const id = generateId();
        const now = new Date().toISOString();
        const session: DraftSession = {
          id,
          templateId,
          createdAt: now,
          updatedAt: now,
          status: "draft",
          answers: {},
          aiAccepted: {},
          disabledClauses: [],
          manualEdits: {},
        };
        set((s) => ({
          sessions: { ...s.sessions, [id]: session },
          currentSessionId: id,
        }));
        return id;
      },

      getSession: (id) => get().sessions[id],

      listSessions: () =>
        Object.values(get().sessions).sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),

      updateAnswer: (sessionId, questionId, value) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                answers: { ...session.answers, [questionId]: value },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      toggleClause: (sessionId, clauseId, enabled) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          const disabled = new Set(session.disabledClauses);
          if (enabled) disabled.delete(clauseId);
          else disabled.add(clauseId);
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                disabledClauses: Array.from(disabled),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      acceptAISuggestion: (sessionId, clauseId, text) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                aiAccepted: { ...session.aiAccepted, [clauseId]: text },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setManualEdit: (sessionId, clauseId, field, value) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          const current = session.manualEdits ?? {};
          const existing = current[clauseId] ?? {};
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                manualEdits: {
                  ...current,
                  [clauseId]: { ...existing, [field]: value },
                },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      clearManualEdit: (sessionId, clauseId) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          const next = { ...(session.manualEdits ?? {}) };
          delete next[clauseId];
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                manualEdits: next,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setStatus: (sessionId, status) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                status,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      deleteSession: (id) =>
        set((s) => {
          const next = { ...s.sessions };
          delete next[id];
          return {
            sessions: next,
            currentSessionId:
              s.currentSessionId === id ? null : s.currentSessionId,
          };
        }),
    }),
    {
      name: "agentex-draft-v1",
      partialize: (s) => ({
        sessions: s.sessions,
        currentSessionId: s.currentSessionId,
      }),
    },
  ),
);
