// Resmî Gazete daily index scraper — lite-mode.
//
// Fetches each day's HTML index over the past N days, harvests
// "Yönetmelik / Tebliğ / Kararname / Kanun" linklerini başlık + URL
// olarak listeler. No body fetch in lite-mode; the daily index page
// itself carries enough title/section context for the classifier to
// route Param-relevant items.
//
// Resmî Gazete'nin standart bir RSS feed'i yok; kararlı URL pattern'i
// var (eskiler/{YYYY}/{MM}/{YYYYMMDD}.htm). HTML scrape fragile bir
// yol — silently skip if a date returns 404 or parsing yields zero
// items, but record the error so the audit log can surface coverage
// gaps.

import { createHash } from "crypto";
import type { ScannedRegulationCandidate } from "../types";

const BASE_URL = "https://www.resmigazete.gov.tr";
const DEFAULT_DAYS = 7;
const FETCH_TIMEOUT_MS = 10_000;

export interface ResmiGazeteSourceResult {
  candidates: ScannedRegulationCandidate[];
  error: string | null;
}

function dateUrl(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${BASE_URL}/eskiler/${yyyy}/${mm}/${yyyy}${mm}${dd}.htm`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function externalIdFor(url: string, title: string): string {
  const h = createHash("sha256");
  h.update(`resmi-gazete::${url}::${title}`);
  return h.digest("hex").slice(0, 32);
}

const SKIP_LINK_HINTS = [
  "anasayfa",
  "iletisim",
  "default.aspx",
  "tarihli.aspx",
  "yeni.aspx",
  "fihrist",
];

function isLikelyMevzuatLink(href: string, text: string): boolean {
  const h = href.toLowerCase();
  if (SKIP_LINK_HINTS.some((hint) => h.includes(hint))) return false;
  if (text.length < 10) return false;
  if (/^\s*(geri|ileri|sayfa|yönetim)/i.test(text)) return false;
  return true;
}

async function fetchDay(d: Date): Promise<{
  candidates: ScannedRegulationCandidate[];
  error: string | null;
}> {
  const url = dateUrl(d);
  let html: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "consulera-regulations/0.1" },
    });
    if (!res.ok) {
      return { candidates: [], error: `${url} → HTTP ${res.status}` };
    }
    // Resmî Gazete sayfaları Windows-1254 / ISO-8859-9 servis ediyor.
    // res.text() default UTF-8 sayar ve Türkçe karakterleri bozar; biz
    // önce header/meta charset'i tespit edip arrayBuffer'ı doğru decode
    // ediyoruz.
    const buffer = await res.arrayBuffer();
    const ctype = res.headers.get("content-type") ?? "";
    let charset = /charset=([^;\s]+)/i.exec(ctype)?.[1]?.toLowerCase();
    if (!charset) {
      const head = new TextDecoder("ascii").decode(buffer.slice(0, 2048));
      charset = /charset=["']?([^"'>\s/]+)/i
        .exec(head)?.[1]
        ?.toLowerCase();
    }
    if (!charset || charset === "iso-8859-1") charset = "windows-1254";
    try {
      html = new TextDecoder(charset).decode(buffer);
    } catch {
      html = new TextDecoder("windows-1254").decode(buffer);
    }
  } catch (err) {
    return {
      candidates: [],
      error: `${url} → ${err instanceof Error ? err.message : "fetch hata"}`,
    };
  }

  const out: ScannedRegulationCandidate[] = [];
  const linkRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const text = stripTags(m[2]);
    if (!isLikelyMevzuatLink(href, text)) continue;

    const fullUrl = href.startsWith("http")
      ? href
      : `${BASE_URL}${href.startsWith("/") ? href : `/${href}`}`;

    out.push({
      source: "resmi-gazete",
      externalId: externalIdFor(fullUrl, text),
      title: text.length > 200 ? `${text.slice(0, 200).trim()}…` : text,
      summary: text,
      url: fullUrl,
      publishedAt: d,
      sourceTool: "resmi-gazete",
      rawPayload: { dayUrl: url },
    });
  }

  return { candidates: out, error: null };
}

export async function fetchResmiGazeteCandidates(
  options: { days?: number } = {},
): Promise<ResmiGazeteSourceResult> {
  const days = options.days ?? DEFAULT_DAYS;
  const today = new Date();
  const all: ScannedRegulationCandidate[] = [];
  const errors: string[] = [];

  // Sequential fetch on purpose — we don't want to hammer the public
  // site with seven concurrent requests. Each day is independent so
  // partial success is fine.
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const result = await fetchDay(d);
    all.push(...result.candidates);
    if (result.error) errors.push(result.error);
  }

  return {
    candidates: all,
    error: errors.length === days ? errors.join(" | ") : null,
  };
}
