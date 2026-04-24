// ============================================================
// Draft AI — Question Explain
// ============================================================
//
// Karmaşık bir soru (ör. "eser mi vekâlet mi?") için kısa,
// Türkçe, hukuki bağlamlı bir açıklama üretir. Kullanıcı karar
// aşamasında kalırsa yönlendirici tooltip olarak gösterilir.
// ============================================================

import type { DraftTemplate } from "../types";
import { generateJSON } from "@/lib/engine/gemini/client";

export interface ExplainInput {
  template: DraftTemplate;
  questionId: string;
}

export interface ExplainResult {
  explanation: string;
}

export class ExplainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExplainValidationError";
  }
}

export async function explainQuestion(
  input: ExplainInput,
): Promise<ExplainResult> {
  const q = input.template.questions.find((q) => q.id === input.questionId);
  if (!q) {
    throw new ExplainValidationError(
      `Soru bulunamadı: ${input.questionId}`,
    );
  }
  if (!q.aiSuggestable) {
    throw new ExplainValidationError(
      `Bu soru AI açıklamasına kapalı: ${q.label}`,
    );
  }

  const optionsList = q.options
    ? q.options
        .map(
          (o) =>
            `  · ${o.label}${o.description ? " — " + o.description : ""}`,
        )
        .join("\n")
    : "(seçenek yok)";

  const prompt = `Sen Türk sözleşme hukukunda deneyimli bir avukatsın.
Kullanıcı bir "${input.template.label}" hazırlarken aşağıdaki soruyu yanıtlamak üzere:

Soru: "${q.label}"
${q.helpText ? `Mevcut tooltip: ${q.helpText}` : ""}
Seçenekler:
${optionsList}

Bu seçim hukuki olarak neyi ifade ediyor ve kullanıcıya kararını vermesinde
yardımcı olacak önemli fark(lar) nedir? 2-3 cümle, Türkçe, somut ve
uygulanabilir bilgiyle yanıtla. Hukuk jargonuyla aşmadan ama yüzeyde
kalmadan.

Yanıtı SADECE şu JSON şemasında dön (başka metin yazma):
{
  "explanation": "açıklama metni"
}`;

  const raw = await generateJSON<unknown>(prompt);
  return validateResponse(raw);
}

function validateResponse(raw: unknown): ExplainResult {
  if (!raw || typeof raw !== "object") {
    throw new ExplainValidationError("Gemini yanıtı nesne değil.");
  }
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.explanation !== "string" ||
    obj.explanation.trim().length === 0
  ) {
    throw new ExplainValidationError(
      "Gemini yanıtında explanation eksik veya boş.",
    );
  }
  return { explanation: obj.explanation.trim() };
}
