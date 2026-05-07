"use client";

// ============================================================
// AppShell — Tüm /app modüllerinin paylaştığı kabuk
// ============================================================
//
// Sol dikey sidebar rail (modül linkleri + panel + avatar) +
// sticky top bar (bildirim/destek/theme/user). Dashboard'dan
// çıkarıldı; artık Signatures, Compare, Regulations, Boardroom,
// Panel, Draft hepsi bu shell'i kullanıyor.
//
// Palet: dashboard'un raw hex tabanı (#fef7ff zemin, #401689
// brand purple, #280064 deep purple, emerald aksanlar).
// ============================================================

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Bell,
  FilePenLine,
  Gavel,
  Grid2X2,
  LineChart,
  ScrollText,
  Settings,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { UserMenu } from "@/components/app/UserMenu";
import { SITE } from "@/lib/config/site";
import { getPermissions } from "@/lib/config/roles";

interface AppShellProps {
  /**
   * Aktif modül için sidebar'da hangi link'i highlight edeceğimizi
   * söyler. Pathname prefix bazlı eşleştirme — `/app/signatures` aktifse
   * Signatures rail item'i seçili olur.
   */
  activePath?: string;
  children: React.ReactNode;
  /** Header sağ tarafında ek action'lar gerekirse (örn. modül-özel buton). */
  headerExtras?: React.ReactNode;
}

interface RailLink {
  href: string;
  icon: LucideIcon;
  label: string;
}

const PRIMARY_LINKS: RailLink[] = [
  { href: SITE.paths.app, icon: Grid2X2, label: "Ana Sayfa" },
  { href: SITE.paths.boardroomAgents, icon: Gavel, label: "Agents" },
  { href: "/app/draft", icon: FilePenLine, label: "Sözleşme Taslağı" },
  { href: "/app/compare", icon: LineChart, label: "Döküman Karşılaştır" },
  { href: "/app/signatures", icon: WalletCards, label: "İmza Kontrolü" },
  { href: "/app/regulations", icon: ScrollText, label: "Mevzuat Takibi" },
];

export function AppShell({ activePath, children, headerExtras }: AppShellProps) {
  const { data: session } = useSession();
  const permissions = getPermissions(session?.user?.role ?? "user");

  const isActive = (href: string): boolean => {
    if (!activePath) return false;
    if (href === SITE.paths.app) return activePath === SITE.paths.app;
    return activePath === href || activePath.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fef7ff] text-[#1d1a21]">
      <aside className="fixed inset-y-0 left-0 z-50 flex w-16 flex-col items-center border-r border-slate-200/70 bg-white/95 py-4">
        <Link
          href={SITE.paths.app}
          className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-[#401689] text-white shadow-md shadow-[#401689]/20"
          aria-label="Ana Sayfa"
        >
          <span className="font-black text-lg tracking-tight">C</span>
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1.5">
          {PRIMARY_LINKS.map((link) => (
            <RailItem
              key={link.href}
              href={link.href}
              icon={link.icon}
              label={link.label}
              active={isActive(link.href)}
            />
          ))}
          {permissions.canAccessPanel && (
            <>
              <span className="my-2 h-px w-8 bg-slate-200" />
              <RailItem
                href={SITE.paths.panel}
                icon={Settings}
                label="Panel"
                active={isActive(SITE.paths.panel)}
              />
            </>
          )}
        </nav>

        <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
          {session?.user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="text-base">👤</span>
          )}
        </div>
      </aside>

      <main className="ml-16 min-h-screen pb-20">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-end bg-white/40 px-12 backdrop-blur-md">
          <div className="flex items-center gap-6">
            {headerExtras}
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <button
                type="button"
                className="p-2 transition-colors hover:text-[#280064]"
                aria-label="Bildirimler"
              >
                <Bell size={22} />
              </button>
              <button
                type="button"
                className="p-2 transition-colors hover:text-[#280064]"
                aria-label="Uygulamalar"
              >
                <Grid2X2 size={22} />
              </button>
              <span className="mx-2 h-4 w-px bg-slate-300" />
              <Link
                href="/app/support"
                className="transition-colors hover:text-[#280064]"
              >
                Destek
              </Link>
            </div>

            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

function RailItem({
  href,
  icon: Icon,
  label,
  active = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`group/rail relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
        active
          ? "bg-[#401689] text-white shadow-md shadow-[#401689]/20"
          : "text-slate-500 hover:bg-slate-100 hover:text-[#401689]"
      }`}
    >
      <Icon size={20} className="shrink-0" />
      <span
        className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/rail:opacity-100"
        role="tooltip"
      >
        {label}
      </span>
    </Link>
  );
}
