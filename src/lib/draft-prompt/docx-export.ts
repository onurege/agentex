// Prompt taslağı için DOCX builder. Türk hukuk pratiğine uygun
// profesyonel görünüm hedefler:
//   - Times New Roman, 11pt body, 1.5 satır
//   - Başlık ALL CAPS, 18pt bold, ortalı, alttan ince çizgi
//   - "MADDE N — BAŞLIK" formatı (büyük harf), kalın
//   - Justify gövde + ilk satır 1cm girinti
//   - Otomatik sayfa numarası footer

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { PromptDraftDocument } from "./types";

// docx yarı-punto kullanır: yarı = font_pt × 2.
const SZ = {
  title: 36, // 18pt
  heading: 24, // 12pt
  body: 22, // 11pt
  footer: 18, // 9pt
} as const;

const COLOR = {
  ink: "0F172A", // slate-900
  muted: "475569", // slate-600
  rule: "CBD5E1", // slate-300
} as const;

const FONT = "Times New Roman";

// Alt-madde / liste işaretçileri: "3.1.", "3.1", "(a)", "(1)", "a)",
// "1)", "-" (cümle başında). AI bazen bunları tek paragrafta birleştiriyor;
// builder bu durumlarda otomatik ayrıştırır.
const SUBCLAUSE_LEAD_RE = /\d+\.\d+\.?\s|\d+\.\s|\(\w+\)\s|\w+\)\s/;
const BULLET_LEAD_RE = /-\s+[A-ZÇĞİÖŞÜ]/;

function splitBodyBlocks(text: string): string[] {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    // Tek-newline'lı alt maddeleri \n\n'e yükselt.
    .replace(/\s+(?=\d+\.\d+\.?\s)/g, "\n\n")
    .replace(/\s+(?=\(\w+\)\s)/g, "\n\n")
    // Aynı satırda "- Terim:" tarzı liste başlangıçları
    .replace(/\s+(?=-\s+[A-ZÇĞİÖŞÜ])/g, "\n\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function classifyBlock(text: string): {
  kind: "subclause" | "bullet" | "plain";
  leader: string;
  rest: string;
} {
  // /s (dotAll) flag isteyen ES2018+'a takılmamak için [\s\S] kullanıyoruz.
  const sub = text.match(/^(\d+\.\d+\.?|\d+\.|\(\w+\)|\w+\))\s+([\s\S]*)$/);
  if (sub) return { kind: "subclause", leader: sub[1], rest: sub[2].trim() };
  const bullet = text.match(/^-\s+([\s\S]*)$/);
  if (bullet) return { kind: "bullet", leader: "•", rest: bullet[1].trim() };
  return { kind: "plain", leader: "", rest: text };
}

function bodyParagraphs(
  text: string,
  opts: { indent?: boolean; justify?: boolean; spaceAfter?: number } = {},
): Paragraph[] {
  const blocks = splitBodyBlocks(text);
  if (blocks.length === 0) return [];

  return blocks.map((p) => {
    const cls = classifyBlock(p);
    const isList = cls.kind === "subclause" || cls.kind === "bullet";

    // Liste/alt-madde paragrafları hanging indent ile: sol kenarda
    // 0.7cm girinti, ilk satır -0.7cm (yani leader hizada başlar).
    const indent = isList
      ? { left: 397, hanging: 397 } // 0.7cm = 397 twips
      : opts.indent
        ? { firstLine: 567 }
        : undefined;

    const children: TextRun[] = [];
    if (isList && cls.leader) {
      children.push(
        new TextRun({
          text: `${cls.leader} `, // leader + non-breaking space
          bold: true,
          size: SZ.body,
          color: COLOR.ink,
          font: FONT,
        }),
      );
    }
    children.push(
      new TextRun({
        text: (isList ? cls.rest : p).replace(/\n/g, " "),
        size: SZ.body,
        color: COLOR.ink,
        font: FONT,
      }),
    );

    return new Paragraph({
      alignment: opts.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      spacing: {
        after: isList ? 120 : (opts.spaceAfter ?? 180),
        line: 360, // 1.5x line height
      },
      indent,
      children,
    });
  });
}

function titleParagraph(title: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 240 },
    border: {
      bottom: {
        color: COLOR.rule,
        space: 6,
        style: BorderStyle.SINGLE,
        size: 6,
      },
    },
    children: [
      new TextRun({
        text: (title || "Sözleşme").toLocaleUpperCase("tr-TR"),
        bold: true,
        size: SZ.title,
        color: COLOR.ink,
        font: FONT,
      }),
    ],
  });
}

function clauseHeading(heading: string, index: number): Paragraph[] {
  const labelLeft = `MADDE ${index}`;
  const labelRight = (heading || "").toLocaleUpperCase("tr-TR").trim();
  return [
    new Paragraph({
      spacing: { before: 420, after: 220 },
      keepNext: true,
      border: {
        bottom: {
          color: COLOR.rule,
          space: 4,
          style: BorderStyle.SINGLE,
          size: 4,
        },
      },
      children: [
        new TextRun({
          text: labelLeft,
          bold: true,
          size: SZ.heading,
          color: COLOR.muted,
          font: FONT,
        }),
        new TextRun({
          text: " — ",
          bold: true,
          size: SZ.heading,
          color: COLOR.muted,
          font: FONT,
        }),
        new TextRun({
          text: labelRight,
          bold: true,
          size: SZ.heading,
          color: COLOR.ink,
          font: FONT,
        }),
      ],
    }),
  ];
}

function spacer(twips: number): Paragraph {
  return new Paragraph({
    spacing: { after: twips },
    children: [new TextRun({ text: "", size: SZ.body, font: FONT })],
  });
}

function footerWithPageNumber(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT, " / ", PageNumber.TOTAL_PAGES],
            size: SZ.footer,
            color: COLOR.muted,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

export async function buildPromptDraftDocx(
  draft: PromptDraftDocument,
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Başlık
  children.push(titleParagraph(draft.title));
  children.push(spacer(120));

  // Taraflar paragrafı — ilk satır girintisi yok, justify
  const preamble = bodyParagraphs(draft.preamble ?? "", {
    justify: true,
    spaceAfter: 240,
  });
  children.push(...preamble);

  // Maddeler
  draft.clauses.forEach((c, idx) => {
    children.push(...clauseHeading(c.heading, idx + 1));
    children.push(
      ...bodyParagraphs(c.body ?? "", {
        justify: true,
        indent: false,
        spaceAfter: 200,
      }),
    );
  });

  // Kapanış + imza alanı
  const closing = bodyParagraphs(draft.closing ?? "", {
    justify: true,
    spaceAfter: 200,
  });
  if (closing.length > 0) {
    children.push(spacer(360));
    children.push(...closing);
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SZ.body, color: COLOR.ink } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1700, // 1.18 inch
              right: 1700,
              bottom: 1700,
              left: 1700,
            },
          },
        },
        footers: { default: footerWithPageNumber() },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}
