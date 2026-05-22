# Consulera (agentex) — Claude Code Working Notes

> Bu dosya her session'da otomatik yüklenir. Tam bağlam için: `AI-BOARDROOM-HANDOFF.md` (lokal, git-ignored) + `~/.claude/projects/-Users-egeusluer-Documents-agentex/memory/MEMORY.md`.

---

## 1. Proje Özeti

**Consulera**: AI destekli hukuki/finansal/operasyonel iş süreçleri B2B platformu.
**Sahip**: Onur Ege Usluer (`connect@univera.com.tr`) · **Repo**: github.com/onurege/agentex

7 ana modül:
- **Boardroom** — Multi-agent AI kurulu (5-stage pipeline) + verdict + redline DOCX
- **Sözleşme Taslağı** (`/app/draft`) — Şablon + soru akışı → DOCX export
- **Doküman Karşılaştır** (`/app/compare`) — Versiyon diff + redline
- **İmza Kontrolü** (`/app/signatures`) — Sirkü ↔ dilekçe ML'siz tutarlılık
- **Mevzuat Takibi** (`/app/regulations`) — Yargı MCP fan-out (Bedesten + AYM ×2 + KVKK + BDDK + GİB + Rekabet) + Resmî Gazete + 30 gün retention
- **Destek** (`/app/support`) — Self-serve form + super_admin inbox
- **Panel** (`/app/panel`) — Agent CV/prompt versiyonlama, run history, audit, users, templates

---

## 2. ⚠️ Hard Rules (kullanıcı feedback'leri — bunları ihlal etme)

| Kural | Detay |
|---|---|
| **Türkçe konuş, kod İngilizce** | Commit mesajları İngilizce, raporlar Türkçe |
| **Co-Authored-By trailer YOK** | Hiçbir commit'e ekleme. (2026-04-30 net istendi.) |
| **Atomik commit** | `<type>(<scope>): <özet>` — feat/fix/chore/refactor/style/perf |
| **Destructive git YASAK** | `reset --hard`, `force push`, `--no-verify`, `branch -D` → izinsiz yapma; sor |
| **Push görünür eylemdir** | Sormadan push atma |
| **AI pipeline değişikliği = açık rapor** | Boardroom-engine'i sessiz değiştirme |
| **Faz başlarken plan özeti → onay → sonra başla** | Direkt koda dalma |
| **Test yazma istenmedikçe** | Önce doğru mimari |
| **`npm run build` her faz sonu temiz** | Geçmeden faz bitmedi |
| **Sürprizleri gizleme** | Öngörülmedik bir şey çıkarsa anında söyle |
| **DB read-only varsayılan** | Sadece SELECT (kullanıcı genel kuralı, MEMORY.md) |

---

## 3. Unitask Entegrasyonu

`unitask` MCP kayıtlı (user scope, tüm projelerde aktif). Tools: `mcp__unitask__*`.

**Kullanıcı "Unitask"tan, "task"tan, "görev"den bahsederse:**

