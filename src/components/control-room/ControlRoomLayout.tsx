"use client";

// ============================================================
// ControlRoomLayout — Panel kabuğu
// ============================================================
//
// AppShell'in birincil sidebar'ı + sticky top bar'ı dış katmanda;
// panel'e özgü alt-modül navigasyonu (ControlRoomSidebar) iç
// katmanda content'in solunda kalır. Panel kendi top bar'ını
// taşımaz — header bilgisi shell'den gelir.
// ============================================================

import { useSession } from "next-auth/react";
import { getPermissions } from "@/lib/config/roles";
import { AppShell } from "@/components/app/AppShell";
import { SITE } from "@/lib/config/site";
import { ControlRoomSidebar } from "./ControlRoomSidebar";

interface ControlRoomLayoutProps {
  children: React.ReactNode;
}

export function ControlRoomLayout({ children }: ControlRoomLayoutProps) {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  if (status === "loading") {
    return (
      <AppShell activePath={SITE.paths.panel}>
        <div className="px-12 py-16 text-center text-[#494552]">
          Yükleniyor...
        </div>
      </AppShell>
    );
  }

  if (!permissions.canAccessPanel) {
    return (
      <AppShell activePath={SITE.paths.panel}>
        <div className="px-12 py-16 text-center">
          <p className="text-2xl font-semibold text-[#1d1a21] mb-3">
            Erişim Engellendi
          </p>
          <p className="text-lg text-[#494552]">
            Bu alana erişim yetkiniz bulunmuyor.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activePath={SITE.paths.panel}>
      <div className="flex">
        <ControlRoomSidebar />
        <main className="flex-1 min-w-0 p-6">{children}</main>
      </div>
    </AppShell>
  );
}
