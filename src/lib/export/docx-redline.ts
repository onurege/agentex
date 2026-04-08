// ============================================================
// DOCX Redline Export — visual redline revision report
// ============================================================
//
// Generates a downloadable .docx file presenting revision
// suggestions in a contract-review-friendly redline format:
//   - Old/original text: red + strikethrough
//   - New/revised text:  green + bold
//   - Section refs, agent attribution, rationale
//
// This is a visual redline approach, not OOXML tracked changes.
// A future implementation can replace this with real <w:ins>/<w:del>
// markup using the same input data.
// ============================================================

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
} from "docx";
import { saveAs } from "file-saver";
import type { RevisionSuggestion } from "../types";
import { AGENTS } from "../agents";

// --- Types ---

export interface RedlineExportOptions {
  /** Document/review title */
  title: string;
  /** Source file name */
  fileName?: string;
  /** Export date (defaults to now) */
  date?: string;
  /** Revision suggestions to include */
  revisions: RevisionSuggestion[];
}

// --- Colors ---

const RED = "CC0000";
const GREEN = "008000";
const GRAY = "666666";
const DARK = "1A1A1A";
const LIGHT_GRAY = "999999";

// --- Priority Labels ---

const PRIORITY_LABELS: Record<string, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

// --- Generator ---

export function generateRedlineDocx(options: RedlineExportOptions): Document {
  const { title, fileName, date, revisions } = options;
  const exportDate = date ?? new Date().toLocaleDateString("tr-TR");

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: title,
          bold: true,
          size: 32,
          color: DARK,
        }),
      ],
    }),
  );

  // Subtitle
  const subtitleParts: string[] = [];
  if (fileName) subtitleParts.push(fileName);
  subtitleParts.push(exportDate);
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: subtitleParts.join(" — "),
          size: 20,
          color: GRAY,
          italics: true,
        }),
      ],
    }),
  );

  // Summary
  const highCount = revisions.filter((r) => r.priority === "high").length;
  const summaryText = `${revisions.length} revizyon önerisi${highCount > 0 ? ` (${highCount} yüksek öncelikli)` : ""}`;
  children.push(
    new Paragraph({
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: summaryText,
          size: 20,
          color: GRAY,
        }),
      ],
    }),
  );

  // Separator
  children.push(createSeparator());

  // Revisions
  revisions.forEach((rev, index) => {
    const agent = AGENTS[rev.agentId];
    const agentName = agent?.shortName ?? rev.agentId;
    const priorityLabel = PRIORITY_LABELS[rev.priority] ?? rev.priority;

    // Section heading
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({
            text: `${index + 1}. ${rev.section}`,
            bold: true,
            size: 24,
            color: DARK,
          }),
        ],
      }),
    );

    // Agent + priority
    children.push(
      new Paragraph({
        spacing: { after: 150 },
        children: [
          new TextRun({
            text: `${agentName}`,
            size: 18,
            color: GRAY,
          }),
          new TextRun({
            text: `  |  Öncelik: ${priorityLabel}`,
            size: 18,
            color: GRAY,
          }),
        ],
      }),
    );

    // "Mevcut Metin" label
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          new TextRun({
            text: "Mevcut Metin:",
            bold: true,
            size: 18,
            color: LIGHT_GRAY,
          }),
        ],
      }),
    );

    // Old text — red + strikethrough
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 400 },
        children: [
          new TextRun({
            text: rev.currentText,
            color: RED,
            strike: true,
            size: 20,
          }),
        ],
      }),
    );

    // "Önerilen Metin" label
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          new TextRun({
            text: "Önerilen Metin:",
            bold: true,
            size: 18,
            color: LIGHT_GRAY,
          }),
        ],
      }),
    );

    // New text — green + bold
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        indent: { left: 400 },
        children: [
          new TextRun({
            text: rev.suggestedText,
            color: GREEN,
            bold: true,
            size: 20,
          }),
        ],
      }),
    );

    // Rationale
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 50 },
        children: [
          new TextRun({
            text: "Gerekçe: ",
            bold: true,
            size: 18,
            color: LIGHT_GRAY,
          }),
          new TextRun({
            text: rev.rationale,
            italics: true,
            size: 18,
            color: GRAY,
          }),
        ],
      }),
    );

    // Separator between revisions
    if (index < revisions.length - 1) {
      children.push(createSeparator());
    }
  });

  // Footer
  children.push(
    new Paragraph({
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Agentex Sözleşme İnceleme Sistemi — ${exportDate}`,
          size: 16,
          color: LIGHT_GRAY,
          italics: true,
        }),
      ],
    }),
  );

  return new Document({
    sections: [
      {
        children,
      },
    ],
  });
}

function createSeparator(): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 1,
        color: "CCCCCC",
      },
    },
    children: [],
  });
}

// --- Download Helper ---

export async function downloadRedlineDocx(
  options: RedlineExportOptions,
): Promise<void> {
  const doc = generateRedlineDocx(options);
  const blob = await Packer.toBlob(doc);

  const baseName = options.fileName
    ? options.fileName.replace(/\.[^.]+$/, "")
    : "revizyon-raporu";

  saveAs(blob, `${baseName}_redline.docx`);
}
