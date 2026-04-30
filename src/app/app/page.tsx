"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  Bell,
  Download,
  FileDiff,
  FilePenLine,
  FileSignature,
  Gavel,
  Grid2X2,
  LineChart,
  MoreVertical,
  PlusCircle,
  ScrollText,
  Settings,
  Sparkles,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/app/ThemeToggle";
import { UserMenu } from "@/components/app/UserMenu";
import { SITE } from "@/lib/config/site";
import { getPermissions } from "@/lib/config/roles";
import { getBoardroomRuns } from "@/lib/run-history";

const moduleCards = [
  {
    href: SITE.paths.boardroomAgents,
    icon: Gavel,
    title: "Uzman Değerlendirme",
    subtitle: "Hukuk, finans, vergi ve ticari uzmanlardan oluşan AI kurulunu başlatın.",
    action: "Ajanları Seç",
    status: { label: "Online", className: "bg-green-100 text-green-700" },
  },
  {
    href: "/app/draft",
    icon: FilePenLine,
    title: "Sözleşme Taslağı",
    subtitle: "Notlar ve taraf bilgileriyle yeni sözleşme taslağı oluşturun.",
    action: "Taslak Başlat",
    status: { label: "Hazır", className: "bg-slate-100 text-slate-500" },
  },
  {
    href: "/app/compare",
    icon: FileDiff,
    title: "Doküman Karşılaştır",
    subtitle: "Versiyonlar arasındaki farkları ve riskli değişiklikleri inceleyin.",
    action: "Karşılaştır",
    status: { label: "Hazır", className: "bg-slate-100 text-slate-500" },
  },
  {
    href: "/app/signatures",
    icon: FileSignature,
    title: "İmza Kontrolü",
    subtitle: "Dokümandaki imzayı imza sirküleri ile karşılaştırın.",
    action: "İmza İncele",
    status: { label: "Hazır", className: "bg-slate-100 text-slate-500" },
  },
  {
    href: "/app/regulations",
    icon: ScrollText,
    title: "Mevzuat Takibi",
    subtitle:
      "Param Grubu'nu ilgilendiren güncel düzenlemeleri Yargı MCP ve Resmî Gazete'den izleyin.",
    action: "Mevzuat Takibi",
    status: { label: "Yeni", className: "bg-[#fef3c7] text-[#854d0e]" },
  },
] as const;

const processItems = [
  {
    number: "01",
    title: "Agent Team",
    subtitle: "Belge yükle · Ajanları seç · Karar desteğini al",
    href: SITE.paths.boardroomAgents,
    state: "review",
  },
  {
    number: "02",
    title: "Sözleşme Taslağı",
    subtitle: "Şablon seç · Soruları yanıtla · DOCX indir",
    href: "/app/draft",
    state: "progress",
  },
  {
    number: "03",
    title: "Doküman ve İmza Kontrolü",
    subtitle: "Karşılaştırma · Redline · İmza sinyali",
    href: "/app/compare",
    state: "complete",
  },
] as const;

