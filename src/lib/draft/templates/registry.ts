// ============================================================
// Draft Templates — Registry
// ============================================================
//
// Şu an yalnızca meta veri (label/açıklama/ikon/tahmini süre)
// barındırır — tam DraftTemplate tanımları (questions + clauses)
// Faz 1'de bu dizine eklenecek (nda.ts, distributor.ts, service.ts).
// Picker UI sadece meta'yı kullanır.
// ============================================================

import type { TemplateId } from "../types";

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
