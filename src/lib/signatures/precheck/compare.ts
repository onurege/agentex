// Six-check comparison engine. Hard signals (identity / name / authority
// type / duration) can produce critical severity; soft signals (address /
// freshness) cap at warning. The UI surfaces failed status as a red banner
// but never blocks the signature compare flow — the user can always
// continue. The overall status is downstream of the per-check severities.

import {
  companyNameSimilarity,
  digitsOnly,
  expandCompanyName,
  normalizeAddress,
} from "./normalize";
import type {
  PetitionExtraction,
  PrecheckCheck,
  PrecheckCheckId,
  PrecheckSeverity,
  PrecheckStatus,
  SirkuExtraction,
} from "./types";

const COMPANY_NAME_OK_THRESHOLD = 0.85;
const COMPANY_NAME_WARNING_THRESHOLD = 0.7;
const ADDRESS_OVERLAP_OK_THRESHOLD = 0.5;
const FRESHNESS_THRESHOLD_MONTHS = 24;

function makeCheck(
  id: PrecheckCheckId,
  severity: PrecheckSeverity,
  label: string,
  message: string,
  expected?: string,
  observed?: string,
): PrecheckCheck {
  return { id, severity, label, message, expected, observed };
}

function formatTrDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function checkCompanyIdentity(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  const sirkuVkn = digitsOnly(s.taxNumber);
  const petitionVkn = digitsOnly(p.taxNumber);

  if (!sirkuVkn || !petitionVkn) {
    const missing = !sirkuVkn && !petitionVkn
      ? "İki belgeden de"
      : !sirkuVkn
        ? "Sirküden"
        : "Dilekçeden";
    return makeCheck(
      "company_identity",
      "warning",
      "Şirket vergi kimliği",
      `${missing} vergi numarası okunamadı; kimlik karşılaştırması yapılamadı.`,
      sirkuVkn || undefined,
      petitionVkn || undefined,
    );
  }

  if (sirkuVkn === petitionVkn) {
    return makeCheck(
      "company_identity",
      "ok",
      "Şirket vergi kimliği",
      `Vergi No eşleşti: ${sirkuVkn}`,
      sirkuVkn,
      petitionVkn,
    );
  }

  return makeCheck(
    "company_identity",
    "critical",
    "Şirket vergi kimliği",
    `Vergi numaraları farklı: sirküde ${sirkuVkn}, dilekçede ${petitionVkn}.`,
    sirkuVkn,
    petitionVkn,
  );
}

function checkCompanyName(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  if (!s.companyName || !p.companyName) {
    return makeCheck(
      "company_name",
      "warning",
      "Şirket unvanı",
      "Bir veya iki belgeden şirket unvanı okunamadı.",
      s.companyName ?? undefined,
      p.companyName ?? undefined,
    );
  }

  const score = companyNameSimilarity(s.companyName, p.companyName);
  const expandedSirku = expandCompanyName(s.companyName);
  const expandedPetition = expandCompanyName(p.companyName);
  const pct = Math.round(score * 100);

  if (score >= COMPANY_NAME_OK_THRESHOLD) {
    return makeCheck(
      "company_name",
      "ok",
      "Şirket unvanı",
      `Unvan eşleşti (benzerlik %${pct}).`,
      expandedSirku,
      expandedPetition,
    );
  }
  if (score >= COMPANY_NAME_WARNING_THRESHOLD) {
    return makeCheck(
      "company_name",
      "warning",
      "Şirket unvanı",
      `Unvanlar büyük ölçüde benziyor ama tam eşleşmiyor (benzerlik %${pct}). Kısaltma farkı veya yazım hatası olabilir.`,
      expandedSirku,
      expandedPetition,
    );
  }
  return makeCheck(
    "company_name",
    "critical",
    "Şirket unvanı",
    `Unvanlar uyuşmuyor (benzerlik %${pct}).`,
    expandedSirku,
    expandedPetition,
  );
}

function checkAuthorityType(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  if (s.authorityType === "belirsiz") {
    return makeCheck(
      "authority_type",
      "warning",
      "Yetki kullanım şekli",
      "Sirküde münferiden / müştereken bilgisi tespit edilemedi.",
    );
  }

  if (s.authorityType === "münferiden") {
    return makeCheck(
      "authority_type",
      "ok",
      "Yetki kullanım şekli",
      "Münferiden yetki — tek imza yeterli.",
      "münferiden",
      `${p.signatureCount} imza`,
    );
  }

  if (p.signatureCount >= 2) {
    return makeCheck(
      "authority_type",
      "ok",
      "Yetki kullanım şekli",
      `Müştereken yetki — ${p.signatureCount} imza tespit edildi.`,
      "müştereken (≥2 imza)",
      `${p.signatureCount} imza`,
    );
  }

  return makeCheck(
    "authority_type",
    "critical",
    "Yetki kullanım şekli",
    `Sirkü müştereken yetki gerektiriyor ancak dilekçede ${p.signatureCount} imza var; birden fazla yetkili imzası gerekir.`,
    "müştereken (≥2 imza)",
    `${p.signatureCount} imza`,
  );
}