Standart workflow:
1. `unitask_my_tasks` — userId 160'a atanmış açık taskları listele
2. Bir task öner ve neden onu seçtiğini söyle, **onay bekle**
3. Onaydan sonra: `unitask_update_task({status: "in_progress"})`
4. `unitask_get_task` + `unitask_get_comments` ile tam bağlam
5. Bu repo'da uygula (Hard Rules'a uy)
6. **Build temiz geçtikten ve kullanıcı onayladıktan sonra**: status=done + `unitask_add_comment` ile özet
7. **DELETE asla yapma** (MCP'de bilinçli olarak yok)

Asla: kullanıcı onayı olmadan status'u done'a çekme; kullanıcı onayı olmadan yorum atma.

---

## 4. Teknoloji Yığını

| Katman | Tech |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 + TS |
| DB | Postgres 16 (Docker, `agentex-db`, port 5433) + Prisma 7 |
| Auth | NextAuth v4 — Credentials + opsiyonel Google OAuth, JWT |
| AI | Google Gemini (`@google/genai`), default `gemini-2.5-flash` |
| MCP (legal) | Yargı MCP — `src/lib/legal-research/yargi-mcp-client.ts` |
| UI | Tailwind, lucide-react, framer-motion |
| Doc | pdfjs-dist · mammoth (read) · docx (write) · jszip |
| State | Zustand (client) · Prisma (server) |
| Test | Vitest |

⚠️ Next.js'in eğitim verindeki versiyonuyla uyumsuz davranışlar olabilir — yeni API kullanırken `node_modules/next/dist/docs/` kontrol et.

---

## 5. Repo Haritası (kısa)

```
src/
├── app/
│   ├── api/              # REST: agents, audit, boardroom, compare, draft,
│   │                     #   regulations, runs, signatures, support, templates, users
│   └── app/              # Sayfalar (dashboard, modüller, panel)
├── components/           # Modül başına klasör (stage/, control-room/, regulations/, ...)
└── lib/
    ├── boardroom-engine/         # 5-stage pipeline (research → agent → disagreement → rebuttal → chief)
    ├── boardroom-orchestrator.ts
    ├── regulations/              # scan, classifier, sources/, types
    ├── legal-research/           # Yargı MCP client
    ├── persistence/              # local + db adapters (db varsayılan)
    ├── audit-log.ts              # AuditLog event helper
    ├── api-auth.ts               # getAuthUser/forbidden/badRequest
    └── config/{site,roles}.ts
prisma/schema.prisma   # User, Agent*, Board*, Run*, Audit*, Regulation*, SupportTicket
scripts/               # Probe araçları (yargi-mcp tool listing, fan-out denemesi vs.)
```

---

## 6. Komutlar

| Komut | İş |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Prod build (faz sonu temiz olmalı) |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run db:migrate` | Migration üret + uygula |
| `npm run db:studio` | Prisma Studio |
| `docker compose up -d` | Postgres ayağa |

⚠️ **Schema değişikliği sonrası dev server'ı restart et** — Next.js eski Prisma client'ı bellekte tutabilir.

---

## 7. Pipeline Bilinen Davranışları

- **Boardroom Stage 4 (chief) fail olabilir** (token/timeout/JSON parse). Fallback verdict + `arbitratedEdits` boş → redline üretilmez → `/api/runs/[runId]/redline` 404. Dev terminal'de **"Chief pass failed:"** satırı kritik; sebebi anlamadan fix yapma.
- **Disagreement + rebuttal pass'leri varsayılan kapalı** (latency için). Env flag: `BOARDROOM_ENABLE_DISAGREEMENT_PASS`, `BOARDROOM_ENABLE_REBUTTAL_PASS`.
- **Mevzuat fan-out**: Topic içi tool çağrıları `Promise.allSettled` paralel; topic'ler arası sequential (rate-limit dostu). Bedesten/UYAP 429 dönebilir.
- **Resmî Gazete charset**: Windows-1254/ISO-8859-9 → arrayBuffer + TextDecoder. UTF-8 parse Türkçe karakteri bozar.
- **Mevzuat retention**: Scan sonu `fetchedAt < 30 gün` ve pin'lenmemiş → `deleteMany`. **Tam outage'da prune atlanır** (yanlış silinme koruması).
- **Persistence**: `NEXT_PUBLIC_PERSISTENCE_MODE=db` varsayılan. Tüm operasyonlar Postgres + AuditLog.

---

## 8. Daha Derin Bağlam İçin

- **Kapsamlı handoff**: `AI-BOARDROOM-HANDOFF.md` (lokal, git-ignored) — son 1 hafta yapılanlar, açık sorunlar, ortam allowlist'i, ilk açılış checklist'i
- **Memory dosyaları**: `~/.claude/projects/-Users-egeusluer-Documents-agentex/memory/`
  - `MEMORY.md` — index
  - `project_agentex_roadmap.md` — 6-fazlı plan
  - `project_compare_module_phase2.md`, `project_draft_module.md`, `project_signatures_module.md`
  - `feedback_agentex_guardrails.md` — operasyonel kurallar (Hard Rules'un kaynağı)
- **Modül planları**: `docs/` — `compare-phase-3-plan.md`, `draft-module-plan.md`, `regulations-feed-plan.md`, `signatures-precheck-plan.md`, `meeting-copilot-*.md`
- **Tasarım**: `docs/PARAM-BRAND-CONCEPT-THEME.md`, `docs/ai-boardroom-ui-spec.md`, `docs/ai-boardroom-claude-wireframes.md`

---

## 9. İlk Açılış Checklist'i

Yeni session'da kullanıcı bağlam istemeden önce:
1. `git status && git log --oneline -5` — son commit'ler ve dirty state
2. Memory MEMORY.md'i indeksle
3. Eğer kullanıcı "Unitask"tan bahsediyorsa → `unitask_my_tasks` ile başla, **bu dosyanın §3'ündeki workflow'u izle**
4. Aksi halde "merhaba, nereden devam ediyoruz?" sor — sürprizleri gizleme

---

## 10. Bilinen Açık Sorunlar (kısa)

- Boardroom chief fail (5 ajan) — workaround: 3 ajan ile dene
- Production outbound HTTPS allowlist gerekli (handoff §10'da tam liste)
- Tasarım dili tutarsız: dashboard cam morphism vs modüller workspace tokens — yön kararı bekleniyor
- Yargı MCP'de tarih filtresi YOK
- Mevzuat scan otomasyonu YOK (cron eklenmedi, manuel buton + 60s throttle)
