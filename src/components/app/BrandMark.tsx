"use client";

// ============================================================
// Brand Mark — Univera logo + Consulera product lockup
// ============================================================
//
// Used in nav/header contexts across landing, stage, and panel.
// Renders the Univera wordmark beside the product name from SITE config
// separated by a subtle vertical rule. Two sizes: "sm" (navs, sidebars)
// and "md" (landing hero/footer).
// ============================================================

import Image from "next/image";
import { SITE } from "@/lib/config/site";

interface BrandMarkProps {
  /** sm → nav chrome; md → hero/footer */
  size?: "sm" | "md";
  /** Hide the product text (logo only). */
  hideProductName?: boolean;
  className?: string;
}

const DIMENSIONS = {
  sm: { logoH: 52, logoW: 176, textClass: "text-base font-display font-semibold" },
  md: { logoH: 80, logoW: 268, textClass: "text-2xl font-display font-semibold" },
} as const;

export function BrandMark({
  size = "sm",
  hideProductName = false,
  className = "",
}: BrandMarkProps) {
  const d = DIMENSIONS[size];
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* White pill so the dark "univera" wordmark + "a PARAM company"
          subtitle remain legible on both cream-light and midnight-dark
          workspace backgrounds without forcing a second logo asset. */}
      <span
        className="inline-flex items-center justify-center bg-white rounded-md"
        style={{
          paddingInline: size === "md" ? 12 : 8,
          paddingBlock: size === "md" ? 6 : 4,
        }}
      >
        <Image
          src="/logo.png"
          alt="Univera"
          width={d.logoW}
          height={d.logoH}
          priority
          className="h-auto w-auto"
          style={{ height: d.logoH, width: "auto" }}
        />
      </span>
      {!hideProductName && (
        <>
          <span
            aria-hidden
            className="w-px bg-workspace-border"
            style={{ height: size === "md" ? 28 : 20 }}
          />
          <span
            className={`${d.textClass} text-text-primary tracking-tight leading-none`}
          >
            {SITE.name}
          </span>
        </>
      )}
    </div>
  );
}
