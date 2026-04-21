// ============================================================
// Negotiation Record DOCX — layout + typography
// ============================================================
//
// Word-native export of the "Kurul Müzakere Kaydı" record. Served
// via /api/runs/[runId]/record-docx and rendered in-page by the
// Dışa Aktar button on the verdict screen.
//
// Why DOCX, not PDF: @react-pdf's fontkit had silent WOFF metrics
// bugs that rendered all characters at x=0, making the PDF output
// unreadable. DOCX avoids the font-embedding problem entirely —
// Word uses the reader's system Calibri / Inter / Arial (all with
// full Turkish glyph coverage) and layout sizes everything itself.
//
// Design translation: PDF card-based layout is reproduced with
// single-cell tables. Colored left borders + cell shading give
// disagreement/summary/agent cards the same stripe-accent feel.
// Two-column tables handle badge rows and "önce/sonra" layouts.
// ============================================================

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { VerdictSeed } from "@/lib/boardroom-flow-store";

// ── Data contract ────────────────────────────────────────

export interface NegotiationRecordData {
  documentName: string;
  generatedAt: string;
  runId: string;
  verdict: VerdictSeed;
}

// ── Design tokens (hex, no # — docx wants it that way) ──

const C = {
  ink: "0F172A",
  muted: "64748B",
  mutedStrong: "475569",
  subtle: "F8FAFC",
  border: "E2E8F0",
  borderStrong: "CBD5E1",
  primary: "3B82F6",
  primarySoft: "DBEAFE",
  success: "10B981",
  successSoft: "D1FAE5",
  warning: "F59E0B",
  warningSoft: "FEF3C7",
  danger: "EF4444",
  dangerSoft: "FEE2E2",
  white: "FFFFFF",
};

// Font sizes are half-points in DOCX (22pt = 44).
const SZ = {
  title: 44,
  h2: 26,
  body: 21,
  small: 18,
  tiny: 16,
};

// ── Small builders ───────────────────────────────────────

function text(
  value: string,
  opts: {
    bold?: boolean;
    color?: string;
    size?: number;
    allCaps?: boolean;
  } = {},
): TextRun {
  return new TextRun({
    text: value,
    bold: opts.bold,
    color: opts.color,
    size: opts.size ?? SZ.body,
    allCaps: opts.allCaps,
  });
}

function p(
  children: TextRun[] | string,
  opts: {
    spacingBefore?: number;
    spacingAfter?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    keepNext?: boolean;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  } = {},
): Paragraph {
  const runs =
    typeof children === "string" ? [new TextRun({ text: children, size: SZ.body })] : children;
  return new Paragraph({
    children: runs,
    alignment: opts.alignment,
    keepNext: opts.keepNext,
    heading: opts.heading,
    spacing: {
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 0,
      line: 300, // 1.25× line spacing (240 = single)
    },
  });
}

function cellShading(fill: string) {
  return {
    fill,
    type: ShadingType.CLEAR,
    color: "auto",
  };
}

function leftAccentBorders(colorHex: string) {
  return {
    top: { style: BorderStyle.SINGLE, size: 2, color: C.border },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border },
    right: { style: BorderStyle.SINGLE, size: 2, color: C.border },
    left: { style: BorderStyle.SINGLE, size: 24, color: colorHex },
  };
}

function plainBorders(colorHex: string = C.border) {
  return {
    top: { style: BorderStyle.SINGLE, size: 2, color: colorHex },
    bottom: { style: BorderStyle.SINGLE, size: 2, color: colorHex },
    left: { style: BorderStyle.SINGLE, size: 2, color: colorHex },
    right: { style: BorderStyle.SINGLE, size: 2, color: colorHex },
  };
}

function noBorders() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
  };
}

// ── Section header ───────────────────────────────────────
//
// Colored bar character + uppercase section name. Uses the H2
// heading style so Word's navigation pane picks it up.
function sectionHeader(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 320, after: 160 },
    children: [
      new TextRun({
        text: "▌ ",
        color: C.primary,
        size: SZ.h2,
      }),
      new TextRun({
        text: title.toLocaleUpperCase("tr-TR"),
        bold: true,
        color: C.ink,
        size: SZ.h2,
      }),
    ],
  });
}

// ── Card builder (full-width single-cell table) ─────────

function card(
  borderColor: string,
  fill: string | null,
  children: Paragraph[],
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: C.border },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: C.border },
      left: { style: BorderStyle.SINGLE, size: 24, color: borderColor },
      right: { style: BorderStyle.SINGLE, size: 2, color: C.border },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
    },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            shading: fill ? cellShading(fill) : undefined,
            margins: { top: 160, bottom: 160, left: 200, right: 200 },
            borders: leftAccentBorders(borderColor),
            children,
          }),
        ],
      }),
    ],
  });
}

// ── Badge helpers ───────────────────────────────────────

function badge(label: string, fg: string, bg: string): TableCell {
  return new TableCell({
    shading: cellShading(bg),
    borders: noBorders(),
    margins: { top: 80, bottom: 80, left: 140, right: 140 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: label,
            bold: true,
            color: fg,
            size: SZ.small,
          }),
        ],
      }),
    ],
    width: { size: 1700, type: WidthType.DXA },
  });
}

