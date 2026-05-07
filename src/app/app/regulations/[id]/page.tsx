"use client";

// /app/regulations/[id] — Mevzuat / Yargı kararı detay görünümü.
// Kart üzerinden "Detayı Aç" denildiğinde gelir; UYAP getDokuman'ın
// JSON-içinde-HTML payload'ını parse ederek başlık + alanlar +
// gerekçe paragrafları olarak render eder. Resmî Gazete kayıtlarında
// document parse mümkün değilse summary fallback'i gösterilir.

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { TOPIC_BY_ID } from "@/lib/regulations/topics";
import { COMPANY_BY_ID } from "@/lib/regulations/companies";
import type {
  RegulationItemDTO,
  RegulationPriority,
  RegulationStatus,
} from "@/lib/regulations/types";
import type { ParsedUyapDocument } from "@/lib/regulations/document-parser";

interface DetailResponse {
  item: RegulationItemDTO;
  document: ParsedUyapDocument | null;
  markdown: string | null;
  documentError: string | null;
}

const PRIORITY_BADGE: Record<
  RegulationPriority,
  { label: string; className: string; dot: string }
> = {
  critical: {
    label: "Kritik",
    className: "bg-accent-danger/12 text-accent-danger border-accent-danger/30",
    dot: "bg-accent-danger",
  },
  high: {
    label: "Yüksek",
    className: "bg-accent-warning/12 text-accent-warning border-accent-warning/30",
    dot: "bg-accent-warning",
  },
  medium: {
    label: "Orta",
    className: "bg-accent-info/10 text-accent-info border-accent-info/30",
    dot: "bg-accent-info",
  },
  low: {
    label: "Düşük",
    className:
      "bg-workspace-elevated text-text-tertiary border-workspace-border",
    dot: "bg-text-tertiary",
  },
};

const STATUS_BADGE: Record<
  RegulationStatus,
  { label: string; className: string }
> = {
  kesinlesti: {
    label: "Kesinleşti",
    className:
      "bg-accent-success/10 text-accent-success border-accent-success/30",
  },
  kesinlesmedi: {
    label: "Kesinleşmedi",
    className: "bg-accent-warning/10 text-accent-warning border-accent-warning/30",
  },
};

const SOURCE_LABEL: Record<string, string> = {
  "yargi-mcp": "Yargı MCP",
  "resmi-gazete": "Resmî Gazete",
  tcmb: "TCMB",
  bddk: "BDDK",
  kvkk: "KVKK",
  masak: "MASAK",
  gib: "GİB",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function RegulationDetailPage() {
  const params = useParams();
  const id = useMemo(() => {
    const raw = params?.id;
    return Array.isArray(raw) ? raw[0] : (raw ?? "");
  }, [params]);

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/regulations/${id}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            (body && typeof body.message === "string" && body.message) ||
              `HTTP ${res.status}`,
          );
        }
        const json = (await res.json()) as DetailResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Yükleme başarısız.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell activePath="/app/regulations">
      <div className="px-12 py-10">
        <Link
          href="/app/regulations"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6"
        >
          <ArrowLeft size={14} /> Mevzuat listesine dön
        </Link>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-text-tertiary">
            <Loader2 size={14} className="animate-spin" /> Belge yükleniyor…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/[0.06] px-4 py-3 text-sm text-accent-danger">
            {error}
          </div>
        )}

        {data && <DetailBody data={data} />}
      </div>
    </AppShell>
  );
}

function DetailBody({ data }: { data: DetailResponse }) {
  const { item, document, documentError } = data;
  const badge = PRIORITY_BADGE[item.priority];
  const statusBadge = item.status ? STATUS_BADGE[item.status] : null;
  const sourceLabel = SOURCE_LABEL[item.source] ?? item.source;

  return (
    <article>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-mono font-semibold tracking-wider uppercase text-accent-primary bg-accent-primary/10 border border-accent-primary/20 rounded-full">
          <ShieldAlert size={12} /> {sourceLabel}
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold ${badge.className}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
          {statusBadge && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          )}
          {item.topics.map((t) => {
            const topic = TOPIC_BY_ID[t];
            if (!topic) return null;
            return (
              <span
                key={t}
                className="text-xs text-text-secondary px-2 py-0.5 rounded bg-workspace-elevated border border-workspace-border"
              >
                {topic.label}
              </span>
            );
          })}
        </div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-text-primary tracking-tight leading-tight mb-2">
          {item.title}
        </h1>
        <p className="text-sm text-text-tertiary">
          {formatDate(item.publishedAt)} · {sourceLabel}
          {item.url && (
            <>
              {" "}·{" "}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-text-secondary hover:text-text-primary"
              >
                Ham kaynak <ExternalLink size={12} />
              </a>
            </>
          )}
        </p>
      </header>

      {item.aiVerdict && <AIVerdictPanel verdict={item.aiVerdict} />}

      {data.markdown ? (
        <MarkdownView markdown={data.markdown} />
      ) : document ? (
        <ParsedDocumentView doc={document} />
      ) : (
        <FallbackView
          summary={item.summary}
          documentError={documentError}
          sourceUrl={item.url}
        />
      )}
    </article>
  );
}

