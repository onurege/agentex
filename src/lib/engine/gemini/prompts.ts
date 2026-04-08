// ============================================================
// Gemini Prompts — structured prompt builders
// ============================================================
//
// Each function builds a complete prompt string for a specific
// engine method. Prompts request structured JSON output matching
// the app's type definitions.
//
// All prompts are in Turkish to match the app's language.
// ============================================================

import type { ParsedDocument } from "../../ingestion/types";
import type { AgentId, BusinessContext, Finding, Disagreement, RevisionSuggestion } from "../../types";
import { AGENTS, EXPERT_AGENTS } from "../../agents";

// --- Helpers ---

function formatDocument(doc: ParsedDocument): string {
  const parts: string[] = [];

  parts.push(`Belge: ${doc.fileName}`);
  parts.push(`Tür: ${doc.fileType.toUpperCase()}`);
  if (doc.pageCount) parts.push(`Sayfa sayısı: ${doc.pageCount}`);
  if (doc.metadata.documentTypeGuess) {
    parts.push(`Belge türü tahmini: ${doc.metadata.documentTypeGuess}`);
  }

  if (doc.sections.length > 0) {
    parts.push("\n--- Belge Bölümleri ---");
    for (const section of doc.sections) {
      parts.push(`\n### ${section.title}`);
      parts.push(section.content);
    }
  }

  if (doc.fullText) {
    parts.push("\n--- Tam Metin ---");
    parts.push(doc.fullText.slice(0, 8000));
  }

  return parts.join("\n");
}

/**
 * Format document with clause-level detail for findings generation.
 * Renders section types, clause refs, and nested clauses.
 */
function formatDocumentWithClauses(doc: ParsedDocument): string {
  const parts: string[] = [];

  parts.push(`Belge: ${doc.fileName}`);
  parts.push(`Tür: ${doc.fileType.toUpperCase()}`);
  if (doc.pageCount) parts.push(`Sayfa sayısı: ${doc.pageCount}`);
  if (doc.metadata.documentTypeGuess) {
    parts.push(`Belge türü tahmini: ${doc.metadata.documentTypeGuess}`);
  }

  if (doc.sections.length > 0) {
    parts.push("\n--- Belge Yapısı (Bölümler ve Maddeler) ---");
    for (const section of doc.sections) {
      const typeLabel = section.sectionType ? ` [${section.sectionType}]` : "";
      const refLabel = section.clauseRef ? ` (${section.clauseRef})` : "";
      parts.push(`\n### ${section.title}${refLabel}${typeLabel}`);
      parts.push(section.content);

      if (section.clauses && section.clauses.length > 0) {
        for (const clause of section.clauses) {
          const indent = "  ".repeat(clause.depth + 1);
          const titleSuffix = clause.title ? ` — ${clause.title}` : "";
          parts.push(`${indent}${clause.ref}${titleSuffix}`);
          if (clause.text && clause.text !== clause.title) {
            parts.push(`${indent}  ${clause.text.slice(0, 200)}`);
          }
        }
      }
    }
  }

  if (doc.fullText) {
    parts.push("\n--- Tam Metin ---");
    parts.push(doc.fullText.slice(0, 8000));
  }

  return parts.join("\n");
}

/** Collect all known clause refs and section names from the document */
function collectClauseRefs(doc: ParsedDocument): string[] {
  const refs: string[] = [];
  for (const section of doc.sections) {
    if (section.clauseRef) refs.push(section.clauseRef);
    if (section.clauses) {
      for (const clause of section.clauses) {
        refs.push(clause.ref);
      }
    }
  }
  return refs;
}

/** Collect all section names from the document */
function collectSectionNames(doc: ParsedDocument): string[] {
  return doc.sections.map((s) => s.title);
}

function formatBusinessContext(ctx: BusinessContext): string {
  const parts: string[] = [];
  if (ctx.industry) parts.push(`Sektör: ${ctx.industry}`);
  if (ctx.dealType) parts.push(`Anlaşma türü: ${ctx.dealType}`);
  if (ctx.notes.length > 0) {
    parts.push("Notlar:");
    ctx.notes.forEach((n) => parts.push(`- ${n}`));
  }
  return parts.join("\n");
}

function formatAgentList(): string {
  return EXPERT_AGENTS.map(
    (a) => `- "${a.id}": ${a.name} — ${a.description.slice(0, 80)}`,
  ).join("\n");
}

// --- Recommendation Prompt ---

