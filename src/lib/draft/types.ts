// ============================================================
// Draft Module — Types
// ============================================================
//
// Sıfırdan sözleşme taslağı üretimi için tip modeli. Boardroom
// ve Compare'den tamamen izole; yalnızca docx export + theme
// token'ları paylaşılır. Şablon tanımları statik (derleme-zamanı);
// DraftSession kullanıcının o şablon üstündeki oturumu.
// ============================================================

// --- Template schema (statik) -----------------------------------------------

export type TemplateId = "nda" | "distributor" | "service";

export type QuestionType =
  | "text"
  | "longText"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "radioGroup"
  | "checkbox"
  | "multiCheckbox";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface QuestionDependency {
  questionId: string;
  equals?: unknown;
  anyOf?: unknown[];
}

export interface Question {
  id: string;
  step: number;
  group: string;
  label: string;
  helpText?: string;
  type: QuestionType;
  required: boolean;
  options?: QuestionOption[];
  defaultValue?: unknown;
  dependsOn?: QuestionDependency;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  /** Faz 2'de AI asistan bu soruda öneri sunabilir mi? */
  aiSuggestable?: boolean;
}

export interface ClauseTemplate {
  id: string;
  order: number;
  number: string;
  title: string;
  required: boolean;
  defaultEnabled: boolean;
  /** Mustache-benzeri: "{{partyA.name}}" + "{{#if terms.exclusive}}…{{/if}}". */
  template: string;
  aiEditable: boolean;
  /** Bu maddeyi anlamlı render edebilmek için cevaplanması gereken soru id'leri. */
  requires: string[];
}

export interface TemplateWarning {
  id: string;
  message: string;
  shownWhen: QuestionDependency;
  severity: "info" | "warn";
}

export interface DraftTemplate {
  id: TemplateId;
  label: string;
  description: string;
  /** Section label için kısa kategori: "Gizlilik", "Bayilik", "Hizmet". */
  category: string;
  /** Lucide ikonunun adı; render tarafında <LucideIcon name={…}> ile eşlenir. */
  iconKey: string;
  estimatedMinutes: number;
  questions: Question[];
  clauses: ClauseTemplate[];
  warnings: TemplateWarning[];
  /** DOCX başlık (ör. "GİZLİLİK SÖZLEŞMESİ"). */
  documentTitle: string;
}

// --- Session (kullanıcı oturumu) --------------------------------------------

export type DraftStatus = "draft" | "complete";

export type ClauseSegment =
  | { kind: "static"; text: string; staticIndex: number }
  | { kind: "answer"; text: string; questionId: string };

export interface ClauseText {
  clauseId: string;
  number: string;
  title: string;
  /** Tüm statik + cevap segmentlerinin birleşimi (DOCX export ve diğer
   *  düz-metin tüketiciler için). */
  body: string;
  /** Render edilmiş segment dizisi — preview UI bunu inline contentEditable
   *  + locked span olarak işler. */
  segments: ClauseSegment[];
}

export interface DraftSession {
  id: string;
  templateId: TemplateId;
  createdAt: string;
  updatedAt: string;
  status: DraftStatus;
  /** questionId → cevap değeri (string | number | boolean | string[]). */
  answers: Record<string, unknown>;
  /** AI önerisi kabul edilen maddelerin override metinleri — Faz 2. */
  aiAccepted: Record<string, string>;
  /** Kullanıcının kapattığı opsiyonel maddeler. */
  disabledClauses: string[];
  /**
   * Kullanıcının preview'de elle düzenlediği maddeler. `title` skaler
   * override; `statics` her statik segmentin (cevap-token'ları arası)
   * kullanıcı yazdığı metni indeksiyle saklar. Cevap-bağlı segmentler
   * her zaman canlı — formdaki değer değişince preview'de güncellenir.
   */
  manualEdits?: Record<
    string,
    { title?: string; statics?: Record<number, string> }
  >;
  /** En son render'dan preview için cache — opsiyonel. */
  renderedClauses?: ClauseText[];
}
