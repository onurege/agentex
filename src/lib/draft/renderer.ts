// ============================================================
// Draft Renderer — Template + Answers → ClauseText[]
// ============================================================
//
// Deterministik. Şablon iskeleti + kullanıcı oturumunu alır,
// enabled madde listesini dinamik yeniden numaralandırır, her
// maddeyi placeholder resolver'dan geçirerek düz metne çevirir.
// AI asistan tarafından kabul edilmiş override'lar resolver'a
// girmeden olduğu gibi basılır (Faz 2'de devreye girer).
//
// Placeholder sözdizimi (minimal subset):
//   {{path}}                    → answers[path] değerini yerleştir
//   {{#if path}}...{{/if}}      → truthy ise bloğu dahil et
//   {{#if path=value}}...{{/if}} → answers[path] === value ise bloğu dahil et
//
// Limitler: nested #if desteklenmez; karmaşık ihtiyaç doğarsa
// proper parser'a taşı.
// ============================================================

import type {
  ClauseSegment,
  ClauseTemplate,
  ClauseText,
  DraftSession,
  DraftTemplate,
  Question,
} from "./types";

export interface RenderedDraft {
  clauses: ClauseText[];
  /** Clause id → gerekli olup henüz doldurulmamış question id'leri. */
  missingByClause: Record<string, string[]>;
}

export function renderDraft(
  template: DraftTemplate,
  session: DraftSession,
): RenderedDraft {
  const enabled = template.clauses
    .filter((c) => isClauseEnabled(c, session, template))
    .sort((a, b) => a.order - b.order);

  const manualEdits = session.manualEdits ?? {};
  const clauses: ClauseText[] = enabled.map((c, idx) => {
    const override = manualEdits[c.id];
    const segments = renderClauseSegments(c, session, template, override?.statics);
    return {
      clauseId: c.id,
      number: `Madde ${idx + 1}`,
      title: override?.title ?? c.title,
      body: segments.map((s) => s.text).join(""),
      segments,
    };
  });

  const missingByClause: Record<string, string[]> = {};
  for (const c of enabled) {
    const missing = findMissingAnswers(c, session, template);
    if (missing.length > 0) missingByClause[c.id] = missing;
  }

  return { clauses, missingByClause };
}

// --- Enablement --------------------------------------------------------------

export function isClauseEnabled(
  clause: ClauseTemplate,
  session: DraftSession,
  template: DraftTemplate,
): boolean {
  if (clause.required) return true;
  if (session.disabledClauses.includes(clause.id)) return false;
  if (clause.defaultEnabled) return true;

  // Optional + defaultEnabled=false → explicit opt-in gerektirir.
  // Kural: requires içindeki ilk checkbox tipi question gate'tir.
  const gateQuestion = clause.requires
    .map((id) => template.questions.find((q) => q.id === id))
    .find((q): q is Question => q?.type === "checkbox");

  if (!gateQuestion) return false;
  return Boolean(session.answers[gateQuestion.id]);
}

// --- Placeholder resolution -------------------------------------------------

function renderClauseSegments(
  clause: ClauseTemplate,
  session: DraftSession,
  template: DraftTemplate,
  staticOverrides?: Record<number, string>,
): ClauseSegment[] {
  // AI suggestion override: store as a single static segment so the
  // user can still edit on top of it; answer-token structure is lost
  // but that's acceptable — the user explicitly accepted finished text.
  const aiOverride = session.aiAccepted[clause.id];
  if (aiOverride) {
    const text = staticOverrides?.[0] ?? aiOverride;
    return [{ kind: "static", text, staticIndex: 0 }];
  }
  return resolveTemplateSegments(
    clause.template,
    session,
    template,
    staticOverrides,
  );
}

