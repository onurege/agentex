// ============================================================
// Signatures Module — Zustand Store
// ============================================================
//
// İmza karşılaştırma oturumları. Boardroom / Compare / Draft ile
// izole; kendi localStorage namespace'i. Privacy için page image
// + signature data URL'leri localStorage'a yazar; kullanıcı cihaz
// dışına çıkmaz. Büyük dosyalarda storage quota sorunu çıkarsa
// partialize'dan çıkarılabilir (MVP kapsamı dışı).
// ============================================================

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ComparisonResult,
  CropRegion,
  SignatureSession,
  SignatureSource,
} from "./types";
import { EMPTY_SOURCE } from "./types";

type Side = "contract" | "reference";

interface SignaturesState {
  sessions: Record<string, SignatureSession>;
  currentSessionId: string | null;

  createSession(): string;
  getSession(id: string): SignatureSession | undefined;
  listSessions(): SignatureSession[];

  setSource(sessionId: string, side: Side, source: SignatureSource): void;
  setCrop(sessionId: string, side: Side, crop: CropRegion | null): void;
  setSignatureImage(
    sessionId: string,
    side: Side,
    dataUrl: string | null,
  ): void;
  setResult(sessionId: string, result: ComparisonResult | null): void;

  clearSource(sessionId: string, side: Side): void;
  deleteSession(id: string): void;
}

function generateId(): string {
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptySession(id: string): SignatureSession {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    contract: { ...EMPTY_SOURCE },
    reference: { ...EMPTY_SOURCE },
    result: null,
  };
}

export const useSignaturesStore = create<SignaturesState>()(
  persist(
    (set, get) => ({
      sessions: {},
      currentSessionId: null,

      createSession: () => {
        const id = generateId();
        set((s) => ({
          sessions: { ...s.sessions, [id]: emptySession(id) },
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

      setSource: (sessionId, side, source) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: source,
                result: null, // yeni kaynak → eski sonucu geçersiz kıl
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setCrop: (sessionId, side, crop) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: { ...session[side], crop },
                result: null,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setSignatureImage: (sessionId, side, dataUrl) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: { ...session[side], signatureDataUrl: dataUrl },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      setResult: (sessionId, result) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                result,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      clearSource: (sessionId, side) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: { ...EMPTY_SOURCE },
                result: null,
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
      name: "agentex-signatures-v1",
      partialize: (s) => ({
        sessions: s.sessions,
        currentSessionId: s.currentSessionId,
      }),
    },
  ),
);
