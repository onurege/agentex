"use client";

import { useSession } from "next-auth/react";
import { getPermissions } from "@/lib/config/roles";
import { ControlRoomSidebar } from "./ControlRoomSidebar";
import { UserMenu } from "@/components/app/UserMenu";

interface ControlRoomLayoutProps {
  children: React.ReactNode;
}

export function ControlRoomLayout({ children }: ControlRoomLayoutProps) {
  const { data: session, status } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-screen bg-workspace-bg text-text-secondary text-lg">
        Yükleniyor...
      </div>
    );
  }

  // Permission gate — user role cannot access panel
  if (!permissions.canAccessPanel) {
    return (
      <div className="flex items-center justify-center h-screen bg-workspace-bg">
        <div className="text-center max-w-md px-6">
          <p className="text-2xl font-semibold text-text-primary mb-3">
            Erişim Engellendi
          </p>
          <p className="text-lg text-text-secondary">
            Bu alana erişim yetkiniz bulunmuyor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-workspace-bg text-text-primary overflow-hidden">
      <ControlRoomSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Control Room Top Bar */}
        <header className="flex items-center justify-between px-6 h-[72px] border-b border-workspace-border/50 bg-workspace-bg/80 backdrop-blur-sm shrink-0">
          <div />
          <div className="flex items-center gap-3">
            <UserMenu />
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