export function resolveTemplateSegments(
  body: string,
  session: DraftSession,
  template: DraftTemplate,
  staticOverrides?: Record<number, string>,
): ClauseSegment[] {
  // Conditionals collapse to plain string first (same logic as the
  // legacy resolveTemplate), then we tokenize on {{path}} to split
  // into static + answer segments.
  let result = body;
  const answers = session.answers;

  result = result.replace(
    /\{\{#if\s+([^\s=}]+)\s*=\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path: string, expected: string, inner: string) => {
      const actual = answers[path];
      return String(actual) === expected.trim() ? inner : "";
    },
  );

  result = result.replace(
    /\{\{#if\s+([^\s}]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path: string, inner: string) => {
      return isTruthy(answers[path]) ? inner : "";
    },
  );

  const segments: ClauseSegment[] = [];
  const re = /\{\{\s*([^\s{}]+)\s*\}\}/g;
  let lastIndex = 0;
  let staticIdx = 0;
  let m: RegExpExecArray | null;

  const pushStatic = (text: string) => {
    if (text.length === 0) return;
    const idx = staticIdx++;
    segments.push({
      kind: "static",
      text: staticOverrides?.[idx] ?? text,
      staticIndex: idx,
    });
  };

  while ((m = re.exec(result)) !== null) {
    if (m.index > lastIndex) {
      pushStatic(result.slice(lastIndex, m.index));
    }
    const path = m[1];
    const value = answers[path];
    let text: string;
    if (value === undefined || value === null || value === "") {
      const q = template.questions.find((q) => q.id === path);
      text = `[ ${q?.label ?? path} ]`;
    } else {
      text = formatAnswer(template, path, value, answers);
    }
    segments.push({ kind: "answer", text, questionId: path });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < result.length) {
    pushStatic(result.slice(lastIndex));
  }
  return segments;
}

export function resolveTemplate(
  body: string,
  session: DraftSession,
  template: DraftTemplate,
): string {
  let result = body;
  const answers = session.answers;

  // 1) {{#if path=value}}...{{/if}} — equality (must run before truthy form).
  result = result.replace(
    /\{\{#if\s+([^\s=}]+)\s*=\s*([^}]+?)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path: string, expected: string, inner: string) => {
      const actual = answers[path];
      return String(actual) === expected.trim() ? inner : "";
    },
  );

  // 2) {{#if path}}...{{/if}} — truthy.
  result = result.replace(
    /\{\{#if\s+([^\s}]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, path: string, inner: string) => {
      return isTruthy(answers[path]) ? inner : "";
    },
  );

  // 3) {{path}} — scalar substitution.
  result = result.replace(
    /\{\{\s*([^\s{}]+)\s*\}\}/g,
    (_match, path: string) => {
      const value = answers[path];
      if (value === undefined || value === null || value === "") {
        const q = template.questions.find((q) => q.id === path);
        return `[ ${q?.label ?? path} ]`;
      }
      return formatAnswer(template, path, value, answers);
    },
  );

  return result;
}

function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (value === false || value === 0) return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

export function formatAnswer(
  template: DraftTemplate,
  questionId: string,
  value: unknown,
  answers?: Record<string, unknown>,
): string {
  const q = template.questions.find((q) => q.id === questionId);
  if (!q) return String(value ?? "");

  if (questionId.endsWith(".name") && typeof value === "string") {
    return formatPartyName(template, questionId, value, answers);
  }

  if (q.type === "multiCheckbox" && Array.isArray(value)) {
    return value
      .map(
        (v) =>
          q.options?.find((o) => o.value === v)?.label ?? String(v),
      )
      .join(", ");
  }

  if ((q.type === "select" || q.type === "radioGroup") && value !== undefined) {
    return (
      q.options?.find((o) => o.value === value)?.label ?? String(value)
    );
  }

  if (q.type === "currency" && typeof value === "number") {
    return `${value.toLocaleString("tr-TR")} TL`;
  }

  if (q.type === "date" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
  }

  if (q.type === "checkbox" && typeof value === "boolean") {
    return value ? "Evet" : "Hayır";
  }

  return String(value);
}

function formatPartyName(
  template: DraftTemplate,
  questionId: string,
  value: string,
  answers?: Record<string, unknown>,
): string {
  const prefix = questionId.replace(/\.name$/, "");
  const typeQuestion = template.questions.find((q) => q.id === `${prefix}.type`);
  const partyType = answers?.[`${prefix}.type`];

  if (typeQuestion && partyType !== "company") return value;

  const style = answers?.[`${prefix}.nameStyle`] ?? "uppercase";
  if (style === "lowercase_bold") {
    return `**${value.toLocaleLowerCase("tr-TR")}**`;
  }

  if (style === "uppercase") {
    return value.toLocaleUpperCase("tr-TR");
  }

  return value;
}

// --- Missing answer detection -----------------------------------------------

function findMissingAnswers(
  clause: ClauseTemplate,
  session: DraftSession,
  template: DraftTemplate,
): string[] {
  const missing: string[] = [];

  for (const reqId of clause.requires) {
    const q = template.questions.find((q) => q.id === reqId);
    if (!q) continue;

    // Skip dependsOn-gated questions when the gate is off.
    if (q.dependsOn) {
      const gateVal = session.answers[q.dependsOn.questionId];
      const gateMatch =
        q.dependsOn.equals !== undefined
          ? gateVal === q.dependsOn.equals
          : q.dependsOn.anyOf?.includes(gateVal) ?? true;
      if (!gateMatch) continue;
    }

    const value = session.answers[reqId];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (empty) missing.push(reqId);
  }

  return missing;
}
