// ============================================================
// Signatures Module — Zustand Store
// ============================================================
//
// İmza karşılaştırma oturumları. Boardroom / Compare / Draft ile
// izole. Rendered sayfa + imza data URL'leri birkaç MB tuttuğu için
// localStorage quota'sını (5-10 MB) aşıyor; bu yüzden persist
// KULLANMIYORUZ — oturum ephemeral: tab açık kaldığı sürece yaşar,
// refresh'te sıfırlanır. Signatures zaten tek-atış workflow.
// ============================================================

"use client";

import { create } from "zustand";
import type {
  ComparisonResult,
  CropRegion,
  ReferenceSpecimen,
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
    meta?: {
      rawCropDataUrl: string | null;
      processedAspectRatio: number | null;
      inkDensity: number | null;
    },
  ): void;
  setResult(sessionId: string, result: ComparisonResult | null): void;

  /** İmza sirküsünden ek imza örneği ekle — id döner. */
  addReferenceSpecimen(
    sessionId: string,
    specimen: Omit<ReferenceSpecimen, "id">,
  ): string;
  removeReferenceSpecimen(sessionId: string, specimenId: string): void;

  clearSource(sessionId: string, side: Side): void;
  deleteSession(id: string): void;
}

function generateId(): string {
  return `sig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateSpecimenId(): string {
  return `spec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function emptySession(id: string): SignatureSession {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    contract: { ...EMPTY_SOURCE },
    reference: { ...EMPTY_SOURCE },
    referenceSpecimens: [],
    result: null,
  };
}

export const useSignaturesStore = create<SignaturesState>()(
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
          // Referans kaynağı değişirse ek örnekler de sıfırlanmalı —
          // farklı bir sayfa için önceki kırpımlar anlamsız.
          const extra =
            side === "reference" ? { referenceSpecimens: [] } : {};
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: source,
                ...extra,
                result: null,
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

      setSignatureImage: (sessionId, side, dataUrl, meta) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          const nextSource = {
            ...session[side],
            signatureDataUrl: dataUrl,
            rawCropDataUrl: meta?.rawCropDataUrl ?? null,
            processedAspectRatio: meta?.processedAspectRatio ?? null,
            inkDensity: meta?.inkDensity ?? null,
          };
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: nextSource,
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
          const extra =
            side === "reference" ? { referenceSpecimens: [] } : {};
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                [side]: { ...EMPTY_SOURCE },
                ...extra,
                result: null,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      addReferenceSpecimen: (sessionId, specimen) => {
        const id = generateSpecimenId();
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                referenceSpecimens: [
                  ...session.referenceSpecimens,
                  { id, ...specimen },
                ],
                result: null,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
        return id;
      },

      removeReferenceSpecimen: (sessionId, specimenId) =>
        set((s) => {
          const session = s.sessions[sessionId];
          if (!session) return s;
          return {
            sessions: {
              ...s.sessions,
              [sessionId]: {
                ...session,
                referenceSpecimens: session.referenceSpecimens.filter(
                  (sp) => sp.id !== specimenId,
                ),
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
);
