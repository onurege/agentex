// Prompt-driven contract draft session shapes.
//
// İki taraflı state:
//   - `messages` — chat conversation (kullanıcı + asistan)
//   - `draft`    — AI'ın ürettiği son madde-bazlı sözleşme dokümanı
//
// Hibrit mod: her yeni kullanıcı mesajında AI'a hem geçmiş hem mevcut
// `draft` gönderilir; AI tam güncellenmiş dokümanı döner. Stabil
// `clause.id` ile preview'da elle yapılan satır-içi düzenlemeler
// büyük olasılıkla korunur (AI değişmeyen maddeleri olduğu gibi
// geri çevirmesi için promptta açıkça yönlendirilir).

export type PromptDraftStatus = "empty" | "generating" | "ready" | "error";

export interface PromptChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface PromptDraftClause {
  /** Stable id — AI'a "bu maddeyi koru / güncelle" sinyali verir. */
  id: string;
  heading: string;
  body: string;
}

export interface PromptDraftDocument {
  title: string;
  /** Taraflar paragrafı, sözleşmenin giriş bölümü. */
  preamble: string;
  clauses: PromptDraftClause[];
  /** "İşbu sözleşme … imza altına alınmıştır" + imza alanları. */
  closing: string;
}

export interface PromptDraftSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** UI'da liste için kısa başlık. AI ilk taslağı ürettiğinde
   *  document.title ile senkronlanır. */
  label: string;
  messages: PromptChatMessage[];
  draft: PromptDraftDocument | null;
  status: PromptDraftStatus;
  errorMessage: string | null;
  /** DB'ye kaydedilmişse PromptDraft.id. Update etmek için bu kullanılır;
   *  null ise sonraki kaydet yeni satır yaratır. */
  serverId: string | null;
  /** Saved ISO timestamp — UI'da "kaydedildi" rozeti için. */
  savedAt: string | null;
}

/** Liste API'sinin bir item shape'i. */
export interface PromptDraftListItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isOwner: boolean;
  ownerName: string;
}

/** AI response sözleşmesi — `/api/draft/prompt` POST'undan döner. */
export interface PromptDraftAIResult {
  assistantMessage: string;
  draft: PromptDraftDocument;
}