function spacerCell(width = 160): TableCell {
  return new TableCell({
    borders: noBorders(),
    children: [new Paragraph({ children: [] })],
    width: { size: width, type: WidthType.DXA },
  });
}

// ── Helpers ────────────────────────────────────────────

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase("tr-TR");
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr-TR");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function riskBadge(level: VerdictSeed["riskLevel"]) {
  if (level === "high") return { label: "YÜKSEK RİSK", fg: C.danger, bg: C.dangerSoft };
  if (level === "medium") return { label: "ORTA RİSK", fg: C.warning, bg: C.warningSoft };
  return { label: "DÜŞÜK RİSK", fg: C.success, bg: C.successSoft };
}

function confidenceLabel(level: VerdictSeed["confidenceLevel"]): string | null {
  if (!level) return null;
  return { high: "GÜVEN: YÜKSEK", medium: "GÜVEN: ORTA", low: "GÜVEN: DÜŞÜK" }[level];
}

// ── Section builders ───────────────────────────────────

function coverBlock(data: NegotiationRecordData): (Paragraph | Table)[] {
  const risk = riskBadge(data.verdict.riskLevel);
  const conf = confidenceLabel(data.verdict.confidenceLevel);

  const badgeCells: TableCell[] = [
    badge(risk.label, risk.fg, risk.bg),
    spacerCell(),
  ];
  if (conf) {
    badgeCells.push(badge(conf, C.mutedStrong, C.subtle));
    badgeCells.push(spacerCell(9999)); // stretch remaining
  } else {
    badgeCells.push(spacerCell(9999));
  }

  const blocks: (Paragraph | Table)[] = [
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "▌ ", color: C.primary, size: SZ.small }),
        new TextRun({
          text: "AI BOARDROOM · KURUL MÜZAKERE KAYDI",
          bold: true,
          color: C.primary,
          size: SZ.small,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: data.documentName,
          bold: true,
          color: C.ink,
          size: SZ.title,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 260 },
      children: [
        new TextRun({
          text: formatDate(data.generatedAt),
          color: C.muted,
          size: SZ.body,
        }),
      ],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      },
      rows: [new TableRow({ children: badgeCells })],
    }),
  ];
  return blocks;
}

function summaryBlock(summary: string): (Paragraph | Table)[] {
  return [
    sectionHeader("Yönetici Özeti"),
    card(C.primary, C.subtle, [
      p([text(summary || "Özet bulunmuyor.", { color: C.ink })]),
    ]),
  ];
}

function decisionsBlock(decisions: string[]): (Paragraph | Table)[] {
  if (decisions.length === 0) return [];
  const out: (Paragraph | Table)[] = [sectionHeader("Ana Kararlar")];
  decisions.forEach((d, i) => {
    out.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: 360, hanging: 360 },
        children: [
          new TextRun({
            text: `${i + 1}.  `,
            bold: true,
            color: C.primary,
            size: SZ.body,
          }),
          new TextRun({ text: d, color: C.ink, size: SZ.body }),
        ],
      }),
    );
  });
  return out;
}

function agentPerspectivesBlock(
  perspectives: VerdictSeed["agentPerspectives"],
): (Paragraph | Table)[] {
  if (perspectives.length === 0) return [];
  const out: (Paragraph | Table)[] = [sectionHeader("Ajan Görüşleri")];
  perspectives.forEach((perspective) => {
    const initialsCell = new TableCell({
      shading: cellShading(C.primarySoft),
      borders: noBorders(),
      width: { size: 900, type: WidthType.DXA },
      margins: { top: 180, bottom: 180, left: 120, right: 120 },
      verticalAlign: "center",
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: initialsOf(perspective.agentName),
              bold: true,
              color: C.primary,
              size: 28,
            }),
          ],
        }),
      ],
    });
    const bodyCell = new TableCell({
      borders: noBorders(),
      margins: { top: 140, bottom: 140, left: 220, right: 160 },
      children: [
        p([text(perspective.agentName, { bold: true, color: C.ink })], {
          spacingAfter: 40,
        }),
        p([text(perspective.position, { color: C.ink })]),
      ],
    });
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: plainBorders(C.border),
        rows: [
          new TableRow({
            cantSplit: true,
            children: [initialsCell, bodyCell],
          }),
        ],
      }),
    );
    out.push(p([], { spacingAfter: 120 }));
  });
  return out;
}

