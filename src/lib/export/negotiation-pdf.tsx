// ============================================================
// Negotiation Record PDF — layout + typography
// ============================================================
//
// React-PDF document for the "Kurul Müzakere Kaydı" export. The
// verdict page's Dışa Aktar button hits /api/runs/[runId]/record-pdf,
// which renders this component to a buffer via @react-pdf/renderer.
//
// Design notes:
//   - Light theme (PDFs are read on paper/neutral backgrounds). Brand
//     accent picked from the app's workspace tokens (primary blue
//     #3B82F6, success/warning from the accent palette).
//   - Latin-Extended Inter at 400/600/700 registered from
//     node_modules/@fontsource/inter so Turkish glyphs (İ, ş, ğ, ö, ç, ü)
//     render correctly. Hyphenation is disabled — the default English
//     rules produce wrong breaks in Turkish.
//   - Per-card wrap={false} keeps individual decision/agent/disagreement
//     cards from splitting mid-card across page boundaries. Sections
//     themselves are allowed to wrap so a long list (many agents) can
//     flow into a following page instead of clipping.
//   - Footer is `fixed` so it repeats on every page with run id + date
//     + page number.
// ============================================================

import path from "node:path";
import React from "react";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { VerdictSeed } from "@/lib/boardroom-flow-store";

// ── Font registration ──────────────────────────────────

const FONTS_DIR = path.join(
  process.cwd(),
  "node_modules/@fontsource/inter/files",
);

Font.register({
  family: "Inter",
  fonts: [
    {
      src: path.join(FONTS_DIR, "inter-latin-ext-400-normal.woff"),
      fontWeight: 400,
    },
    {
      src: path.join(FONTS_DIR, "inter-latin-ext-600-normal.woff"),
      fontWeight: 600,
    },
    {
      src: path.join(FONTS_DIR, "inter-latin-ext-700-normal.woff"),
      fontWeight: 700,
    },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// ── Design tokens ──────────────────────────────────────

const C = {
  ink: "#0F172A",
  muted: "#64748B",
  subtle: "#F8FAFC",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  primary: "#3B82F6",
  primarySoft: "#DBEAFE",
  success: "#10B981",
  successSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  white: "#FFFFFF",
};

// ── Props ──────────────────────────────────────────────

export interface NegotiationRecordData {
  documentName: string;
  generatedAt: string;
  runId: string;
  verdict: VerdictSeed;
}

// ── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    backgroundColor: C.white,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Inter",
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.5,
  },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
    marginRight: 8,
  },
  brandText: {
    fontWeight: 600,
    fontSize: 9.5,
    letterSpacing: 1.2,
    color: C.primary,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 6,
    lineHeight: 1.25,
  },
  meta: {
    color: C.muted,
    fontSize: 10,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 24,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    fontSize: 9,
    fontWeight: 600,
    marginRight: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionBullet: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: C.ink,
    letterSpacing: 0.4,
  },
  summaryBox: {
    backgroundColor: C.subtle,
    borderLeftWidth: 3,
    borderLeftColor: C.primary,
    padding: 14,
  },
  summaryText: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: C.ink,
  },
  decisionItem: {
    flexDirection: "row",
    marginBottom: 8,
  },
  decisionNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.primarySoft,
    color: C.primary,
    fontSize: 10,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 10,
  },
  decisionText: {
    flex: 1,
    fontSize: 10.5,
    color: C.ink,
    lineHeight: 1.5,
    paddingTop: 3,
  },
  agentCard: {
    flexDirection: "row",
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  },
  agentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.primarySoft,
    color: C.primary,
    fontSize: 10.5,
    fontWeight: 700,
    textAlign: "center",
    paddingTop: 7,
    marginRight: 10,
  },
  agentBody: { flex: 1 },
  agentName: {
    fontSize: 11,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 2,
  },
  agentPosition: { fontSize: 10, color: C.ink, lineHeight: 1.5 },
  disagreementCard: {
    borderLeftWidth: 3,
    padding: 12,
    marginBottom: 8,
    backgroundColor: C.subtle,
  },
  disagreementTopic: {
    fontWeight: 700,
    fontSize: 10.5,
    color: C.ink,
    marginBottom: 4,
  },
  disagreementMeta: {
    fontSize: 8.5,
    fontWeight: 600,
    color: C.muted,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  disagreementDetail: {
    fontSize: 10,
    color: C.ink,
    lineHeight: 1.5,
  },
  pcCard: {
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  pcAgent: {
    fontSize: 10.5,
    fontWeight: 700,
    color: C.ink,
    marginBottom: 2,
  },
  pcTopic: {
    fontSize: 9.5,
    color: C.muted,
    marginBottom: 10,
  },
  pcRow: { flexDirection: "row" },
  pcHalf: { flex: 1, paddingRight: 8 },
  pcLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: C.muted,
    marginBottom: 4,
    letterSpacing: 0.8,
  },
  pcText: { fontSize: 10, color: C.ink, lineHeight: 1.45 },
  actionItem: {
    flexDirection: "row",
    marginBottom: 7,
    alignItems: "flex-start",
  },
  actionBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: C.borderStrong,
    borderRadius: 2,
    marginRight: 8,
    marginTop: 4,
  },
  actionText: {
    flex: 1,
    fontSize: 10.5,
    color: C.ink,
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  footerText: {
    fontSize: 8.5,
    color: C.muted,
  },
});

