import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agentex — Çok Ajanlı Sözleşme İnceleme Çalışma Alanı",
  description: "Yapılandırılmış çok ajanlı sözleşme incelemesi ve analizi için premium yapay zeka çalışma alanı",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className="dark">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