function disagreementsBlock(
  verdict: VerdictSeed,
): (Paragraph | Table)[] {
  const resolved = verdict.resolvedDisagreements ?? [];
  const unresolved = verdict.unresolvedDisagreements ?? [];
  const flat = verdict.disagreements ?? [];
  const showFlat = resolved.length === 0 && unresolved.length === 0 && flat.length > 0;
  if (resolved.length === 0 && unresolved.length === 0 && !showFlat) return [];

  const out: (Paragraph | Table)[] = [sectionHeader("Görüş Ayrılıkları")];

  const renderCard = (
    accent: string,
    metaLabel: string,
    metaColor: string,
    topic: string,
    parties: string,
    detail: string,
  ) => {
    out.push(
      card(accent, C.subtle, [
        p([text(topic, { bold: true, color: C.ink })], { spacingAfter: 60 }),
        p(
          [
            new TextRun({
              text: `${metaLabel} · ${parties}`,
              color: metaColor,
              size: SZ.small,
              bold: true,
            }),
          ],
          { spacingAfter: 100 },
        ),
        p([text(detail, { color: C.ink })]),
      ]),
    );
    out.push(p([], { spacingAfter: 120 }));
  };

  resolved.forEach((d) =>
    renderCard(C.success, "ÇÖZÜLDÜ", C.success, d.topic, `${d.agentA} ↔ ${d.agentB}`, d.resolution),
  );
  unresolved.forEach((d) =>
    renderCard(C.warning, "AÇIK", C.warning, d.topic, `${d.agentA} ↔ ${d.agentB}`, d.reason),
  );
  if (showFlat) {
    flat.forEach((d) =>
      renderCard(C.primary, "GÖRÜŞ AYRILIĞI", C.primary, d.topic, `${d.agentA} ↔ ${d.agentB}`, d.resolution),
    );
  }

  return out;
}

function positionChangesBlock(
  changes: NonNullable<VerdictSeed["positionChanges"]>,
): (Paragraph | Table)[] {
  if (!changes?.length) return [];
  const out: (Paragraph | Table)[] = [sectionHeader("Pozisyon Değişimleri")];
  changes.forEach((pc) => {
    const halfCell = (label: string, body: string) =>
      new TableCell({
        borders: noBorders(),
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        children: [
          p(
            [
              new TextRun({
                text: label,
                bold: true,
                color: C.muted,
                size: SZ.tiny,
              }),
            ],
            { spacingAfter: 60 },
          ),
          p([text(body, { color: C.ink })]),
        ],
      });
    out.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: plainBorders(C.border),
        rows: [
          new TableRow({
            cantSplit: true,
            children: [
              new TableCell({
                borders: noBorders(),
                columnSpan: 2,
                margins: { top: 140, bottom: 40, left: 160, right: 160 },
                children: [
                  p([text(pc.agentName, { bold: true, color: C.ink })], {
                    spacingAfter: 40,
                  }),
                  p([
                    new TextRun({
                      text: pc.topic,
                      color: C.muted,
                      size: SZ.small,
                    }),
                  ]),
                ],
              }),
            ],
          }),
          new TableRow({
            cantSplit: true,
            children: [
              halfCell("ÖNCE", pc.previousStance),
              halfCell("SONRA", pc.updatedStance),
            ],
          }),
        ],
      }),
    );
    out.push(p([], { spacingAfter: 120 }));
  });
  return out;
}

function actionItemsBlock(items: string[]): (Paragraph | Table)[] {
  if (items.length === 0) return [];
  const out: (Paragraph | Table)[] = [sectionHeader("Önerilen Aksiyonlar")];
  items.forEach((a) => {
    out.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        indent: { left: 360, hanging: 360 },
        children: [
          new TextRun({
            text: "☐  ",
            color: C.borderStrong,
            size: SZ.body,
          }),
          new TextRun({ text: a, color: C.ink, size: SZ.body }),
        ],
      }),
    );
  });
  return out;
}

// ── Main renderer ──────────────────────────────────────

export async function renderNegotiationRecordDocx(
  data: NegotiationRecordData,
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    ...coverBlock(data),
    ...summaryBlock(data.verdict.summary),
    ...decisionsBlock(data.verdict.decisions),
    ...agentPerspectivesBlock(data.verdict.agentPerspectives),
    ...disagreementsBlock(data.verdict),
    ...positionChangesBlock(data.verdict.positionChanges ?? []),
    ...actionItemsBlock(data.verdict.actionItems),
  ];

  const doc = new Document({
    creator: "AI Boardroom",
    title: `Kurul Müzakere Kaydı — ${data.documentName}`,
    description: "AI Boardroom kurul tartışma çıktısı",
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: SZ.body, color: C.ink },
        },
        heading2: {
          run: { font: "Calibri", size: SZ.h2, bold: true, color: C.ink },
          paragraph: { spacing: { before: 320, after: 160 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1200,
              right: 1200,
              bottom: 1400,
              left: 1200,
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                tabStops: [{ type: "right", position: 9000 }],
                border: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: C.border, space: 8 },
                },
                children: [
                  new TextRun({
                    text: `Run ${data.runId.slice(0, 8)} · ${formatDate(data.generatedAt)}`,
                    color: C.muted,
                    size: SZ.tiny,
                  }),
                  new TextRun({ text: "\t", size: SZ.tiny }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: C.muted,
                    size: SZ.tiny,
                  }),
                  new TextRun({ text: " / ", color: C.muted, size: SZ.tiny }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    color: C.muted,
                    size: SZ.tiny,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
    numbering: {
      config: [
        {
          reference: "decisions",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
