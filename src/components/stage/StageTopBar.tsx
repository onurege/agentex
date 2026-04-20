"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SITE } from "@/lib/config/site";
import { getPermissions } from "@/lib/config/roles";

export function StageTopBar() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  const initials = session?.user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex items-center justify-between px-6 h-[72px] border-b border-workspace-border/50 bg-workspace-bg/80 backdrop-blur-sm shrink-0">
      {/* Left — Brand */}
      <Link href={SITE.paths.app} className="flex items-center gap-3 group">
        <span className="text-2xl leading-none text-accent-primary group-hover:text-accent-secondary transition-colors">
          {SITE.logo}
        </span>
        <span className="text-lg font-semibold text-text-primary tracking-tight">
          {SITE.name}
        </span>
      </Link>

      {/* Right — Panel + Avatar */}
      <div className="flex items-center gap-3">
        {permissions.canAccessPanel && (
          <Link
            href={SITE.paths.panel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                       text-text-secondary hover:text-text-primary
                       bg-workspace-surface hover:bg-workspace-elevated
                       border border-workspace-border hover:border-accent-primary/30
                       transition-all duration-150 min-h-[44px]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>Panel</span>
          </Link>
        )}

        {/* User Avatar */}
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full
                     bg-accent-primary/20 text-accent-primary text-sm font-semibold
                     border border-accent-primary/30"
          title={session?.user?.name ?? "Kullanıcı"}
        >
          {initials || "?"}
        </div>
      </div>
    </header>
  );
}