function checkAuthorityDuration(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  if (
    !s.authorityStart ||
    !s.authorityDurationYears ||
    !p.petitionDate
  ) {
    return makeCheck(
      "authority_duration",
      "warning",
      "Temsil süresi",
      "Sirkünün başlangıç tarihi/süresi veya dilekçe tarihi okunamadı; süre kontrolü yapılamadı.",
    );
  }

  const start = new Date(s.authorityStart);
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + s.authorityDurationYears);
  const petition = new Date(p.petitionDate);

  const startStr = formatTrDate(start);
  const endStr = formatTrDate(end);
  const petitionStr = formatTrDate(petition);

  if (petition < start) {
    return makeCheck(
      "authority_duration",
      "critical",
      "Temsil süresi",
      `Dilekçe (${petitionStr}) temsil yetkisinin başlangıcından (${startStr}) önce.`,
      `${startStr} – ${endStr}`,
      petitionStr,
    );
  }
  if (petition > end) {
    return makeCheck(
      "authority_duration",
      "critical",
      "Temsil süresi",
      `Temsil yetkisi ${endStr} tarihinde dolmuş; dilekçe ${petitionStr} tarihli — yetki bitiminden sonra düzenlenmiş.`,
      `${startStr} – ${endStr}`,
      petitionStr,
    );
  }
  return makeCheck(
    "authority_duration",
    "ok",
    "Temsil süresi",
    `Dilekçe tarihi (${petitionStr}) temsil aralığında (${startStr} – ${endStr}).`,
    `${startStr} – ${endStr}`,
    petitionStr,
  );
}

function checkAddressMatch(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  const sa = normalizeAddress(s.address);
  const pa = normalizeAddress(p.address);

  if (!sa || !pa) {
    return makeCheck(
      "address_match",
      "warning",
      "Adres tutarlılığı",
      "Bir veya iki belgeden adres okunamadı.",
    );
  }

  const sTokens = new Set(sa.split(/\s+/).filter((t) => t.length > 2));
  const pTokens = new Set(pa.split(/\s+/).filter((t) => t.length > 2));
  let overlap = 0;
  sTokens.forEach((t) => {
    if (pTokens.has(t)) overlap += 1;
  });
  const minSize = Math.min(sTokens.size, pTokens.size);
  const ratio = minSize > 0 ? overlap / minSize : 0;

  if (ratio >= ADDRESS_OVERLAP_OK_THRESHOLD) {
    return makeCheck(
      "address_match",
      "ok",
      "Adres tutarlılığı",
      "Adres bilgileri büyük ölçüde örtüşüyor.",
    );
  }
  return makeCheck(
    "address_match",
    "warning",
    "Adres tutarlılığı",
    "Sirkü ve dilekçedeki adresler farklı; şirket taşınmış olabilir, sirkünün güncel olduğunu doğrulayın.",
    s.address ?? undefined,
    p.address ?? undefined,
  );
}

function checkSirkuFreshness(
  s: SirkuExtraction,
  p: PetitionExtraction,
): PrecheckCheck {
  if (!s.sirkuDate || !p.petitionDate) {
    return makeCheck(
      "sirku_freshness",
      "warning",
      "Sirkü güncelliği",
      "Sirkü veya dilekçe tarihi okunamadı; güncellik kontrolü yapılamadı.",
    );
  }

  const sirku = new Date(s.sirkuDate);
  const petition = new Date(p.petitionDate);
  const months =
    (petition.getFullYear() - sirku.getFullYear()) * 12 +
    (petition.getMonth() - sirku.getMonth());

  if (months <= FRESHNESS_THRESHOLD_MONTHS) {
    return makeCheck(
      "sirku_freshness",
      "ok",
      "Sirkü güncelliği",
      `Sirkü ${months} ay önce düzenlenmiş.`,
    );
  }
  return makeCheck(
    "sirku_freshness",
    "warning",
    "Sirkü güncelliği",
    `Sirkü ${months} ay önce düzenlenmiş; daha güncel bir sirkü olup olmadığını kontrol edin.`,
    formatTrDate(sirku),
    formatTrDate(petition),
  );
}

export function comparePrecheck(
  sirku: SirkuExtraction,
  petition: PetitionExtraction,
): PrecheckCheck[] {
  return [
    checkCompanyIdentity(sirku, petition),
    checkCompanyName(sirku, petition),
    checkAuthorityType(sirku, petition),
    checkAuthorityDuration(sirku, petition),
    checkAddressMatch(sirku, petition),
    checkSirkuFreshness(sirku, petition),
  ];
}

export function computeOverallStatus(
  checks: PrecheckCheck[],
): PrecheckStatus {
  if (checks.some((c) => c.severity === "critical")) return "failed";
  if (checks.some((c) => c.severity === "warning")) return "warned";
  return "passed";
}
