"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { SITE } from "@/lib/config/site";
import { getPermissions } from "@/lib/config/roles";
import { UserMenu } from "@/components/app/UserMenu";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { BrandMark } from "@/components/app/BrandMark";

export function StageTopBar() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  return (
    <header className="relative z-[200] overflow-visible flex items-center justify-between px-6 h-[72px] border-b border-workspace-border/50 bg-workspace-bg/80 backdrop-blur-sm shrink-0">
      {/* Left — Brand */}
      <Link
        href={SITE.paths.app}
        className="transition-opacity hover:opacity-80"
      >
        <BrandMark size="sm" />
      </Link>

      {/* Right — Draft + Compare + Panel + theme + avatar */}
      <div className="flex items-center gap-3">
        <Link
          href={SITE.paths.boardroomAgents}
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
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>Agents</span>
        </Link>

        <Link
          href="/app/draft"
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
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="M9 15h6" />
          </svg>
          <span>Sözleşme Taslağı</span>
        </Link>

        <Link
          href="/app/compare"
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
            <path d="M12 3v18" />
            <path d="M8 8l-4 4 4 4" />
            <path d="M16 8l4 4-4 4" />
          </svg>
          <span>Döküman Karşılaştır</span>
        </Link>

        <Link
          href="/app/signatures"
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
            <path d="M4 12c3-6 10-6 13 0" />
            <path d="M4 16c3 6 10 6 13 0" />
            <circle cx="18" cy="12" r="2" />
          </svg>
          <span>İmza Kontrolü</span>
        </Link>

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

        <ThemeToggle />

        {/* User menu — avatar + email + role + sign out */}
        <UserMenu />
      </div>
    </header>
  );
}