// Minimal markdown renderer — yeterli görünüm için #/##/### başlıklar,
// bullet list, **bold** ve paragraf desteği. Karmaşık table/HTML için
// react-markdown bağımlılığı eklemiyoruz.
function MarkdownView({ markdown }: { markdown: string }) {
  const blocks = splitMarkdownBlocks(markdown);
  return (
    <section className="rounded-xl border border-workspace-border bg-workspace-surface p-8">
      <div className="space-y-4">
        {blocks.map((block, i) => renderMarkdownBlock(block, i))}
      </div>
    </section>
  );
}

interface MdBlock {
  kind: "h1" | "h2" | "h3" | "p" | "ul" | "code" | "table";
  content: string;
  items?: string[];
  rows?: string[][];
}

function splitMarkdownBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ kind: "code", content: buf.join("\n") });
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", content: line.slice(4).trim() });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", content: line.slice(3).trim() });
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", content: line.slice(2).trim() });
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", content: "", items });
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        // separator satırını (`| --- | --- |`) atla
        const isSeparator = cells.every((c) => /^:?-{1,}:?$/.test(c) || c === "");
        if (!isSeparator) {
          // Tüm hücreleri boş olan satırlar da gürültü; eleyelim
          if (cells.some((c) => c.length > 0)) rows.push(cells);
        }
        i++;
      }
      if (rows.length > 0) blocks.push({ kind: "table", content: "", rows });
      continue;
    }
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].startsWith("#") &&
      !/^[-*]\s+/.test(lines[i]) &&
      !lines[i].startsWith("```") &&
      !lines[i].trim().startsWith("|")
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", content: buf.join(" ") });
  }
  return blocks;
}

