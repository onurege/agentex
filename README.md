# Consulera (agentex)

AI-destekli iş süreçleri platformu. Sözleşme inceleme, doküman karşılaştırma, imza kontrolü, redline ve mevzuat takibi süreçlerini tek izlenebilir akışta birleştirir.

## Özellikler

- **Agent Team / Boardroom** — Hukuk, finans, vergi ve ticari uzman AI ajanlardan oluşan kurul; belge yükle, ajan seç, çoklu perspektif değerlendirmesi al.
- **Sözleşme Taslağı** — Şablon + soru akışı ile sıfırdan sözleşme; DOCX export.
- **Doküman Karşılaştır** — Versiyonlar arası paragraf/cümle/kelime seviyesinde diff, redline.
- **İmza Kontrolü** — Sirkü ↔ dilekçe arası ünvan/kaşe tutarlılığı + imza karşılaştırma (ML'siz).
- **Mevzuat Takibi** — Yargı MCP (Bedesten, AYM, KVKK, BDDK, GİB, Rekabet) + Resmî Gazete fan-out tarama, retention prune, kaynak başına filtre.
- **Destek Talepleri** — Self-serve form + super_admin inbox.
- **Panel** — Agent CV + prompt versiyonlama, board templates, run history, audit log, user management.

## Teknoloji yığını

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **DB**: PostgreSQL 16 (Docker) + Prisma 7
- **Auth**: NextAuth v4 (Credentials + Google OAuth, JWT sessions)
- **AI**: Google Gemini (`@google/genai`)
- **MCP**: [Yargı MCP](https://github.com/saidsurucu/yargi-mcp) — Streamable HTTP, JSON-RPC + SSE
- **UI**: Tailwind CSS, lucide-react, framer-motion
- **Docs**: pdfjs-dist (client-side PDF), mammoth (DOCX), docx (export), jszip
- **State**: Zustand (client), Prisma (server)
- **Test**: Vitest

## Hızlı başlangıç

### 1) Bağımlılıklar

```bash
npm install
```

### 2) Postgres'i ayağa kaldır

```bash
docker compose up -d
```

Container adı `agentex-db`, port `5433`. Volume kalıcı (`agentex_pgdata`).

### 3) Env

```bash
cp .env.example .env.local
```

`.env.local` içinde doldurman gerekenler:

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `DATABASE_URL` | ✅ | docker-compose ile uyumlu varsayılan değer örnekte mevcut |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32` ile üret |
| `NEXTAUTH_URL` | ✅ | dev'de `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | opsiyonel | Google OAuth için Console'dan al |
| `INITIAL_SUPER_ADMIN_EMAIL` | önerilir | İlk login'de super_admin'e promote edilir |
| `GEMINI_API_KEY` | ✅ | AI Studio'dan al |
| `BOARDROOM_ENABLE_DISAGREEMENT_PASS` / `_REBUTTAL_PASS` | opsiyonel | Default `false` (latency için) |
| `NEXT_PUBLIC_PERSISTENCE_MODE` | opsiyonel | `local` (default) ya da `db` |

### 4) DB migrate

```bash
npm run db:migrate
```

Geliştirme için şema değişikliği yaptıkça aynı komut migration üretir.

### 5) Dev server

```bash
npm run dev
```

`http://localhost:3000` üzerinden erişilebilir. İlk girişte `INITIAL_SUPER_ADMIN_EMAIL` otomatik promote olur.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm run dev` | Dev server (HMR) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run test` | Vitest tek sefer |
| `npm run test:watch` | Vitest watch |
| `npm run db:generate` | Prisma client regenerate |
| `npm run db:migrate` | Migration oluştur + uygula (dev) |
| `npm run db:push` | Schema'yı doğrudan push (migration üretmeden) |
| `npm run db:studio` | Prisma Studio UI |

## Yapı

```
src/
├── app/                     # Next.js App Router
│   ├── api/                 # REST endpoints
│   └── app/                 # /app/* sayfaları (dashboard, boardroom, draft, compare, signatures, regulations, support, panel)
├── components/              # React bileşenleri (modül başına klasör)
├── lib/                     # Domain/iş mantığı
│   ├── boardroom/           # AI kurulu pipeline + adapters
│   ├── regulations/         # Mevzuat scan/parser/sources
│   ├── legal-research/      # Yargı MCP client
│   └── ...
prisma/
├── schema.prisma            # DB modeli (kaynaklı)
└── migrations/              # Kronolojik migration'lar
scripts/                     # Geliştirici probe/araçları (örn. yargi tool listing)
```

## Önemli notlar

- **Mevzuat retention**: Scan sonunda `fetchedAt < now − 30 gün` ve hiç pin'lenmemiş kayıtlar otomatik silinir (DB şişmesin diye).
- **Yargı MCP rate limit**: Bedesten/UYAP servisleri 429 dönebilir; adapter tool başına bağımsız `try/catch` ile dayanıklı.
- **Persistence Mode**: `local` modda boardroom run'ları localStorage'da; `db` modda Postgres'te. Migration banner kullanıcıya geçişi bildirir.
- **AI pipeline**: Gemini Flash default; disagreement + rebuttal pass'leri opsiyonel (latency için kapalı).

## Lisans

MIT — bkz. [LICENSE](./LICENSE).
