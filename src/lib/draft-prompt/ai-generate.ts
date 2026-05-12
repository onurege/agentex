// ============================================================
// Draft Prompt AI — Generate / Refine
// ============================================================
//
// Kullanıcının doğal dil mesajlarından Türkçe sözleşme taslağı
// üretir. Hibrit mod: mevcut taslak + chat geçmişi + son
// kullanıcı mesajı → güncellenmiş tam taslak + asistan cevabı.
//
// Stabil clause id'leri ile preview'da elle yapılan satır-içi
// düzenlemelerin korunması hedeflenir (AI'a "değişmeyen
// maddeleri OLDUĞU GİBİ geri çevir, sadece istenen değişikliği
// uygula" yönergesi verilir).
// ============================================================

import { generateJSON } from "@/lib/engine/gemini/client";
import type {
  PromptChatMessage,
  PromptDraftAIResult,
  PromptDraftClause,
  PromptDraftDocument,
} from "./types";

const MAX_HISTORY_MESSAGES = 12;
const MAX_CLAUSE_BODY_CHARS = 6000;
const MAX_ASSISTANT_MESSAGE_CHARS = 800;

export interface GenerateInput {
  /** Tüm konuşma geçmişi (son mesaj zaten kullanıcının yeni isteği). */
  messages: PromptChatMessage[];
  /** Mevcut taslak; null ise AI sıfırdan kurar. */
  currentDraft: PromptDraftDocument | null;
}

export class PromptGenerateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptGenerateError";
  }
}