export function buildRecommendationPrompt(
  doc: ParsedDocument,
  ctx: BusinessContext,
): string {
  return `Sen bir kıdemli sözleşme inceleme uzmanısın (Baş Ajan).
Aşağıdaki sözleşme belgesini ve iş bağlamını analiz et.

${formatDocument(doc)}

--- İş Bağlamı ---
${formatBusinessContext(ctx)}

--- Mevcut Uzman Ajanlar ---
${formatAgentList()}

Görevin:
1. Belgenin türünü belirle
2. Risk kategorilerini tespit et (yüksek/orta/düşük önem)
3. Bu belge için hangi uzman ajanların inceleme yapması gerektiğini öner
4. Gerekçeni açıkla

Yanıtı aşağıdaki JSON formatında ver:

{
  "documentType": "string — belgenin türü (ör: Bayi Dağıtım Sözleşmesi)",
  "riskCategories": [
    {
      "name": "string — risk alanı adı",
      "severity": "high" | "medium" | "low",
      "description": "string — kısa açıklama"
    }
  ],
  "recommendedAgents": ["agent-id-1", "agent-id-2"],
  "rationale": "string — neden bu ajanları önerdiğinin açıklaması"
}

Kurallar:
- recommendedAgents dizisine yalnızca şu geçerli ID'lerden seç: "legal-counsel", "finance-director", "tax-advisor", "sales-director", "product-director"
- En az 2, en fazla 4 risk kategorisi belirle
- En az 2 uzman ajan öner
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür, başka açıklama ekleme`;
}

// --- Manager Summary Prompt ---

export function buildManagerSummaryPrompt(
  doc: ParsedDocument,
  findings: Finding[],
  disagreements: Disagreement[],
  revisions: RevisionSuggestion[],
  contextLabel: string,
): string {
  const findingsSummary = findings
    .map(
      (f) =>
        `[${f.severity}] ${f.title} — ${f.description.slice(0, 100)}${f.clause ? ` (${f.clause})` : ""}`,
    )
    .join("\n");

  const disagreementsSummary = disagreements
    .map((d) => `${d.topic}: ${d.positionA.slice(0, 60)} vs ${d.positionB.slice(0, 60)}`)
    .join("\n");

  const revisionsSummary = revisions
    .map((r) => `[${r.priority}] ${r.section}: ${r.rationale.slice(0, 80)}`)
    .join("\n");

  return `Sen bir kıdemli sözleşme inceleme koordinatörüsün (Baş Ajan).
Aşağıdaki analiz sonuçlarından bir yönetici özeti hazırla.

--- Belge ---
${formatDocument(doc)}

--- Analiz Bağlamı ---
İnceleme adı: ${contextLabel}

--- Bulgular (${findings.length} adet) ---
${findingsSummary || "Bulgu yok"}

--- Anlaşmazlıklar (${disagreements.length} adet) ---
${disagreementsSummary || "Anlaşmazlık yok"}

--- Revizyon Önerileri (${revisions.length} adet) ---
${revisionsSummary || "Revizyon önerisi yok"}

Yanıtı aşağıdaki JSON formatında ver:

{
  "overallAssessment": "string — 2-4 cümlelik genel değerlendirme",
  "contractHealthScore": number (0-100),
  "keyFindings": ["string — en önemli 3-5 bulgu başlığı"],
  "recommendedActions": ["string — önerilen 3-6 aksiyon"],
  "riskLevel": "high" | "medium" | "low"
}

Kurallar:
- contractHealthScore: kritik sorun başına ~10 puan düşür, uyarı başına ~5, olumlu başına ~3 ekle
- riskLevel: 4+ kritik = "high", 2+ kritik = "medium", altı = "low"
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür`;
}

// --- Discussion Summary Prompt ---

export function buildDiscussionSummaryPrompt(
  doc: ParsedDocument,
  findings: Finding[],
  disagreements: Disagreement[],
  contextLabel: string,
): string {
  const findingsSummary = findings
    .map((f) => `[${f.severity}/${f.agentId}] ${f.title}`)
    .join("\n");

  const disagreementsSummary = disagreements
    .map(
      (d) =>
        `${d.agentAId} vs ${d.agentBId}: ${d.topic}${d.resolution ? ` → Çözüm: ${d.resolution.slice(0, 60)}` : ""}`,
    )
    .join("\n");

  return `Sen bir sözleşme inceleme tartışmasının moderatörüsün.
Aşağıdaki bulgular ve anlaşmazlıklardan bir tartışma özeti hazırla.

--- Belge ---
Belge: ${doc.fileName}
İnceleme: ${contextLabel}

--- Bulgular (${findings.length} adet) ---
${findingsSummary || "Bulgu yok"}

--- Anlaşmazlıklar (${disagreements.length} adet) ---
${disagreementsSummary || "Anlaşmazlık yok"}

Yanıtı aşağıdaki JSON formatında ver:

{
  "totalFindings": number,
  "criticalIssues": number,
  "disagreements": number,
  "consensusPoints": ["string — ajanların uzlaştığı noktalar (3-5 madde)"],
  "debateHighlights": ["string — önemli tartışma noktaları (2-4 madde)"]
}

Kurallar:
- totalFindings, criticalIssues, disagreements sayıları yukarıdaki verilerle tutarlı olmalı
- consensusPoints: olumlu bulguları ve ajanların hemfikir olduğu noktaları listele
- debateHighlights: anlaşmazlıkların kısa özetlerini yaz
- Eğer anlaşmazlık yoksa debateHighlights boş dizi olabilir
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür`;
}

