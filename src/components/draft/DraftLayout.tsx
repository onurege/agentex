"use client";

// ============================================================
// Draft Module — Layout Shell
// ============================================================
//
// Compare modülünün kardeşi. Stage akışından bağımsız, kendi
// navı var. Boardroom'un step göstergesini barındırmaz.
//
// Header: BrandMark (left) + "Sıfırdan Sözleşme" + pageTitle
//         sağda "Sahneye Dön" + theme toggle + user menu.
// ============================================================

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { UserMenu } from "@/components/app/UserMenu";

interface DraftLayoutProps {
  pageTitle?: string;
  children: React.ReactNode;
}

export function DraftLayout({ pageTitle, children }: DraftLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-workspace-bg text-text-primary overflow-hidden">
      <header className="flex items-center justify-between px-6 h-[72px] border-b border-workspace-border/50 bg-workspace-bg/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-6">
          <Link
            href="/app"
            className="transition-opacity hover:opacity-80"
          >
            <BrandMark size="sm" />
          </Link>
          <div className="hidden md:flex items-center gap-3 text-text-muted">
            <span aria-hidden>/</span>
            <span className="text-sm font-medium text-text-secondary">
              Sıfırdan Sözleşme
            </span>
            {pageTitle && (
              <>
                <span aria-hidden>/</span>
                <span className="text-sm font-medium text-text-primary">
                  {pageTitle}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                       text-text-secondary hover:text-text-primary
                       hover:bg-workspace-elevated transition-colors min-h-[40px]"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Sahneye Dön</span>
          </Link>
          <ThemeToggle />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
