"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SITE } from "@/lib/config/site";

// NextAuth redirects rejected sign-ins here (?error=AccessDenied).
// Server-side layout guards use ?error=Forbidden for role rejections.
// Any other error code falls back to a generic message.

type ErrorCode = "AccessDenied" | "Forbidden" | "Configuration" | "Verification" | "Default";

const MESSAGES: Record<ErrorCode, { title: string; body: string }> = {
  AccessDenied: {
    title: "Erişim reddedildi",
    body: "Bu uygulama yalnızca Univera hesaplarına açıktır. Lütfen kurumsal e-postanızla (@univera.com.tr) giriş yapın.",
  },
  Forbidden: {
    title: "Yetkiniz yok",
    body: "Bu sayfaya erişim yetkiniz bulunmuyor. Erişim hakkı için sistem yöneticinizle iletişime geçin.",
  },
  Configuration: {
    title: "Yapılandırma hatası",
    body: "Kimlik doğrulama servisinde bir yapılandırma sorunu var. Lütfen sistem yöneticinize bildirin.",
  },
  Verification: {
    title: "Doğrulama başarısız",
    body: "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapmayı deneyin.",
  },
  Default: {
    title: "Bir sorun oluştu",
    body: "Giriş sırasında beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin.",
  },
};

function resolveError(raw: string | null): ErrorCode {
  if (raw === "AccessDenied" || raw === "Forbidden" || raw === "Configuration" || raw === "Verification") {
    return raw;
  }
  return "Default";
}

export default function AuthErrorPage() {
  const [code, setCode] = useState<ErrorCode>("Default");

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("error");
    setCode(resolveError(raw));
  }, []);

  const { title, body } = MESSAGES[code];

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#1a1a2e] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-[#FEE2E2] flex items-center justify-center">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#DC2626"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-3">{title}</h1>
        <p className="text-base text-[#64748b] leading-relaxed mb-8">{body}</p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-lg transition-colors"
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
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {SITE.name} ana sayfasına dön
        </Link>
      </div>
    </div>
  );
}
