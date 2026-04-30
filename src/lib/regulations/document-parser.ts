// UYAP getDokuman yanıtı: { data: "<html>...<br>...</html>", metadata }.
// HTML tek bir <p> içinde <br>-yoğun satırlar barındırır. Bu parser
// tag/entity'i temizler ve mantıksal bölümlere ayırır:
//   - header   : "T.C.", il, mahkeme adı (ilk boş satıra kadar)
//   - fields   : "ESAS NO : ...", "KARAR NO : ...", "DAVA : ..." gibi
//                başlıklı satırlar
//   - paragraphs: gerekçe + hüküm + imza bloğu, çift boş satırla bölünür

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&nbsp;/g, " ");
}

export interface DocumentField {
  key: string;
  value: string;
}

export interface ParsedUyapDocument {
  header: string[];
  fields: DocumentField[];
  paragraphs: string[];
}

const FIELD_LINE_RE = /^[A-ZÇĞİÖŞÜ0-9 .\-/]+:/;

export function parseUyapDocument(rawHtml: string): ParsedUyapDocument {
  const stripped = decodeEntities(
    rawHtml
      // Inline CSS/JS bloklarını içerikten ayıkla — aksi halde noise
      // (selector, kural, JS kodu) paragraf olarak sızıyor.
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, ""),
  );
  const lines = stripped
    .split("\n")
    .map((l) => l.replace(/[\t ]+/g, " ").trim());

  const header: string[] = [];
  const fields: DocumentField[] = [];
  const paragraphs: string[] = [];
  let phase: "header" | "fields" | "body" = "header";
  let bodyBuf: string[] = [];

  // Section heading'ler header'dan sayılır (mahkeme tanıtım bloğu),
  // colon'lu satırlar field, geri kalanı body. "TÜRK MİLLETİ ADINA",
  // "GEREKÇELİ KARAR" gibi başlıklarla colon-suz ALL-CAPS satırları da
  // header'a dahil edebiliyoruz; ama ilk colon'lu satırda zorla
  // fields'a geçeriz, böylece header şişmez.
  const isAllCapsHeading = (l: string) =>
    l.length > 0 &&
    l.length <= 60 &&
    /^[A-ZÇĞİÖŞÜ0-9 .\-/]+$/.test(l);

  for (const line of lines) {
    if (phase === "header") {
      if (line === "") {
        if (header.length > 0) phase = "fields";
        continue;
      }
      if (FIELD_LINE_RE.test(line)) {
        phase = "fields";
        // fall through to fields handling below
      } else if (isAllCapsHeading(line)) {
        header.push(line);
        continue;
      } else {
        // İlk küçük-harf içeren cümle → header bitti, body'e geçtik.
        phase = "body";
        bodyBuf.push(line);
        continue;
      }
    }
    if (phase === "fields") {
      if (line === "") continue;
      if (FIELD_LINE_RE.test(line)) {
        const idx = line.indexOf(":");
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        fields.push({ key, value });
        continue;
      }
      phase = "body";
      bodyBuf.push(line);
      continue;
    }
    if (line === "") {
      if (bodyBuf.length > 0) {
        paragraphs.push(bodyBuf.join(" "));
        bodyBuf = [];
      }
    } else {
      bodyBuf.push(line);
    }
  }
  if (bodyBuf.length > 0) paragraphs.push(bodyBuf.join(" "));

  // Boş value'lu field'ları ele — UI'da "—" olarak görünüyor, kalabalık.
  const cleanFields = fields.filter((f) => f.value.length > 0);

  return { header, fields: cleanFields, paragraphs };
}
