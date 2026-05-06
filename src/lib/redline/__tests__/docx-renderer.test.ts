import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  applyRedline,
  colorizeRuns,
  isSectionHeading,
} from "../docx-renderer";
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

describe("applyRedline — revision colors", () => {
  it("emits red on deleted runs and green on inserted runs", async () => {
    const docx = await makeDocx([
      "4. BAYİ YETKİ DERECELERİ. Bayi aşağıdaki yetkilere sahiptir.",
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
    const xml = await readDocumentXml(result.buffer);
    // Red on the <w:delText> run, green on the <w:t> insertion run.
    expect(xml).toMatch(
      /<w:del[^>]*>\s*<w:r>\s*<w:rPr><w:color w:val="C00000"\/><\/w:rPr>\s*<w:delText/,
    );
    expect(xml).toMatch(
      /<w:ins[^>]*>\s*<w:r>\s*<w:rPr><w:color w:val="00B050"\/><\/w:rPr>\s*<w:t/,
    );
  });

  it("colors whole-paragraph replace_clause deletions red and insertions green", async () => {
    const docx = await makeDocx([
      "Madde 5 Süre",
      "Sözleşme bir yıl süreyle geçerlidir.",
    ]);
    const result = await applyRedline(docx, [
      editOf({
        clauseRef: "Sözleşme bir yıl süreyle geçerlidir.",
        editType: "replace_clause",
        originalText: "Sözleşme bir yıl süreyle geçerlidir.",
        finalText: "Sözleşme iki yıl süreyle geçerlidir.",
      }),
    ]);
    expect(result.appliedCount).toBe(1);
    const xml = await readDocumentXml(result.buffer);
    expect(xml).toContain(`<w:color w:val="C00000"/>`);
    expect(xml).toContain(`<w:color w:val="00B050"/>`);
    // Highlight intentionally not emitted — colors only.
    expect(xml).not.toContain(`<w:highlight w:val="green"/>`);
  });
});

describe("colorizeRuns — CT_RPr schema ordering", () => {
  it("splices w:color after w:b (color's schema rank is higher)", () => {
    const input = `<w:r><w:rPr><w:b/></w:rPr><w:t>x</w:t></w:r>`;
    const output = colorizeRuns(input, "00B050");
    expect(output).toContain(
      `<w:rPr><w:b/><w:color w:val="00B050"/></w:rPr>`,
    );
  });

  it("splices w:color before w:sz (color outranks sz)", () => {
    const input = `<w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t>x</w:t></w:r>`;
    const output = colorizeRuns(input, "C00000");
    expect(output).toContain(
      `<w:rPr><w:color w:val="C00000"/><w:sz w:val="22"/></w:rPr>`,
    );
  });

  it("places w:highlight after w:sz but keeps w:color before it", () => {
    const input =
      `<w:r><w:rPr><w:b/><w:sz w:val="22"/></w:rPr><w:t>x</w:t></w:r>`;
    const output = colorizeRuns(input, "00B050", "green");
    // CT_RPr: b(rank 2) → color(18) → sz(23) → highlight(25)
    expect(output).toContain(
      `<w:rPr><w:b/><w:color w:val="00B050"/><w:sz w:val="22"/><w:highlight w:val="green"/></w:rPr>`,
    );
  });

  it("strips prior w:color and w:highlight before re-injection", () => {
    const input =
      `<w:r><w:rPr><w:b/><w:color w:val="000000"/><w:highlight w:val="yellow"/></w:rPr><w:t>x</w:t></w:r>`;
    const output = colorizeRuns(input, "00B050", "green");
    expect(output).toContain(
      `<w:rPr><w:b/><w:color w:val="00B050"/><w:highlight w:val="green"/></w:rPr>`,
    );
    expect(output).not.toContain(`w:val="000000"`);
    expect(output).not.toContain(`w:val="yellow"`);
  });

  it("handles self-closing rPr and runs without rPr", () => {
    const selfClosing = colorizeRuns(
      `<w:r><w:rPr/><w:t>x</w:t></w:r>`,
      "00B050",
      "green",
    );
    expect(selfClosing).toContain(
      `<w:rPr><w:color w:val="00B050"/><w:highlight w:val="green"/></w:rPr>`,
    );
    const bareRun = colorizeRuns(`<w:r><w:t>x</w:t></w:r>`, "C00000");
    expect(bareRun).toContain(
      `<w:r><w:rPr><w:color w:val="C00000"/></w:rPr><w:t>x</w:t></w:r>`,
    );
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
