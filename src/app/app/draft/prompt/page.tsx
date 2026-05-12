"use client";

// /app/draft/prompt — yeni prompt session oluşturup detay sayfasına
// yönlendirir. Doğrudan landing CTA'sından çağrılır.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/AppShell";
import { useDraftPromptStore } from "@/lib/draft-prompt/store";
import { useHydrated } from "@/lib/draft/use-hydrated";

export default function PromptDraftEntryPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const createSession = useDraftPromptStore((s) => s.createSession);
  const created = useRef(false);

  useEffect(() => {
    if (!hydrated || created.current) return;
    created.current = true;
    const id = createSession();
    router.replace(`/app/draft/prompt/${id}`);
  }, [hydrated, createSession, router]);

  return (
    <AppShell activePath="/app/draft">
      <div className="px-12 py-16 flex items-center justify-center gap-2 text-text-tertiary">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Yeni prompt taslağı hazırlanıyor…</span>
      </div>
    </AppShell>
  );
}
