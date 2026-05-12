// Prompt taslağı için DOCX builder. Mevcut draft/docx-export'tan
// bağımsız — şablon/wizard bağlam gerektirmez, sadece
// PromptDraftDocument alır.

import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { PromptDraftDocument } from "./types";

const C = {
  ink: "1F1924",
} as const;

const SZ = {
  title: 32,
  heading: 24,
  body: 22,
} as const;

function paragraphs(text: string, opts: { justify?: boolean; spaceAfter?: number } = {}): Paragraph[] {
  const blocks = (text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (blocks.length === 0) return [];
  return blocks.map(
    (p) =>
      new Paragraph({
        alignment: opts.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
        spacing: {
          after: opts.spaceAfter ?? 120,
          line: 300,
        },
        children: [
          new TextRun({
            text: p.replace(/\n/g, " "),
            size: SZ.body,
            color: C.ink,
          }),
        ],
      }),
  );
}

function emptyLine(): Paragraph {
  return new Paragraph({
    spacing: { after: 240 },
    children: [new TextRun({ text: "", size: SZ.body })],
  });
}

function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
    children: [
      new TextRun({
        text: title,
        bold: true,
        size: SZ.title,
        color: C.ink,
      }),
    ],
  });
}

function clauseParagraphs(heading: string, body: string, index: number): Paragraph[] {
  const headingPara = new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: `${index}. ${heading}`,
        bold: true,
        size: SZ.heading,
        color: C.ink,
      }),
    ],
  });
  return [headingPara, ...paragraphs(body, { justify: true })];
}

export async function buildPromptDraftDocx(
  draft: PromptDraftDocument,
): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(titleParagraph(draft.title || "Sözleşme"));
  const preambleBlocks = paragraphs(draft.preamble ?? "", {
    justify: true,
    spaceAfter: 240,
  });
  children.push(...preambleBlocks);

  draft.clauses.forEach((c, idx) => {
    children.push(...clauseParagraphs(c.heading, c.body, idx + 1));
  });

  const closingBlocks = paragraphs(draft.closing ?? "", { spaceAfter: 120 });
  if (closingBlocks.length > 0) {
    children.push(emptyLine());
    children.push(...closingBlocks);
  }

  // Document expects at least one paragraph; title already guarantees that.
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Calibri", size: SZ.body } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