// --- Revision Suggestions Prompt ---

export function buildRevisionSuggestionsPrompt(
  doc: ParsedDocument,
  findings: Finding[],
  selectedAgents: AgentId[],
  contextLabel: string,
): string {
  const findingsSummary = findings
    .map(
      (f) =>
        `[${f.severity}/${f.agentId}] ${f.title} — ${f.description.slice(0, 120)}${f.clause ? ` (${f.clause})` : ""}`,
    )
    .join("\n");

  const agentNames = selectedAgents
    .filter((id) => id !== "chief-agent")
    .map((id) => {
      const a = AGENTS[id];
      return `"${id}": ${a.name}`;
    })
    .join(", ");

  return `Sen bir sözleşme revizyon uzmanısın.
Aşağıdaki belge ve bulgulara dayanarak somut madde revizyon önerileri hazırla.

--- Belge ---
${formatDocument(doc)}

--- Analiz Bağlamı ---
İnceleme: ${contextLabel}

--- Bulgular (${findings.length} adet) ---
${findingsSummary || "Bulgu yok"}

--- Aktif Ajanlar ---
${agentNames}

Görevin:
- Bulgulardaki sorunları çözmek için belgenin ilgili maddelerinde somut metin revizyonları öner
- Her revizyon için mevcut metni ve önerilen yeni metni yaz
- Revizyonu öneren ajanı belirle (bulguyla ilişkilendir)
- Öncelik belirle (high/medium/low)

Yanıtı aşağıdaki JSON formatında ver:

{
  "revisionSuggestions": [
    {
      "agentId": "string — revizyon öneren ajan ID'si",
      "section": "string — sözleşme bölümü/madde adı",
      "currentText": "string — mevcut madde metni (kısa, özet)",
      "suggestedText": "string — önerilen yeni metin",
      "rationale": "string — neden bu revizyon gerekli",
      "priority": "high" | "medium" | "low"
    }
  ]
}

Kurallar:
- agentId yalnızca şu geçerli ID'lerden biri olmalı: ${selectedAgents.filter((id) => id !== "chief-agent").map((id) => `"${id}"`).join(", ")}
- En az 2, en fazla 6 revizyon önerisi üret
- currentText ve suggestedText gerçekçi sözleşme dili kullanmalı
- Her revizyon farklı bir bölüm/madde ile ilgili olmalı
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür`;
}

// --- Disagreements Prompt ---

