// ============================================================
// Draft Module — DOCX Export
// ============================================================
//
// ClauseText[] ve şablon metasını alıp imzalanmaya hazır bir
// DOCX üretir. Sunucu tarafında (nodejs runtime) çalışır; sonuç
// Buffer olarak döner ve API route tarafından stream edilir.
//
// Layout:
//   - Başlık (merkezli, büyük, bold — documentTitle)
//   - Her madde: "Madde N — Başlık" (bold) + body paragrafları
//   - İmza bloğu (iki sütun): Taraf A / Taraf B
//     — Şablondan "parti" id'lerini keşfederek otomatik üretir.
// ============================================================

import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type {
  ClauseText,
  DraftSession,
  DraftTemplate,
} from "./types";
import { formatAnswer } from "./renderer";

const C = {
  ink: "0F172A",
  muted: "64748B",
  border: "CBD5E1",
};

// docx yarı-punto kullanır: 22pt → 44.
const SZ = {
  title: 36,
  clauseHeading: 24,
  body: 22,
  signature: 22,
  small: 18,
};

export interface BuildDocxInput {
  template: DraftTemplate;
  session: DraftSession;
  renderedClauses: ClauseText[];
}

export async function buildDraftDocx(
  input: BuildDocxInput,
): Promise<Buffer> {
  const { template, session, renderedClauses } = input;

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: SZ.body },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          titleParagraph(template.documentTitle),
          spacer(240),
          ...renderedClauses.flatMap((c) => clauseBlock(c)),
          spacer(480),
          signatureBlock(template, session),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
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

function clauseBlock(c: ClauseText): Paragraph[] {
  const heading = new Paragraph({
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text: `${c.number} — ${c.title}`,
        bold: true,
        size: SZ.clauseHeading,
        color: C.ink,
      }),
    ],
  });

  // Body'yi paragraflara böl (iki newline = yeni paragraf; tek newline
  // Word'ün düz akışına bırakılır).
  const paragraphs = c.body
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0)
    .map(
      (p) =>
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 120, line: 300 },
          children: inlineTextRuns(p, SZ.body),
        }),
    );

  return [heading, ...paragraphs];
}

function spacer(height: number): Paragraph {
  return new Paragraph({
    spacing: { after: height },
    children: [new TextRun({ text: "" })],
  });
}

/**
 * İmza bloğunu şablondaki taraf "name" question'larından keşfederek
 * üretir. Her şablonda iki taraf var; desen birleşik değil, ama id
 * prefix'leri değişiyor (NDA: partyA/partyB, Distributor: supplier/
 * dealer, Service: client/contractor). Heuristic: ".name" ile biten
 * ilk iki question'ın cevaplarını al.
 */
function signatureBlock(
  template: DraftTemplate,
  session: DraftSession,
): Table {
  const nameQuestions = template.questions.filter((q) =>
    q.id.endsWith(".name"),
  );
  const [a, b] = nameQuestions;

  const partyAName = a
    ? formatAnswer(template, a.id, session.answers[a.id] || "Taraf A", session.answers)
    : "Taraf A";
  const partyBName = b
    ? formatAnswer(template, b.id, session.answers[b.id] || "Taraf B", session.answers)
    : "Taraf B";

  const partyACol = buildPartyColumn(
    stripInlineBold(partyAName),
    partyRepresentative(template, session, a?.id ?? ""),
  );
  const partyBCol = buildPartyColumn(
    stripInlineBold(partyBName),
    partyRepresentative(template, session, b?.id ?? ""),
  );

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 9000, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
      insideHorizontal: {
        style: BorderStyle.NONE,
        size: 0,
        color: "FFFFFF",
      },
      insideVertical: {
        style: BorderStyle.NONE,
        size: 0,
        color: "FFFFFF",
      },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            children: partyACol,
          }),
          new TableCell({
            width: { size: 4500, type: WidthType.DXA },
            children: partyBCol,
          }),
        ],
      }),
    ],
  });
}

function inlineTextRuns(text: string, size: number): TextRun[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => {
    const isBold = /^\*\*[^*]+\*\*$/.test(part);
    return new TextRun({
      text: isBold ? part.slice(2, -2) : part,
      bold: isBold,
      size,
      color: C.ink,
    });
  });
}

function stripInlineBold(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1");
}

function partyRepresentative(
  template: DraftTemplate,
  session: DraftSession,
  nameQuestionId: string,
): string {
  if (!nameQuestionId) return "";
  const prefix = nameQuestionId.replace(/\.name$/, "");
  const repId = `${prefix}.representative`;
  return (session.answers[repId] as string) ?? "";
}

function buildPartyColumn(name: string, representative: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: name,
          bold: true,
          size: SZ.signature,
          color: C.ink,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 480 },
      children: [
        new TextRun({
          text: representative ? `Temsilci: ${representative}` : "",
          size: SZ.small,
          color: C.muted,
        }),
      ],
    }),
    new Paragraph({
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, color: C.border },
      },
      spacing: { after: 60 },
      children: [new TextRun({ text: "" })],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "İmza",
          size: SZ.small,
          color: C.muted,
        }),
      ],
    }),
  ];
}
