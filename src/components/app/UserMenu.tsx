"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import type { UserRole } from "@/lib/config/roles";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Super Admin",
  authorized_user: "Yetkili",
  user: "Kullanıcı",
};

const ROLE_BADGE_STYLE: Record<UserRole, string> = {
  super_admin: "text-accent-primary bg-accent-primary/10",
  authorized_user: "text-accent-info bg-accent-info/10",
  user: "text-text-muted bg-workspace-elevated",
};

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!session?.user) return null;

  const role: UserRole = session.user.role ?? "user";
  const initials = session.user.name
    ?.split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Kullanıcı menüsü"
        title={session.user.name ?? session.user.email ?? "Kullanıcı"}
        className="flex items-center justify-center w-10 h-10 rounded-full
                   bg-accent-primary/20 text-accent-primary text-sm font-semibold
                   border border-accent-primary/30 hover:border-accent-primary/60
                   transition-colors motion-reduce:transition-none
                   overflow-hidden"
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initials || "?"}</span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-64 rounded-xl
                     bg-workspace-surface border border-workspace-border shadow-xl
                     overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-workspace-border/50">
            <p className="text-sm font-semibold text-text-primary truncate">
              {session.user.name ?? session.user.email}
            </p>
            <p className="text-[12px] text-text-muted truncate mt-0.5">
              {session.user.email}
            </p>
            <span
              className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE_STYLE[role]}`}
            >
              {ROLE_LABEL[role]}
            </span>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-4 py-3 text-sm text-text-secondary
                       hover:bg-workspace-elevated hover:text-text-primary
                       transition-colors motion-reduce:transition-none
                       flex items-center gap-2"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Çıkış Yap
          </button>
        </div>
      )}
    </div>
  );
}
