"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { SITE } from "@/lib/config/site";
import { LogOut, ChevronDown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { UserAvatar } from "./UserAvatar";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <header className="border-b border-workspace-border bg-workspace-surface">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Brand */}
        <Link href={SITE.paths.app} className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-accent-primary/15 border border-accent-primary/30 rounded-lg flex items-center justify-center">
            <span className="text-sm font-bold text-accent-primary">{SITE.logo}</span>
          </div>
          <span className="text-base font-semibold text-text-primary">{SITE.name}</span>
        </Link>

        {/* Right cluster: theme toggle + user menu */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

        {status === "loading" && (
          <div className="w-7 h-7 rounded-full bg-workspace-elevated animate-pulse" />
        )}

        {status === "authenticated" && session?.user && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg hover:bg-workspace-elevated transition-colors"
            >
              <UserAvatar
                name={session.user.name ?? session.user.email}
                image={session.user.image}
                size="sm"
              />
              <span className="text-xs font-mono text-text-secondary hidden sm:inline max-w-[120px] truncate">
                {session.user.name ?? session.user.email}
              </span>
              <ChevronDown size={12} className="text-text-muted" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-workspace-elevated border border-workspace-border rounded-lg shadow-medium overflow-hidden z-50">
                {/* User info */}
                <div className="px-3 py-2.5 border-b border-workspace-border">
                  <p className="text-xs font-medium text-text-primary truncate">
                    {session.user.name}
                  </p>
                  <p className="text-2xs font-mono text-text-muted truncate mt-0.5">
                    {session.user.email}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:text-accent-danger hover:bg-workspace-surface transition-colors"
                  >
                    <LogOut size={13} />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </header>
  );
}
