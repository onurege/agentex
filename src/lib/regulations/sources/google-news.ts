// Google News RSS adapter — Param Grup şirketleri için her şirketin
// `queries` listesinin OR birleşimini sorgular, dönen RSS feed'i
// parse eder. Adapter classifier'a girmeden önce candidate'a
// `companies: [companyId]` koyar; classifier sonrası scan
// orchestrator companies birleşimini DB'ye yazar.
//
// Kaynak: https://news.google.com/rss/search?q=...&hl=tr&gl=TR&ceid=TR:tr
//
// API key gerekmiyor; rate limit gevşek ama yine de şirket başına
// sequential fetch yapıyoruz. Şirket içi query'ler tek bir RSS
// çağrısında OR ile birleşir (Google syntax).

import { createHash } from "crypto";
import { PARAM_GROUP_COMPANIES } from "../companies";
import type { ScannedRegulationCandidate } from "../types";

const BASE_URL = "https://news.google.com/rss/search";
const FETCH_TIMEOUT_MS = 12_000;
const PER_COMPANY_LIMIT = 20;

export interface GoogleNewsSourceResult {
  candidates: ScannedRegulationCandidate[];
  error: string | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) =>
      String.fromCharCode(parseInt(c, 16)),
    )
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function externalIdFor(url: string): string {
  return createHash("sha256")
    .update(`google-news::${url}`)
    .digest("hex")
    .slice(0, 32);
}

function buildQueryUrl(queries: readonly string[]): string {
  // OR birleşim — her query parantez içinde, tırnaklar korunur.
  const q = queries.map((p) => `(${p})`).join(" OR ");
  const params = new URLSearchParams({
    q,
    hl: "tr",
    gl: "TR",
    ceid: "TR:tr",
  });
  return `${BASE_URL}?${params.toString()}`;
}

interface ParsedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
}

function parseRssItems(xml: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(
        `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
        "i",
      );
      const hit = r.exec(block);
      if (!hit) return "";
      const raw = hit[1];
      // <![CDATA[...]]> sarmalamasını çıkar.
      const unwrapped = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
      return unwrapped.trim();
    };
    const title = stripTags(pick("title"));
    const link = stripTags(pick("link"));
    const description = stripTags(pick("description"));
    const pubDate = stripTags(pick("pubDate"));
    const source = stripTags(pick("source"));
    if (!title || !link) continue;
    items.push({ title, link, description, pubDate, source });
  }
  return items;
}

async function fetchCompany(
  companyId: string,
  queries: readonly string[],
): Promise<{ candidates: ScannedRegulationCandidate[]; error: string | null }> {
  const url = buildQueryUrl(queries);
  let xml: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "consulera-regulations/0.1",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) {
      return {
        candidates: [],
        error: `google-news[${companyId}] → HTTP ${res.status}`,
      };
    }
    xml = await res.text();
  } catch (err) {
    return {
      candidates: [],
      error: `google-news[${companyId}] → ${
        err instanceof Error ? err.message : "fetch hata"
      }`,
    };
  }

  const items = parseRssItems(xml).slice(0, PER_COMPANY_LIMIT);
  const out: ScannedRegulationCandidate[] = [];
  for (const it of items) {
    const publishedAt = it.pubDate ? new Date(it.pubDate) : new Date();
    if (Number.isNaN(publishedAt.getTime())) continue;
    const summary = it.source
      ? `${it.source} — ${it.description || it.title}`
      : it.description || it.title;
    out.push({
      source: "google-news",
      externalId: externalIdFor(it.link),
      title: it.title.length > 240 ? `${it.title.slice(0, 240).trim()}…` : it.title,
      summary,
      url: it.link,
      publishedAt,
      sourceTool: "google-news",
      companies: [companyId],
      rawPayload: {
        companyId,
        queryUrl: url,
        publisher: it.source || null,
      },
    });
  }
  return { candidates: out, error: null };
}

export async function fetchGoogleNewsCandidates(): Promise<GoogleNewsSourceResult> {
  const all: ScannedRegulationCandidate[] = [];
  const errors: string[] = [];
  // URL bazında dedup — aynı haber birden fazla şirket query'sinde
  // dönerse companies birleşimini tutarız.
  const byKey = new Map<string, ScannedRegulationCandidate>();

  for (const company of PARAM_GROUP_COMPANIES) {
    const result = await fetchCompany(company.id, company.queries);
    if (result.error) errors.push(result.error);
    for (const c of result.candidates) {
      const existing = byKey.get(c.externalId);
      if (existing) {
        const merged = new Set([
          ...(existing.companies ?? []),
          ...(c.companies ?? []),
        ]);
        existing.companies = Array.from(merged);
      } else {
        byKey.set(c.externalId, c);
      }
    }
  }

  byKey.forEach((c) => all.push(c));

  return {
    candidates: all,
    error:
      errors.length === PARAM_GROUP_COMPANIES.length ? errors.join(" | ") : null,
  };
}
