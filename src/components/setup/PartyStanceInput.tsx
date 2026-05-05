"use client";

import { useBoardroomFlowStore, type Stance } from "@/lib/boardroom-flow-store";

const STANCE_OPTIONS: Array<{
  value: Stance;
  label: string;
  description: string;
}> = [
  {
    value: "aggressive",
    label: "Sert Savunma",
    description:
      "Tavizsiz koruma. Karşı tarafın istismar edici maddelerini agresif işaretle, maksimum lehte pozisyon al.",
  },
  {
    value: "favor",
    label: "Lehime · Dengeli",
    description:
      "Sizin lehinize ama ilişkiyi koruyacak makul öneriler. Kabul edilebilir tavizleri belirt.",
  },
  {
    value: "objective",
    label: "Objektif",
    description:
      "Tarafsız değerlendirme. Her iki taraf için adil ve dengeli analiz, hiçbir tarafa meyil yok.",
  },
  {
    value: "winwin",
    label: "Uzlaşmacı",
    description:
      "Karşı tarafın haklı kaygılarını da gör. Win-win çözümler ve karşılıklı değer yaratan öneriler.",
  },
];

export function PartyStanceInput() {
  const clientParty = useBoardroomFlowStore((s) => s.clientParty);
  const stance = useBoardroomFlowStore((s) => s.stance);
  const setClientParty = useBoardroomFlowStore((s) => s.setClientParty);
  const setStance = useBoardroomFlowStore((s) => s.setStance);

  return (
    <div>
      <h2 className="text-xl font-semibold text-text-primary mb-2">
        Temsil ve Tutum
        <span className="text-accent-danger ml-1">*</span>
      </h2>
      <p className="text-base text-text-secondary mb-4">
        Hangi tarafı temsil ettiğinizi ve ajanların hangi tutumla
        değerlendirme yapmasını istediğinizi seçin. İkisi de zorunlu.
      </p>

      <div className="mb-5">
        <label
          htmlFor="client-party"
          className="block text-[14px] font-medium text-text-secondary mb-2"
        >
          Temsil edilen taraf
        </label>
        <input
          id="client-party"
          type="text"
          value={clientParty}
          onChange={(e) => setClientParty(e.target.value)}
          placeholder="Örnek: Alıcı / ABC Ltd. Şti."
          className="w-full rounded-xl bg-workspace-surface border border-workspace-border
                     text-text-primary placeholder:text-text-muted
                     text-base px-4 py-3 leading-relaxed
                     focus:outline-none focus:border-accent-primary/40 focus:ring-1 focus:ring-accent-primary/20
                     transition-colors duration-150"
        />
      </div>

      <div>
        <span className="block text-[14px] font-medium text-text-secondary mb-2">
          Tutum
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STANCE_OPTIONS.map((opt) => {
            const selected = stance === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStance(opt.value)}
                className={`text-left rounded-xl border p-4 transition-all duration-150
                  ${
                    selected
                      ? "border-accent-primary bg-accent-primary/10 ring-1 ring-accent-primary/40"
                      : "border-workspace-border bg-workspace-surface hover:border-workspace-border/80"
                  }`}
                aria-pressed={selected}
              >
                <span
                  className={`block text-[15px] font-semibold mb-1 ${
                    selected ? "text-accent-primary" : "text-text-primary"
                  }`}
                >
                  {opt.label}
                </span>
                <span className="block text-[13px] text-text-secondary leading-relaxed">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
