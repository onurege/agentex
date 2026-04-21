import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { applyRedline, isSectionHeading } from "../docx-renderer";
import type { ArbitratedEdit } from "../types";

async function makeDocx(paragraphs: string[]): Promise<Buffer> {
  const zip = new JSZip();
  const parasXml = paragraphs
    .map(
      (t) =>
        `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`,
    )
    .join("");
  const documentXml =
    `<?xml version="1.0"?>\n` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:body>${parasXml}</w:body></w:document>`;
  zip.file("word/document.xml", documentXml);
  return (await zip.generateAsync({ type: "nodebuffer" })) as Buffer;
}

async function readDocumentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/document.xml");
  if (!file) throw new Error("document.xml missing");
  return await file.async("string");
}

function editOf(partial: Partial<ArbitratedEdit>): ArbitratedEdit {
  return {
    id: partial.id ?? "e1",
    clauseRef: partial.clauseRef ?? "",
    editType: partial.editType ?? "replace_phrase",
    originalText: partial.originalText,
    finalText: partial.finalText ?? "",
    sourceProposals: partial.sourceProposals ?? [],
    arbitrationNote: partial.arbitrationNote ?? "",
    resolution: partial.resolution ?? "accepted_a",
    finalSeverity: partial.finalSeverity ?? "info",
  };
}

describe("isSectionHeading", () => {
  it("accepts digit-prefix uppercase titles (Turkish contract style)", () => {
    expect(isSectionHeading("4. BAYİ YETKİ DERECELERİ")).toBe(true);
  });

  it("rejects lettered subclauses so fallback keeps walking past them", () => {
    expect(isSectionHeading("a. BAYİ hakları")).toBe(false);
  });

  it("accepts 'Madde N' and 'Article N' anchor headings", () => {
    expect(isSectionHeading("Madde 5 Süre")).toBe(true);
    expect(isSectionHeading("Article 5 Term")).toBe(true);
  });

  it("accepts appendix markers 'EK - 3: MALİ KOŞULLAR'", () => {
    expect(isSectionHeading("EK - 3: MALİ KOŞULLAR")).toBe(true);
    expect(isSectionHeading("EK 3 MALİ")).toBe(true);
  });

  it("rejects normal body text", () => {
    expect(isSectionHeading("Normal metin içeriği buradadır.")).toBe(false);
  });

  it("rejects digit-prefix with lowercase body (not a heading in practice)", () => {
    expect(isSectionHeading("4. bayi şu yetkilere sahiptir")).toBe(false);
  });
});

describe("applyRedline — replace_phrase single-paragraph happy path", () => {
  it("rewrites the phrase inside the matched paragraph (regression guard)", async () => {
    const docx = await makeDocx([
      "4. BAYİ YETKİ DERECELERİ. Bayi aşağıdaki yetkilere sahiptir.",
      "Diğer paragraf metni.",
    ]);
    const result = await applyRedline(docx, [
      editOf({
        clauseRef: "4. BAYİ YETKİ DERECELERİ",
        editType: "replace_phrase",
        originalText: "Bayi aşağıdaki yetkilere sahiptir",
        finalText: "Bayi şu yetkilere sahiptir",
      }),
    ]);
    expect(result.appliedCount).toBe(1);
    expect(result.orphanCount).toBe(0);
    const xml = await readDocumentXml(result.buffer);
    expect(xml).toContain("<w:delText");
    expect(xml).toContain("<w:ins");
    expect(xml).toContain("Bayi şu yetkilere sahiptir");
  });
});

describe("applyRedline — replace_phrase heading-fallback walk", () => {
  it("falls through to the next body paragraph when the heading lacks the phrase", async () => {
    const docx = await makeDocx([
      "4. BAYİ YETKİ DERECELERİ",
      "Bayi aşağıdaki yetkilere sahip olacaktır.",
      "Ek olarak bazı kurallar uygulanır.",
    ]);
    const result = await applyRedline(docx, [
      editOf({
        clauseRef: "4. BAYİ YETKİ DERECELERİ",
        editType: "replace_phrase",
        originalText: "Bayi aşağıdaki yetkilere sahip olacaktır",
        finalText: "Bayi şu yetkilere sahip olacaktır",
      }),
    ]);
    expect(result.appliedCount).toBe(1);
    expect(result.orphanCount).toBe(0);
    const xml = await readDocumentXml(result.buffer);
    expect(xml).toContain("Bayi şu yetkilere sahip olacaktır");
    expect(xml).toContain("<w:ins");
  });

  it("stops walking at the next section heading and reports orphan", async () => {
    const docx = await makeDocx([
      "4. BAYİ YETKİ DERECELERİ",
      "Kısa giriş paragrafı.",
      "5. SÜRE VE FESİH",
      "Hedef ibare sonraki bölümde yer alıyor ama orada değil.",
    ]);
    const result = await applyRedline(docx, [
      editOf({
        clauseRef: "4. BAYİ YETKİ DERECELERİ",
        editType: "replace_phrase",
        originalText: "Hedef ibare sonraki bölümde",
        finalText: "Değiştirilmiş ibare",
      }),
    ]);
    expect(result.appliedCount).toBe(0);
    expect(result.orphanCount).toBe(1);
  });
});

describe("applyRedline — true orphan", () => {
  it("records orphan when the phrase does not appear anywhere in the section", async () => {
    const docx = await makeDocx([
      "4. BAYİ YETKİ DERECELERİ",
      "İlk paragraf.",
      "İkinci paragraf.",
    ]);
    const result = await applyRedline(docx, [
      editOf({
        clauseRef: "4. BAYİ YETKİ DERECELERİ",
        editType: "replace_phrase",
        originalText: "hiçbir yerde olmayan benzersiz ifade",
        finalText: "değiştirilmiş metin",
      }),
    ]);
    expect(result.appliedCount).toBe(0);
    expect(result.orphanCount).toBe(1);
  });
});