function safeId(prefix = "cl"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildSystemPrompt(): string {
  return `Sen profesyonel bir Türk hukukçususun. Kullanıcının doğal dil isteklerinden Türk hukukuna uygun, profesyonel dilde Türkçe sözleşme taslağı üretirsin.

ZORUNLU JSON ŞEMASI:
{
  "assistantMessage": "Kısa, 1-3 cümlelik Türkçe asistan cevabı (chat'te kullanıcıya gösterilir).",
  "draft": {
    "title": "Sözleşmenin tam başlığı (örn: 'Yazılım Geliştirme Hizmeti Sözleşmesi')",
    "preamble": "Taraflar paragrafı. 'Bir taraftan [A] (bundan böyle ...) ile diğer taraftan [B] (bundan böyle ...) arasında ... aşağıdaki şartlarda akdedilmiştir.' kalıbında. Eksik bilgi varsa [Köşeli parantez içinde] yer tutucu bırak.",
    "clauses": [
      {
        "id": "STABLE_ID — mevcut taslakta varsa AYNI id, yeni eklenen madde için yeni id (örn cl_xyz123).",
        "heading": "Madde başlığı (numarasız) — örn: 'Sözleşmenin Konusu'",
        "body": "Madde içeriği. Birden fazla paragraf için \\n\\n kullan. Liste için her satıra '- ' ön eki."
      }
    ],
    "closing": "Kapanış paragrafı + imza alanları. 'İşbu sözleşme ... tarihinde, .. nüsha olarak ...' kalıbı; imza için [TARAF A] ve [TARAF B] yer tutucuları."
  }
}

KRİTİK KURALLAR:
1. SADECE JSON döndür, başka metin yok. JSON dışına bir karakter yazma.
2. Tüm sözleşme dili Türkçe ve profesyonel olsun.
3. Madde id'leri stabil: mevcut taslakta var olan bir madde mantıken aynı kalıyorsa aynı id'yi kullan.
4. Sadece kullanıcının açıkça istediği maddeleri değiştir. Değiştirilmeyen maddeleri OLDUĞU GİBİ geri ver (içerik tıpatıp aynı kalsın); kullanıcı elle düzenleme yapmış olabilir, sen bozma.
5. Kullanıcı net olmayan bir bilgi istediyse (ör. taraf adı vermediyse) köşeli parantez yer tutucusu bırak: "[Hizmet Sağlayıcı Ad Soyad]" gibi. Uydurma.
6. Mevzuata aykırı veya yüksek riskli madde önerisi gelirse \`assistantMessage\` içinde uyar.
7. Sözleşme türünü kullanıcının niyetinden çıkar — kullanıcıya geri sorma; ihtiyaç duyduğun bilgileri \`assistantMessage\` sonunda kısaca rica edebilirsin.`;
}

function summariseClause(c: PromptDraftClause): string {
  return `[id=${c.id}] ${c.heading}\n${c.body}`;
}

function buildUserPrompt(input: GenerateInput): string {
  const lastMessages = input.messages.slice(-MAX_HISTORY_MESSAGES);
  const historyBlock = lastMessages
    .map((m) => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join("\n\n");

  const currentDraftBlock = input.currentDraft
    ? `# Mevcut taslak (kullanıcı elle düzenlemiş olabilir, değişmeyen maddeleri AYNEN koru)
Başlık: ${input.currentDraft.title}

Giriş (preamble):
${input.currentDraft.preamble}

Maddeler:
${input.currentDraft.clauses.map(summariseClause).join("\n\n")}

Kapanış (closing):
${input.currentDraft.closing}`
    : "# Mevcut taslak yok — sıfırdan kuracaksın.";

  return `${currentDraftBlock}

# Konuşma geçmişi
${historyBlock}

# Görevin
Yukarıdaki konuşmaya göre güncellenmiş tam taslağı şemaya uygun JSON olarak üret.`;
}

function ensureString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function sanitizeDraft(raw: unknown, existing: PromptDraftDocument | null): PromptDraftDocument {
  if (!raw || typeof raw !== "object") {
    throw new PromptGenerateError("AI taslak nesnesi döndürmedi.");
  }
  const r = raw as Record<string, unknown>;
  const title = ensureString(r.title).trim() || existing?.title || "Sözleşme";
  const preamble = ensureString(r.preamble).trim();
  const closing = ensureString(r.closing).trim();

  const rawClauses = Array.isArray(r.clauses) ? r.clauses : [];
  const existingIds = new Set((existing?.clauses ?? []).map((c) => c.id));
  const seenIds = new Set<string>();
  const clauses: PromptDraftClause[] = [];
  for (const item of rawClauses) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    let id = ensureString(rec.id).trim();
    if (!id || seenIds.has(id)) {
      id = safeId();
      while (seenIds.has(id)) id = safeId();
    }
    seenIds.add(id);
    const heading = ensureString(rec.heading).trim() || "Başlıksız madde";
    let body = ensureString(rec.body).trim();
    if (body.length > MAX_CLAUSE_BODY_CHARS) {
      body = `${body.slice(0, MAX_CLAUSE_BODY_CHARS).trim()}…`;
    }
    clauses.push({ id, heading, body });
    // Silinmiş ama AI bir önceki id'yi koruyorsa toleranslı davranırız.
    existingIds.delete(id);
  }

  if (clauses.length === 0) {
    throw new PromptGenerateError("AI hiç madde döndürmedi.");
  }

  return { title, preamble, closing, clauses };
}

function sanitizeAssistantMessage(raw: unknown): string {
  const v = ensureString(raw).trim();
  if (!v) return "Taslak güncellendi.";
  if (v.length > MAX_ASSISTANT_MESSAGE_CHARS) {
    return `${v.slice(0, MAX_ASSISTANT_MESSAGE_CHARS).trim()}…`;
  }
  return v;
}

export async function generateOrRefineDraft(
  input: GenerateInput,
): Promise<PromptDraftAIResult> {
  if (input.messages.length === 0) {
    throw new PromptGenerateError("Konuşma boş — kullanıcı mesajı bekleniyor.");
  }
  const prompt = `${buildSystemPrompt()}\n\n---\n\n${buildUserPrompt(input)}`;
  const raw = await generateJSON<{
    assistantMessage?: unknown;
    draft?: unknown;
  }>(prompt);
  if (!raw || typeof raw !== "object") {
    throw new PromptGenerateError("AI geçersiz yanıt verdi.");
  }
  const draft = sanitizeDraft(raw.draft, input.currentDraft);
  const assistantMessage = sanitizeAssistantMessage(raw.assistantMessage);
  return { assistantMessage, draft };
}
