// ============================================================
// Draft AI — Clause Suggest
// ============================================================
//
// Sunucu tarafı yardımcısı: verilen bir şablon + oturum için,
// belirli bir maddenin daha iyi yazılmış alternatifini üretmek
// üzere Gemini'ye prompt hazırlar ve JSON yanıtı doğrular.
//
// Çıktı şeması:
//   { suggestedText: string, rationale: string }
// Hallucination / yanlış format senaryolarına karşı inline
// validasyon yapılır; API route çağıran tarafa 400 / 502 döner.
// ============================================================

import type { DraftTemplate } from "../types";
import { renderDraft } from "../renderer";
import { generateJSON } from "@/lib/engine/gemini/client";

export interface SuggestInput {
  template: DraftTemplate;
  clauseId: string;
  answers: Record<string, unknown>;
  aiAccepted: Record<string, string>;
  disabledClauses: string[];
}

export interface SuggestResult {
  suggestedText: string;
  rationale: string;
}

export class SuggestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestValidationError";
  }
}

export async function suggestClause(
  input: SuggestInput,
): Promise<SuggestResult> {
  const clause = input.template.clauses.find((c) => c.id === input.clauseId);
  if (!clause) {
    throw new SuggestValidationError(
      `Madde bulunamadı: ${input.clauseId}`,
    );
  }
  if (!clause.aiEditable) {
    throw new SuggestValidationError(
      `Bu madde AI önerisine kapalı: ${clause.title}`,
    );
  }

  // Oturum cevaplarıyla mevcut madde metnini çöz — Gemini'ye placeholder
  // değil gerçek değerleri görebildiği bir metin sunarız.
  const now = new Date().toISOString();
  const { clauses } = renderDraft(input.template, {
    id: "preview",
    templateId: input.template.id,
    createdAt: now,
    updatedAt: now,
    status: "draft",
    answers: input.answers,
    aiAccepted: input.aiAccepted,
    disabledClauses: input.disabledClauses,
  });
  const current = clauses.find((c) => c.clauseId === input.clauseId);
  const realizedText = current?.body ?? clause.template;

  const prompt = buildPrompt({
    templateLabel: input.template.label,
    clauseTitle: clause.title,
    realizedText,
    answersSummary: summarizeAnswers(input.template, input.answers),
  });

  const raw = await generateJSON<unknown>(prompt);
  return validateResponse(raw);
}

function buildPrompt(args: {
  templateLabel: string;
  clauseTitle: string;
  realizedText: string;
  answersSummary: string;
}): string {
  return `Sen Türkiye Cumhuriyeti sözleşme hukukunda deneyimli bir avukatsın.
Kullanıcı bir "${args.templateLabel}" hazırlıyor ve aşağıdaki maddeyi daha
ince, hukuken sağlam ve uygulamada tutarlı bir şekilde yeniden yazmanı
istiyor.

Madde: "${args.clauseTitle}"

Mevcut metin:
"""
${args.realizedText}
"""

Kullanıcının şimdiye kadar verdiği parametreler:
${args.answersSummary}

Kurallar:
- Yalnızca bu maddeyi yeniden yaz; başka madde oluşturma.
- Türkçe yaz.
- Parametrelerdeki gerçek değerleri kullan; placeholder (ör. {{var}}) bırakma.
- Kanun maddesi uydurma; sadece sağlanan bağlama dayan.
- 1-3 paragraf, makul uzunluk — kısa ama hukuki kapsayıcılığı koru.
- "Avukat olarak" / "öneririm" gibi konuşma üslubu kullanma; sözleşme dili
  kullan.

Yanıtı SADECE şu JSON şemasında dön (başka metin yazma):
{
  "suggestedText": "yeniden yazılmış madde metni",
  "rationale": "neden daha iyi — tek cümle, Türkçe"
}`;
}

function summarizeAnswers(
  template: DraftTemplate,
  answers: Record<string, unknown>,
): string {
  const lines: string[] = [];
  for (const q of template.questions) {
    const v = answers[q.id];
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) {
      continue;
    }
    const rendered = renderValue(q.options, v);
    lines.push(`- ${q.label}: ${rendered}`);
  }
  return lines.length > 0 ? lines.join("\n") : "- (parametre girilmemiş)";
}

function renderValue(
  options: { value: string; label: string }[] | undefined,
  value: unknown,
): string {
  if (Array.isArray(value)) {
    return value
      .map((v) => options?.find((o) => o.value === v)?.label ?? String(v))
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";
  if (value === null || value === undefined) return "";
  const opt = options?.find((o) => o.value === value);
  return opt?.label ?? String(value);
}

function validateResponse(raw: unknown): SuggestResult {
  if (!raw || typeof raw !== "object") {
    throw new SuggestValidationError(
      "Gemini yanıtı nesne değil.",
    );
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.suggestedText !== "string" || obj.suggestedText.trim().length === 0) {
    throw new SuggestValidationError(
      "Gemini yanıtında suggestedText eksik veya boş.",
    );
  }
  if (typeof obj.rationale !== "string") {
    throw new SuggestValidationError(
      "Gemini yanıtında rationale eksik.",
    );
  }
  return {
    suggestedText: obj.suggestedText.trim(),
    rationale: obj.rationale.trim(),
  };
}