// ── Helpers ────────────────────────────────────────────

function riskStyle(level: VerdictSeed["riskLevel"]) {
  if (level === "high")
    return { bg: C.dangerSoft, fg: C.danger, label: "Yüksek Risk" };
  if (level === "medium")
    return { bg: C.warningSoft, fg: C.warning, label: "Orta Risk" };
  return { bg: C.successSoft, fg: C.success, label: "Düşük Risk" };
}

function confidenceLabel(level: VerdictSeed["confidenceLevel"]): string | null {
  if (!level) return null;
  return { high: "Yüksek", medium: "Orta", low: "Düşük" }[level];
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toLocaleUpperCase("tr-TR");
  return (
    parts[0][0] + parts[parts.length - 1][0]
  ).toLocaleUpperCase("tr-TR");
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ── Section wrapper ────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBullet} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

// ── Document ───────────────────────────────────────────

export function NegotiationRecordPdf({
  data,
}: {
  data: NegotiationRecordData;
}) {
  const { verdict, documentName, generatedAt, runId } = data;
  const risk = riskStyle(verdict.riskLevel);
  const confidence = confidenceLabel(verdict.confidenceLevel);
  const dateLabel = formatDate(generatedAt);

  const resolved = verdict.resolvedDisagreements ?? [];
  const unresolved = verdict.unresolvedDisagreements ?? [];
  const flat = verdict.disagreements ?? [];
  // Prefer the v2 resolved/unresolved split when present; fall back to
  // the flat legacy list only if no split is available.
  const showFlat = resolved.length === 0 && unresolved.length === 0 && flat.length > 0;
  const hasDisagreements =
    resolved.length > 0 || unresolved.length > 0 || showFlat;

  const positionChanges = verdict.positionChanges ?? [];

  return (
    <Document
      title={`Kurul Müzakere Kaydı — ${documentName}`}
      author="AI Boardroom"
      creator="AI Boardroom"
      producer="AI Boardroom"
    >
      <Page size="A4" style={styles.page}>
        {/* Cover */}
        <View style={styles.brandBar}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>
            AI BOARDROOM · KURUL MÜZAKERE KAYDI
          </Text>
        </View>

        <Text style={styles.h1}>{documentName}</Text>
        <Text style={styles.meta}>{dateLabel}</Text>

        <View style={styles.badgeRow}>
          <Text
            style={[styles.badge, { backgroundColor: risk.bg, color: risk.fg }]}
          >
            {risk.label}
          </Text>
          {confidence ? (
            <Text
              style={[
                styles.badge,
                { backgroundColor: C.subtle, color: C.muted },
              ]}
            >
              Güven: {confidence}
            </Text>
          ) : null}
        </View>

        {/* Summary */}
        <Section title="Yönetici Özeti">
          <View style={styles.summaryBox}>
            <Text style={styles.summaryText}>
              {verdict.summary || "Özet bulunmuyor."}
            </Text>
          </View>
        </Section>

        {/* Decisions */}
        {verdict.decisions.length > 0 ? (
          <Section title="Ana Kararlar">
            {verdict.decisions.map((d, i) => (
              <View key={i} style={styles.decisionItem} wrap={false}>
                <Text style={styles.decisionNum}>{i + 1}</Text>
                <Text style={styles.decisionText}>{d}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Agent perspectives */}
        {verdict.agentPerspectives.length > 0 ? (
          <Section title="Ajan Görüşleri">
            {verdict.agentPerspectives.map((p, i) => (
              <View key={i} style={styles.agentCard} wrap={false}>
                <Text style={styles.agentAvatar}>
                  {initialsOf(p.agentName)}
                </Text>
                <View style={styles.agentBody}>
                  <Text style={styles.agentName}>{p.agentName}</Text>
                  <Text style={styles.agentPosition}>{p.position}</Text>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Disagreements */}
        {hasDisagreements ? (
          <Section title="Görüş Ayrılıkları">
            {resolved.map((d, i) => (
              <View
                key={`r${i}`}
                style={[
                  styles.disagreementCard,
                  { borderLeftColor: C.success },
                ]}
                wrap={false}
              >
                <Text style={styles.disagreementTopic}>{d.topic}</Text>
                <Text style={styles.disagreementMeta}>
                  ÇÖZÜLDÜ · {d.agentA} ↔ {d.agentB}
                </Text>
                <Text style={styles.disagreementDetail}>{d.resolution}</Text>
              </View>
            ))}
            {unresolved.map((d, i) => (
              <View
                key={`u${i}`}
                style={[
                  styles.disagreementCard,
                  { borderLeftColor: C.warning },
                ]}
                wrap={false}
              >
                <Text style={styles.disagreementTopic}>{d.topic}</Text>
                <Text style={styles.disagreementMeta}>
                  AÇIK · {d.agentA} ↔ {d.agentB}
                </Text>
                <Text style={styles.disagreementDetail}>{d.reason}</Text>
              </View>
            ))}
            {showFlat
              ? flat.map((d, i) => (
                  <View
                    key={`f${i}`}
                    style={[
                      styles.disagreementCard,
                      { borderLeftColor: C.primary },
                    ]}
                    wrap={false}
                  >
                    <Text style={styles.disagreementTopic}>{d.topic}</Text>
                    <Text style={styles.disagreementMeta}>
                      {d.agentA} ↔ {d.agentB}
                    </Text>
                    <Text style={styles.disagreementDetail}>
                      {d.resolution}
                    </Text>
                  </View>
                ))
              : null}
          </Section>
        ) : null}

        {/* Position changes */}
        {positionChanges.length > 0 ? (
          <Section title="Pozisyon Değişimleri">
            {positionChanges.map((pc, i) => (
              <View key={i} style={styles.pcCard} wrap={false}>
                <Text style={styles.pcAgent}>{pc.agentName}</Text>
                <Text style={styles.pcTopic}>{pc.topic}</Text>
                <View style={styles.pcRow}>
                  <View style={styles.pcHalf}>
                    <Text style={styles.pcLabel}>ÖNCE</Text>
                    <Text style={styles.pcText}>{pc.previousStance}</Text>
                  </View>
                  <View style={styles.pcHalf}>
                    <Text style={styles.pcLabel}>SONRA</Text>
                    <Text style={styles.pcText}>{pc.updatedStance}</Text>
                  </View>
                </View>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Action items */}
        {verdict.actionItems.length > 0 ? (
          <Section title="Önerilen Aksiyonlar">
            {verdict.actionItems.map((a, i) => (
              <View key={i} style={styles.actionItem} wrap={false}>
                <View style={styles.actionBox} />
                <Text style={styles.actionText}>{a}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {/* Fixed footer on every page */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Run {runId.slice(0, 8)} · {dateLabel}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ── Server-side renderer ───────────────────────────────
//
// renderToBuffer's return type is narrowed to a DocumentProps element,
// which TS can't infer through a functional component. Wrapping the
// call here lets the route call a typed API without an inline cast.

export async function renderNegotiationRecordPdf(
  data: NegotiationRecordData,
): Promise<Buffer> {
  return renderToBuffer(<NegotiationRecordPdf data={data} />);
}
