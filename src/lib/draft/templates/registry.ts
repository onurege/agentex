// ============================================================
// Draft Templates — Registry
// ============================================================
//
// Hem lightweight meta (picker UI için) hem full DraftTemplate
// (renderer + wizard için) erişimini tek yerden sağlar.
// ============================================================

import type { DraftTemplate, TemplateId } from "../types";
import { NDA_TEMPLATE } from "./nda";

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  description: string;
  category: string;
  iconKey: "lock" | "handshake" | "briefcase";
  estimatedMinutes: number;
}

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  nda: {
    id: "nda",
    label: "Gizlilik Sözleşmesi (NDA)",
    description:
      "İki taraf arasında paylaşılacak ticari, teknik veya finansal bilgilerin korunması için tek taraflı veya karşılıklı NDA.",
    category: "Gizlilik",
    iconKey: "lock",
    estimatedMinutes: 5,
  },
  distributor: {
    id: "distributor",
    label: "Bayilik Sözleşmesi",
    description:
      "Sağlayıcı ile bayi arasındaki bölge, münhasırlık, minimum alım taahhüdü ve ödeme koşullarını içeren dağıtım sözleşmesi.",
    category: "Bayilik",
    iconKey: "handshake",
    estimatedMinutes: 10,
  },
  service: {
    id: "service",
    label: "Hizmet Alım Sözleşmesi",
    description:
      "Eser veya vekâlet niteliğinde iş görme — danışmanlık, yazılım, tasarım, bakım gibi B2B hizmet alımları için kapsam, bedel, teslim, kabul ve IP devri.",
    category: "Hizmet",
    iconKey: "briefcase",
    estimatedMinutes: 8,
  },
};

export const TEMPLATE_ORDER: TemplateId[] = ["nda", "distributor", "service"];

/**
 * Tam DraftTemplate kaydı. Faz 1'de yalnızca NDA tanımlı; diğerleri
 * Faz 2'de eklenecek. Tanımsız şablon istenirse undefined döner ki
 * çağıran kullanıcı friendly bir hata gösterebilsin.
 */
const FULL_TEMPLATES: Partial<Record<TemplateId, DraftTemplate>> = {
  nda: NDA_TEMPLATE,
};

export function getTemplate(id: TemplateId): DraftTemplate | undefined {
  return FULL_TEMPLATES[id];
}

export function isTemplateImplemented(id: TemplateId): boolean {
  return FULL_TEMPLATES[id] !== undefined;
}
