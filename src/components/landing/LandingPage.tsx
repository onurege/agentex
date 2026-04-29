"use client";

import { FormEvent, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, Lock, Mail, QrCode, Shield } from "lucide-react";
import { BrandMark } from "@/components/app/BrandMark";
import { SITE } from "@/lib/config/site";

const HERO_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBdxERQLmhiuTQgljzmKNY0OSk2C7XJFV3MPFdLaINZTBjKjkU6ud1gppoG1nvOqAAHL_Kg73eRRc6GU3BgZFslOo9ISlQhbUkIAVM4q8YNgXn-BuNoTtBT4OaG9XZGZT-2_l5Y-P2Z9Ak3GjVfvEKp6qV2fMTA7dULe9pi6mvaTWAqtJvZjhVerPBSQtnGrcoCIqJPjwPhItPDNzHcwsQSW51pdqMbDnwZ8_rOMi8W0FQklrFe-Fn7wSe4cmZqrvZAUqPueNHwGY4A";

export function LandingPage() {
  const router = useRouter();
  const { status } = useSession();
  const [callbackUrl, setCallbackUrl] = useState<string>(SITE.paths.app);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    if (cb) setCallbackUrl(cb);
  }, []);

  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl);
  }, [callbackUrl, router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);
    if (result?.ok) {
      router.replace(result.url ?? callbackUrl);
      return;
    }

    setError("E-posta veya şifre hatalı. Kullanıcı pasif ya da silinmiş olabilir.");
  }

  return (
    <main className="min-h-screen bg-[#fef7ff] px-6 py-10 text-[#1d1a21] md:px-12 md:py-16">
      <div className="mx-auto flex min-h-[720px] w-full max-w-[1280px] overflow-hidden rounded-[24px] bg-white shadow-[0_30px_90px_rgba(64,22,137,0.14)] ring-1 ring-black/5">
        <section className="flex w-full flex-col justify-center px-8 py-12 md:px-16 lg:w-1/2 lg:px-20">
          <div className="mb-12">
            <BrandMark size="md" />
          </div>

          <div className="w-full max-w-md">
            <div className="mb-10">
              <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.02em] text-[#280064] md:text-[40px]">
                Hoş Geldiniz
              </h1>
              <p className="mt-3 text-base leading-relaxed text-[#494552]">
                Univera AI Team
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <label className="block">
                <span className="ml-1 text-sm font-bold text-[#1d1a21]">E-posta</span>
                <span className="relative mt-2 block">
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    type="email"
                    required
                    placeholder="or. ad@firma.com"
                    className="h-14 w-full rounded-[24px] border-0 bg-[#f8f1fb] px-6 pr-14 text-base text-[#1d1a21] outline-none placeholder:text-[#7b7483] focus:ring-2 focus:ring-[#51e7ff]"
                  />
                  <Mail className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7b7483]" />
                </span>
              </label>

              <label className="block">
                <span className="ml-1 text-sm font-bold text-[#1d1a21]">Şifre</span>
                <span className="relative mt-2 block">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={remember ? "current-password" : "off"}
                    type="password"
                    required
                    placeholder="••••••••••"
                    className="h-14 w-full rounded-[24px] border-0 bg-[#f8f1fb] px-6 pr-14 text-base text-[#1d1a21] outline-none placeholder:text-[#7b7483] focus:ring-2 focus:ring-[#51e7ff]"
                  />
                  <Lock className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7b7483]" />
                </span>
              </label>

              <div className="flex items-center justify-between px-1">
                <label className="flex cursor-pointer items-center gap-3 text-sm text-[#494552]">
                  <input
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                    type="checkbox"
                    className="h-5 w-5 rounded border-[#7b7483] text-[#401689] focus:ring-[#401689]"
                  />
                  Beni Hatırla
                </label>
                <span className="text-sm font-bold text-[#401689]">Şifremi Unuttum</span>
              </div>

              {error ? (
                <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="h-14 w-full rounded-[24px] bg-[#401689] text-base font-bold text-white shadow-[0_14px_30px_rgba(64,22,137,0.22)] transition hover:bg-[#280064] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </button>
            </form>

        

            <p className="mt-12 text-center text-base text-[#494552]">
              Hesabınız yok mu?{" "}
              <span className="font-bold text-[#401689]">
                Sistem yöneticinizden davet isteyin
              </span>
            </p>
          </div>
        </section>

        <section className="relative hidden w-1/2 overflow-hidden bg-[linear-gradient(135deg,#401689_0%,#6128C1_100%)] p-20 lg:block">
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="mb-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/20 backdrop-blur-md">
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h2 className="max-w-lg font-display text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white drop-shadow">
                Hukuki süreçler için güvenli karar merkezi
              </h2>
              <p className="mt-8 max-w-md text-lg leading-relaxed text-white/80">
                Kullanıcılar, yetkiler, ajanlar ve tüm işlem izleri tek bir
                kurumsal çalışma alanında yönetilir.
              </p>
            </div>

           
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt="Consulera güvenli giriş görseli"
            className="pointer-events-none absolute -bottom-4 -right-28 h-[78%] w-[115%] object-contain opacity-70 drop-shadow-2xl"
          />
          <div className="absolute -right-24 top-1/4 h-64 w-64 rounded-full bg-[#51e7ff]/20 blur-[100px]" />
          <div className="absolute -left-24 bottom-1/4 h-80 w-80 rounded-full bg-[#280064]/40 blur-[120px]" />
        </section>
      </div>
    </main>
  );
}