export default function AppDashboardPage() {
  const { data: session } = useSession();
  const permissions = getPermissions(session?.user?.role ?? "user");
  const [mounted, setMounted] = useState(false);
  const [recentRuns, setRecentRuns] = useState<Array<{ id: string; name: string; date: string; risk: string }>>([]);

  useEffect(() => {
    setRecentRuns(
      getBoardroomRuns()
        .slice(0, 3)
        .map((run) => ({
          id: run.id,
          name: run.documentName,
          date: run.createdAt,
          risk: run.verdictSeed.riskLevel,
        })),
    );
    setMounted(true);
  }, []);

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
          <RailItem href={SITE.paths.app} active icon={Grid2X2} label="Ana Sayfa" />
          <RailItem href={SITE.paths.boardroomAgents} icon={Gavel} label="Agents" />
          <RailItem href="/app/draft" icon={FilePenLine} label="Sözleşme Taslağı" />
          <RailItem href="/app/compare" icon={LineChart} label="Döküman Karşılaştır" />
          <RailItem href="/app/signatures" icon={WalletCards} label="İmza Kontrolü" />
          <RailItem href="/app/regulations" icon={ScrollText} label="Mevzuat Takibi" />
          {permissions.canAccessPanel && (
            <>
              <span className="my-2 h-px w-8 bg-slate-200" />
              <RailItem href={SITE.paths.panel} icon={Settings} label="Panel" />
            </>
          )}
        </nav>

        <div className="mt-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white">
          {session?.user?.image ? (
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
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <button className="p-2 transition-colors hover:text-[#280064]" aria-label="Bildirimler">
                <Bell size={22} />
              </button>
              <button className="p-2 transition-colors hover:text-[#280064]" aria-label="Uygulamalar">
                <Grid2X2 size={22} />
              </button>
              <span className="mx-2 h-4 w-px bg-slate-300" />
              <Link href="/app/support" className="transition-colors hover:text-[#280064]">
                Destek
              </Link>
            </div>

            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <div className="mx-auto mt-2 w-full max-w-[1280px] px-12">
          <section className="relative mb-12 overflow-hidden rounded-[40px] bg-gradient-to-br from-[#280064] to-[#401689] p-12 shadow-2xl shadow-[#280064]/20">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden md:block">
              <img
                className="h-full w-full object-cover mix-blend-screen opacity-50"
                alt="Abstract 3D glowing neural network data visualization with purple and turquoise light particles on dark background"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCd2VaRvDSUXQTUbrTUWrzsfG3YZT7BlinEddYoa9_fPeZs_nloXMFQKTarOg324-ruPKpAuaRk5_YQoatomFIWQV-v4CZPejdDM_8p1KoiLPECBdhKUdPknNHtU6ZtnVHc1SUS_nEUE87JU_0E3ZXy2CCLiKHOZOFWs7XGJYH6qspycpy2e9HjdS1v9xFnL8aO5GE9QgoXTSLznZp3TRw1KqlSgtTVwntUNCBsnLtD8nkllgyM7aSIQuU9XoF2ZKvuqqh77x_EbyNC"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(64,22,137,0.95),rgba(64,22,137,0.15))]" />
            </div>

            <div className="relative z-10 max-w-2xl">
              <span className="mb-6 inline-flex rounded-full border border-[#51e7ff]/30 bg-[#006875]/25 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.28em] text-[#9defff]">
                {SITE.marketing.badge}
              </span>
              <h1 className="mb-6 font-display text-5xl font-extrabold leading-[1.1] tracking-[-0.02em] text-white">
                İş süreçleriniz için <span className="text-[#51e7ff]">AI karar destek</span> platformu
              </h1>
              <p className="mb-8 max-w-2xl text-lg leading-relaxed text-[#eaddff]/90">
                Sözleşme inceleme, belge karşılaştırma, imza kontrolü, redline ve uzman ajan değerlendirmelerini tek izlenebilir süreçte birleştirin.
              </p>
              <div className="flex gap-4">
                <Link
                  href={SITE.paths.boardroomAgents}
                  className="inline-flex items-center justify-center gap-2 rounded-[24px] bg-[#51e7ff] px-8 py-4 text-base font-bold text-[#001f24] transition-transform hover:scale-[1.02]"
                >
                  Agent Team ile Toplantı Başlat
                  <Bolt size={18} />
                </Link>
                <Link
                  href="/app/draft"
                  className="inline-flex items-center justify-center rounded-[24px] border border-white/20 bg-white/10 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20"
                >
                  Yeni Sözleşme
                </Link>
              </div>
            </div>
          </section>

          <section className="mb-12">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-[32px] font-bold leading-[1.2] text-[#280064]">
                  Çalışma Merkezi
                </h2>
                <p className="text-base leading-relaxed text-[#494552]">
                  Hukuki süreçlerinizi başlatın, son çalışmaları takip edin ve karar destek akışlarına erişin.
                </p>
              </div>
              <Link
                href={SITE.paths.boardroomAgents}
                className="hidden items-center gap-1 text-base font-bold text-[#006875] hover:underline sm:flex"
              >
                Ajanları Gör
                <ArrowRight size={18} />
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {moduleCards.map((card) => (
                <ModuleCard key={card.href} {...card} />
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <section className="rounded-[40px] border border-white/30 bg-white/70 p-6 shadow-[0_8px_32px_0_rgba(64,22,137,0.04)] backdrop-blur-xl lg:col-span-2">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-[#280064]">
                  Süreç Yönetimi
                </h3>
                <div className="flex gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#006875]" />
                  <span className="h-2 w-2 rounded-full bg-slate-200" />
                  <span className="h-2 w-2 rounded-full bg-slate-200" />
                </div>
              </div>

              <div className="space-y-6">
                {processItems.map((item) => (
                  <ProcessRow key={item.number} {...item} />
                ))}
              </div>
            </section>

            <section className="flex flex-col rounded-[40px] border border-white/30 bg-white/70 p-6 shadow-[0_8px_32px_0_rgba(64,22,137,0.04)] backdrop-blur-xl">
              <h3 className="mb-8 font-display text-2xl font-bold text-[#280064]">
                Son Çalışmalar
              </h3>

              {!mounted || recentRuns.length === 0 ? (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
                  <div className="relative mb-6 h-24 w-24">
                    <div className="absolute inset-0 scale-150 animate-pulse rounded-full bg-[#280064]/5" />
                    <img
                      className="relative z-10 h-full w-full object-contain"
                      alt="Minimalist 3D rendered safe box icon with soft shadows and metallic purple textures"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuAIzl_Xn1jF2ieGZe8kIpp-kflRU_vyClNZvAwFxG9LgzjEz1QhyxwCi6E5yZtyI1mysZK52OonUIxra5dDqKL2egfVOBqHJKEDDlOiDVVrwJLLRXgUqfIYRKH5mwzoqX__b0F3JEkTV8W1mSZQ5Xiq5T_lbNiTfirZiJuXE_pf-NOB7DvjhuyaIFXPUDnlyciM5Ur0e-UgZ-AEFYG7XpNdXzUz2AqEB4Y8gTCLi18nQ8MhfKCUOj8SRfLGXeHX3wRsViN1M0F8yGnO"
                    />
                  </div>
                  <p className="mb-2 text-sm font-bold text-[#1d1a21]">Henüz kayıtlı çalışma yok</p>
                  <p className="mb-8 max-w-xs text-sm leading-relaxed text-[#494552]">
                    Tamamlanan uzman değerlendirmeleri ve karar destek çıktıları burada görünecek.
                  </p>
                  <Link
                    href={SITE.paths.boardroomAgents}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-[#280064]/20 px-7 py-4 text-sm font-bold text-[#280064] transition-colors hover:bg-[#280064]/5"
                  >
                    <PlusCircle size={19} />
                    İlk Değerlendirmeyi Başlat
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentRuns.map((run) => (
                    <Link key={run.id} href={`/app/runs/${run.id}`}>
                      <div className="rounded-[24px] border border-[#e7e0ea] bg-white/80 p-4 transition-all hover:border-[#51e7ff] hover:shadow-[0_12px_36px_rgba(64,22,137,0.08)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-bold text-[#1d1a21]">{run.name}</p>
                            <p className="mt-1 text-sm text-[#494552]">
                              {new Date(run.date).toLocaleDateString("tr-TR")}
                            </p>
                          </div>
                          <RiskBadge risk={run.risk} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {permissions.canAccessPanel && (
            <div className="mt-8 rounded-[32px] border border-[#e7e0ea] bg-white/70 p-6 shadow-[0_16px_50px_rgba(64,22,137,0.05)] backdrop-blur-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-display text-xl font-bold text-[#280064]">Control Room</h3>
                  <p className="mt-1 text-base text-[#494552]">
                    Ajan CV&apos;leri, prompt sürümleri, şablonlar ve audit kayıtlarını yönetin.
                  </p>
                </div>
                <Link
                  href={SITE.paths.panel}
                  className="inline-flex items-center justify-center rounded-[24px] bg-[#280064] px-7 py-3 text-base font-bold text-white transition-colors hover:bg-[#401689]"
                >
                  Panele Git
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function ModuleCard({
  href,
  icon: Icon,
  title,
  subtitle,
  action,
  status,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action: string;
  status: { label: string; className: string };
}) {
  return (
    <Link href={href} className="group block">
      <div className="flex h-full min-h-[224px] flex-col rounded-[32px] border border-white/40 bg-white/70 p-6 shadow-[0_16px_48px_rgba(64,22,137,0.05)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#51e7ff]/60">
        <div className="mb-8 flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#280064]/5 text-[#280064] transition-colors group-hover:bg-[#280064] group-hover:text-white">
            <Icon size={27} />
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${status.className}`}>
            {status.label}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="min-h-[62px] font-display text-2xl font-bold leading-[1.3] text-[#1d1a21]">{title}</h3>
          <p className="mt-1 min-h-[40px] text-sm leading-relaxed text-[#494552]">{subtitle}</p>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#280064]">
          <Sparkles size={15} />
          {action}
        </div>
      </div>
    </Link>
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

function ProcessRow({
  number,
  title,
  subtitle,
  href,
  state,
}: {
  number: string;
  title: string;
  subtitle: string;
  href: string;
  state: "review" | "progress" | "complete";
}) {
  return (
    <Link href={href} className="group flex items-center gap-6 rounded-3xl border border-transparent p-4 transition-colors hover:border-white hover:bg-white/50">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#f2ebf6] font-display text-lg font-medium text-[#280064]/30">
        {number}
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold leading-[1.4] text-[#1d1a21]">{title}</p>
        <p className="text-xs text-[#494552]">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        {state === "review" && (
          <span className="rounded-xl bg-[#401689] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#280064]">
            İncele
          </span>
        )}
        {state === "progress" && (
          <>
            <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full w-3/4 rounded-full bg-[#006875]" />
            </span>
            <MoreVertical size={20} className="text-[#280064]" />
          </>
        )}
        {state === "complete" && (
          <>
            <BadgeCheck size={24} className="text-green-500" />
            <Download size={22} className="text-[#280064]" />
          </>
        )}
      </div>
    </Link>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  const config =
    risk === "high"
      ? "bg-red-100 text-red-700"
      : risk === "low"
        ? "bg-green-100 text-green-700"
        : "bg-amber-100 text-amber-700";

  return (
    <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold uppercase ${config}`}>
      {risk === "high" ? "Yüksek" : risk === "low" ? "Düşük" : "Orta"}
    </span>
  );
}