export function buildDisagreementsPrompt(
  doc: ParsedDocument,
  findings: Finding[],
  selectedAgents: AgentId[],
  contextLabel: string,
): string {
  const experts = selectedAgents.filter((id) => id !== "chief-agent");

  // Group findings by agent for context
  const findingsByAgent = experts
    .map((agentId) => {
      const agentFindings = findings.filter((f) => f.agentId === agentId);
      if (agentFindings.length === 0) return "";
      const agent = AGENTS[agentId];
      const items = agentFindings
        .map((f) => `  - [${f.severity}] ${f.title}: ${f.description.slice(0, 80)}`)
        .join("\n");
      return `${agent.name} (${agentId}):\n${items}`;
    })
    .filter((s) => s.length > 0)
    .join("\n\n");

  const agentPairs = experts
    .flatMap((a, i) => experts.slice(i + 1).map((b) => `"${a}" ile "${b}"`))
    .join(", ");

  return `Sen bir sözleşme inceleme tartışma moderatörüsün.
Aşağıdaki belge ve farklı uzman ajanların bulgularına dayanarak, ajanlar arasında olası görüş ayrılıklarını (anlaşmazlıkları) tespit et.

--- Belge ---
Belge: ${doc.fileName}
İnceleme: ${contextLabel}

--- Ajan Bazlı Bulgular ---
${findingsByAgent || "Bulgu yok"}

--- Olası Ajan Çiftleri ---
${agentPairs}

Görevin:
- Ajanların uzmanlık alanlarına göre, aynı konu hakkında farklı bakış açıları olabilecek noktaları belirle
- Her anlaşmazlık için her iki ajanın pozisyonunu açıkla
- Mümkünse bir çözüm önerisi sun
- Çözümü sağlayan ajanı belirle

Yanıtı aşağıdaki JSON formatında ver:

{
  "disagreements": [
    {
      "agentAId": "string — ilk ajan ID'si",
      "agentBId": "string — ikinci ajan ID'si",
      "topic": "string — tartışma konusu",
      "positionA": "string — ilk ajanın görüşü",
      "positionB": "string — ikinci ajanın görüşü",
      "resolution": "string | null — çözüm önerisi (varsa)",
      "resolvedBy": "string | null — çözümü sağlayan ajan ID'si (varsa)"
    }
  ]
}

Kurallar:
- agentAId ve agentBId yalnızca şu geçerli ID'lerden olmalı: ${experts.map((id) => `"${id}"`).join(", ")}
- agentAId ve agentBId farklı olmalı
- En az 1, en fazla 3 anlaşmazlık tespit et
- Eğer gerçek bir çıkar çatışması yoksa, farklı öncelik sıralamasından kaynaklanan görüş ayrılıkları da geçerlidir
- resolution ve resolvedBy null olabilir (çözümsüz anlaşmazlık)
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür`;
}

// --- Findings Prompt ---

/**
 * Build a findings prompt for a single expert agent.
 * Uses clause-level document structure for accurate references.
 */
export function buildFindingsPrompt(
  doc: ParsedDocument,
  ctx: BusinessContext,
  agentId: AgentId,
  contextLabel: string,
): string {
  const agent = AGENTS[agentId];
  const clauseRefs = collectClauseRefs(doc);
  const sectionNames = collectSectionNames(doc);

  const knownRefsHint =
    clauseRefs.length > 0
      ? `\nBelgede tespit edilen madde referansları: ${clauseRefs.join(", ")}`
      : "";

  const knownSectionsHint =
    sectionNames.length > 0
      ? `\nBelge bölümleri: ${sectionNames.join(", ")}`
      : "";

  return `Sen ${agent.name} rolünde bir sözleşme inceleme uzmanısın.
Uzmanlık alanların: ${agent.expertise.join(", ")}

Görevin: Aşağıdaki sözleşme belgesini kendi uzmanlık alanın perspektifinden incele ve bulgularını raporla.

--- Belge ---
${formatDocumentWithClauses(doc)}
${knownRefsHint}
${knownSectionsHint}

--- İş Bağlamı ---
${formatBusinessContext(ctx)}

--- Analiz Bağlamı ---
İnceleme: ${contextLabel}
Ajan: ${agent.name} (${agentId})

Her bulgu için şunları belirle:
1. Önem derecesi (severity): "critical" (imza öncesi mutlaka çözülmeli), "warning" (risk taşıyor, giderilmeli), "info" (bilgilendirme), "positive" (olumlu, iyi yapılandırılmış)
2. Kategori (category): "critical-issue" (kritik sorun), "missing-risky" (eksik ve riskli), "sufficient-positive" (yeterli ve olumlu)
3. İlgili madde/bölüm referansı (varsa)

Yanıtı aşağıdaki JSON formatında ver:

{
  "findings": [
    {
      "agentId": "${agentId}",
      "category": "critical-issue" | "missing-risky" | "sufficient-positive",
      "severity": "critical" | "warning" | "info" | "positive",
      "title": "string — kısa ve net bulgu başlığı (10-60 karakter)",
      "description": "string — detaylı açıklama (en az 30 karakter)",
      "clause": "string | null — ilgili madde referansı (ör: Madde 14.2)",
      "section": "string | null — ilgili bölüm adı (ör: Tazminat)"
    }
  ]
}

Kurallar:
- agentId her zaman "${agentId}" olmalı
- En az 2, en fazla 5 bulgu üret
- Bulguların en az 1 tanesi "critical" veya "warning" olmalı
- Bulguların en az 1 tanesi "positive" olmalı (dengeli analiz)
- severity ve category tutarlı olmalı: critical severity → critical-issue category, positive severity → sufficient-positive category
- clause alanı yalnızca belgede gerçekten var olan madde referanslarını kullanmalı
- section alanı belgede var olan bölüm adlarını kullanmalı
- title ve description farklı olmalı (title kısa özet, description detaylı açıklama)
- Tüm metin Türkçe olmalı
- Yalnızca JSON döndür`;
}