function renderInline(text: string): ReactNode[] {
  // **bold** ve `code` için minimal inline render.
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(
        <strong key={`b${key++}`}>{tok.slice(2, -2)}</strong>,
      );
    } else if (tok.startsWith("`")) {
      parts.push(
        <code
          key={`c${key++}`}
          className="px-1 py-0.5 rounded bg-workspace-elevated text-[13px] font-mono"
        >
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderMarkdownBlock(block: MdBlock, idx: number): ReactNode {
  switch (block.kind) {
    case "h1":
      return (
        <h2
          key={idx}
          className="font-display text-xl font-semibold text-text-primary mt-2"
        >
          {renderInline(block.content)}
        </h2>
      );
    case "h2":
      return (
        <h3
          key={idx}
          className="font-display text-lg font-semibold text-text-primary mt-2"
        >
          {renderInline(block.content)}
        </h3>
      );
    case "h3":
      return (
        <h4
          key={idx}
          className="font-display text-base font-semibold text-text-primary mt-1"
        >
          {renderInline(block.content)}
        </h4>
      );
    case "ul":
      return (
        <ul
          key={idx}
          className="list-disc pl-6 space-y-1 text-[15px] text-text-primary leading-relaxed"
        >
          {(block.items ?? []).map((it, j) => (
            <li key={j}>{renderInline(it)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div key={idx} className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <tbody>
              {(block.rows ?? []).map((row, ri) => (
                <tr
                  key={ri}
                  className={
                    ri === 0
                      ? "bg-workspace-elevated/60"
                      : "border-t border-workspace-border/50"
                  }
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-2 align-top ${
                        ri === 0
                          ? "font-semibold text-text-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "code":
      return (
        <pre
          key={idx}
          className="rounded-lg bg-workspace-elevated p-3 overflow-x-auto text-[13px] font-mono whitespace-pre-wrap"
        >
          {block.content}
        </pre>
      );
    case "p":
    default:
      return (
        <p
          key={idx}
          className="text-[15px] text-text-primary leading-[1.75]"
        >
          {renderInline(block.content)}
        </p>
      );
  }
}

function ParsedDocumentView({ doc }: { doc: ParsedUyapDocument }) {
  const hasMeta = doc.header.length > 0 || doc.fields.length > 0;
  return (
    <div className={hasMeta ? "grid grid-cols-1 lg:grid-cols-12 gap-6" : ""}>
      {hasMeta && (
        <aside className="lg:col-span-4 xl:col-span-3 space-y-4 lg:sticky lg:top-6 self-start">
          {doc.header.length > 0 && (
            <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5">
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-tertiary mb-3">
                Mahkeme
              </h2>
              <div className="font-display text-sm text-text-primary leading-relaxed space-y-0.5">
                {doc.header.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </section>
          )}

          {doc.fields.length > 0 && (
            <section className="rounded-xl border border-workspace-border bg-workspace-surface p-5">
              <h2 className="text-xs font-mono uppercase tracking-wider text-text-tertiary mb-3">
                Dosya Bilgileri
              </h2>
              <dl className="space-y-3">
                {doc.fields.map((f, i) => (
                  <div key={i} className="text-sm">
                    <dt className="text-text-tertiary text-[11px] uppercase tracking-wide mb-0.5">
                      {f.key}
                    </dt>
                    <dd className="text-text-primary break-words">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </aside>
      )}

      {doc.paragraphs.length > 0 && (
        <section
          className={`rounded-xl border border-workspace-border bg-workspace-surface p-8 ${
            hasMeta ? "lg:col-span-8 xl:col-span-9" : ""
          }`}
        >
          <h2 className="text-xs font-mono uppercase tracking-wider text-text-tertiary mb-5">
            Karar Metni
          </h2>
          <div className="space-y-4">
            {doc.paragraphs.map((p, i) => (
              <p
                key={i}
                className="text-[15px] text-text-primary leading-[1.75] whitespace-pre-wrap"
              >
                {p}
              </p>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FallbackView({
  summary,
  documentError,
  sourceUrl,
}: {
  summary: string;
  documentError: string | null;
  sourceUrl: string | null;
}) {
  return (
    <section className="rounded-xl border border-workspace-border bg-workspace-surface p-6">
      {documentError && (
        <div className="rounded-lg border border-accent-warning/30 bg-accent-warning/[0.06] px-4 py-3 mb-4 text-sm text-accent-warning">
          Yapılandırılmış belge alınamadı: {documentError}
        </div>
      )}
      <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
        {summary || "Bu kayıt için içerik bulunamadı."}
      </p>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-primary hover:underline"
        >
          Kaynağa git <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}

const ACTION_BADGE: Record<
  "review" | "monitor" | "no-action",
  { label: string; className: string }
> = {
  review: {
    label: "İncelenmeli",
    className: "bg-accent-danger/12 text-accent-danger border-accent-danger/30",
  },
  monitor: {
    label: "İzlenmeli",
    className: "bg-accent-warning/12 text-accent-warning border-accent-warning/30",
  },
  "no-action": {
    label: "Aksiyon yok",
    className: "bg-workspace-elevated text-text-tertiary border-workspace-border",
  },
};

function AIVerdictPanel({
  verdict,
}: {
  verdict: NonNullable<RegulationItemDTO["aiVerdict"]>;
}) {
  const action = ACTION_BADGE[verdict.paramRelation.suggestedAction];
  const evaluatedAt = (() => {
    try {
      return new Date(verdict.evaluatedAt).toLocaleString("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return verdict.evaluatedAt;
    }
  })();

  return (
    <section className="mb-6 rounded-xl border border-accent-primary/30 bg-accent-primary/[0.05] p-5">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-accent-primary font-semibold">
          <Sparkles size={14} /> AI değerlendirmesi — Param ile ilişki
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-semibold ${action.className}`}
          >
            {action.label}
          </span>
          <span className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            %{Math.round(verdict.confidence * 100)} güven
          </span>
        </div>
      </div>

      <p className="text-base text-text-primary leading-relaxed mb-4">
        {verdict.paramRelation.summary}
      </p>

      {verdict.paramRelation.impactedOperations.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
            Etkilenen operasyonlar
          </div>
          <div className="flex flex-wrap gap-1.5">
            {verdict.paramRelation.impactedOperations.map((op) => (
              <span
                key={op}
                className="text-xs px-2 py-0.5 rounded-full bg-workspace-surface border border-accent-primary/25 text-accent-primary"
              >
                {op}
              </span>
            ))}
          </div>
        </div>
      )}

      {verdict.paramRelation.impactedCompanies.length > 0 && (
        <div className="mb-3">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
            Etkilenen şirketler
          </div>
          <div className="flex flex-wrap gap-1.5">
            {verdict.paramRelation.impactedCompanies.map((id) => {
              const c = COMPANY_BY_ID[id];
              return (
                <span
                  key={id}
                  title={c?.description}
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-primary/10 border border-accent-primary/30 text-accent-primary"
                >
                  {c?.displayName ?? id}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {verdict.paramRelation.severityReason && (
        <div className="text-sm text-text-secondary leading-relaxed border-t border-accent-primary/20 pt-3 mt-3">
          <span className="font-mono uppercase text-[11px] tracking-wider text-text-tertiary mr-2">
            Önem gerekçesi
          </span>
          {verdict.paramRelation.severityReason}
        </div>
      )}

      <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mt-3">
        {verdict.model} · {evaluatedAt}
      </div>
    </section>
  );
}
