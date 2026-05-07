"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPermissions, type UserPermissions } from "@/lib/config/roles";
import { useSession } from "next-auth/react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { BrandMark } from "@/components/app/BrandMark";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  /** Permission required to see this item in the sidebar. Omit = visible to anyone with panel access. */
  requirePermission?: keyof UserPermissions;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/app/panel",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    label: "Uzman Kütüphanesi",
    href: "/app/panel/agents",
    requirePermission: "canManageOwnAgents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Kurul Şablonları",
    href: "/app/panel/templates",
    requirePermission: "canManageOwnAgents",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    label: "Değerlendirme Kayıtları",
    href: "/app/panel/runs",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    label: "Kullanıcılar",
    href: "/app/panel/users",
    requirePermission: "canViewUsers",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "İmza Onayları",
    href: "/app/panel/signatures",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Denetim Günlüğü",
    href: "/app/panel/audit",
    requirePermission: "canViewAudit",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    label: "Destek Talepleri",
    href: "/app/panel/support",
    requirePermission: "canViewUsers",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export function ControlRoomSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role ?? "user";
  const permissions = getPermissions(role);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requirePermission || permissions[item.requirePermission],
  );

  return (
    <aside className="w-[240px] shrink-0 border-r border-workspace-border bg-workspace-surface flex flex-col">
      {/* Brand */}
      <div className="px-4 h-[72px] flex items-center border-b border-workspace-border/50">
        <Link
          href="/app/panel"
          className="transition-opacity hover:opacity-80"
        >
          <BrandMark size="sm" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/app/panel"
              ? pathname === "/app/panel"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-3 rounded-lg text-[15px] font-medium
                transition-all duration-150 min-h-[44px]
                ${isActive
                  ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-workspace-elevated border border-transparent"
                }
              `}
            >
              <span className="shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to home + theme toggle */}
      <div className="px-3 py-4 border-t border-workspace-border/50 space-y-1">
        <Link
          href="/app"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
                     text-text-muted hover:text-text-secondary hover:bg-workspace-elevated
                     transition-all duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Ana Sayfaya Dön</span>
        </Link>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-text-muted">Tema</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
