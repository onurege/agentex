# AI Boardroom — Context Handoff Document

> Bu doküman, AI Boardroom projesinin tüm implementasyon geçmişini, mevcut durumunu ve devam edilebilecek noktaları içerir.
> Yeni bir Claude Code context'ine verildiğinde, projeye tam bağlamla devam edilebilir.

---

## Proje Kimliği

- **Proje adı**: AI Boardroom
- **Repo root**: `/Users/egeusluer/Documents/agentex`
- **Framework**: Next.js 14 (App Router), React 18, Zustand, Tailwind CSS, Gemini AI
- **Branch**: `dev`
- **Dil**: Türkçe UI, İngilizce kod/yorum

---

## Ürün Tanımı

AI Boardroom, belgelerinizi uzman AI kuruluna sunduğunuz, ajanların belgeyi tartıştığı ve size net karar/aksiyonlar verdiği sinematik bir üründür.

**Ana akış (Stage Experience):**
1. `/app` — Agent Gallery: uzman ajanları seçin
2. `/app/setup` — Board Setup: belge yükleyin, bağlam ekleyin
3. `/app/boardroom` — Boardroom Scene: sinematik tartışma sahnesi
4. `/app/verdict` — Verdict Screen: kurul kararı ve aksiyonlar

**Yönetim (Control Room):**
- `/app/panel` — Dashboard
- `/app/panel/agents` — Agent Library
- `/app/panel/agents/[agentId]/cv` — CV Builder
- `/app/panel/agents/[agentId]/prompt` — Prompt Studio
- `/app/panel/templates` — Board Templates
- `/app/panel/runs` — Runs (search/filter/delete)
- `/app/panel/users` — Users (super_admin only)
- `/app/panel/audit` — Audit Log (super_admin only)

**Kayıtlı oturumlar:**
- `/app/runs/[runId]` — Saved verdict
- `/app/runs/[runId]/boardroom` — Boardroom replay

---

## Mimari Katmanlar

### 1. Stage Flow Store (`src/lib/boardroom-flow-store.ts`)
Zustand in-memory store. Agent seçimi → document upload → boardroom state → verdict seed. `resetFlow()` ve `restoreRun()` aksiyonları var.

### 2. Control Room Store (`src/lib/control-room-store.ts`)
Zustand + localStorage persist. CV draft/published, prompt draft/published, version metadata. `saveAuditEvent()` çağrıları tüm mutasyonlara wired.

### 3. Stage Agents Layer (`src/lib/stage-agents.ts`)
Published-only projection. `useStageAgents()`, `useSelectedStageAgents()`, `useStageChiefAgent()`, `getStageAgentSnapshot()`. Draft data asla stage'e sızmaz.

### 4. Boardroom Engine (`src/lib/boardroom-engine/`)
4 aşamalı multi-agent AI pipeline:
- `agent-pass.ts` — Per-agent Gemini çağrısı (paralel)
- `disagreement-pass.ts` — Cross-agent tension detection
- `rebuttal-pass.ts` — Per-agent rebuttal (paralel, her ajan kendi sesinde)
- `chief-pass.ts` — Rebuttal-aware synthesis + confidence level

### 5. Boardroom Orchestrator (`src/lib/boardroom-orchestrator.ts`)
AI result → cinematic OrchestrationStep[] dönüşümü. Deterministic fallback de mevcut. `convertAIResultToSteps()`, `convertAIVerdictToSeed()`.

### 6. Prompt Behavior Layer (`src/lib/prompt-behavior.ts`)
Published prompt → debate style dönüşümü. Assertiveness, verbosity, conservative flags.

### 7. Run History (`src/lib/run-history.ts`)
localStorage, max 50 run. Frozen agent snapshots + frozen prompt snapshots. `analysisMode`, `modelInfo`, `pipelineStages`, `confidenceLevel`.

### 8. Audit Log (`src/lib/audit-log.ts`)
localStorage, max 200 event. CV/prompt save/publish/rollback, run create/delete, template apply.

### 9. Dashboard Metrics (`src/lib/dashboard-metrics.ts`)
Real-time metrics: total runs, customized agents, published prompts, AI vs fallback, confidence distribution.

---

## API Routes

| Route | Amaç |
|-------|------|
| `/api/boardroom` | 4-stage AI pipeline: agent → disagreement → rebuttal → chief. Per-stage error handling. |
| `/api/gemini` | Legacy contract-review Gemini proxy |
| `/api/auth/[...nextauth]` | Google OAuth |
| `/api/connectors/google-drive/*` | Google Drive OAuth flow |
| `/api/meeting/transcript` | Meeting transcript import |

---

## Rol ve Yetki Sistemi

- `user` — default, sadece stage experience
- `authorized_user` — Panel erişimi, kendi ajanlarını yönetir
- `super_admin` — Users + Audit Log dahil tam erişim

**Çözümleme**: Env-based allowlist (`NEXT_PUBLIC_SUPER_ADMINS`, `NEXT_PUBLIC_AUTHORIZED_USERS`). `.env.local`'da `egeusluer@gmail.com` super_admin olarak tanımlı.

---

## Mevcut Durumda Tamamlanan Özellikler

### Stage Flow
- [x] Agent Gallery — published CV datası ile, detail drawer, seçim bar
- [x] Board Setup — document upload (PDF/DOCX/TXT), board summary, context notes, redirect guard
- [x] Boardroom Scene — AI-first pipeline + deterministic fallback, cinematic orchestration, sub-phase bar, live debate timeline, rebuttal events
- [x] Verdict Screen — risk badge, confidence badge, decisions, perspectives, resolved/unresolved disagreements, position changes, action items, copy/export/new run

### Control Room
- [x] Dashboard — real metrics, recent runs, recent audit activity
- [x] Agent Library — effective agent data (published CV reflected)
- [x] CV Builder — draft/publish, live preview, localStorage persist
- [x] Prompt Studio — draft/publish/rollback, version tracking
- [x] Board Templates — 4 templates, "Şablonu Kullan" applies to gallery
- [x] Runs — search, filter (mode/risk), delete with confirm, metadata badges
- [x] Users — super_admin only, example data
- [x] Audit Log — real events, action/target filters

### AI Pipeline
- [x] Multi-agent per-agent observation calls (parallel)
- [x] Cross-agent disagreement detection
- [x] Per-agent rebuttal calls (parallel, each agent's own voice/prompt)
- [x] Chief synthesis consuming rebuttals → resolved/unresolved/position changes/confidence
- [x] Fallback to deterministic orchestration on any failure

### Run History
- [x] Auto-save on completion
- [x] Frozen agent + prompt snapshots
- [x] analysisMode, modelInfo, pipelineStages
- [x] Saved verdict view + boardroom replay
- [x] Run delete + audit logging

### Integration
- [x] Published CV affects all stage pages
- [x] Published prompts affect boardroom debate behavior
- [x] Templates apply agent selections
- [x] Stage uses published only; drafts never leak

---

## Bilinen Kısıtlamalar / Devam Edilebilecek Konular

### Persistence
- Tüm data localStorage — backend API / database entegrasyonu yok
- Run history max 50, audit log max 200
- Cross-device sync yok

### AI Pipeline
- Per-agent rebuttal round tek tur — iteratif back-and-forth yok
- Chief pass rebuttal'ları summary olarak alıyor, full structured data olarak değil
- Confidence AI-determined — algoritmik doğrulama yok
- Deterministic fallback'ta rebuttal/confidence/position changes yok

### UI/UX
- Landing page eski branding — AI Boardroom'a güncellenmeli
- Legacy routes hâlâ mevcut (`/app/contract-review`, `/app/meeting-copilot`, `/app/settings`)
- Mobile responsive henüz optimize değil
- Motion/animation sistemi minimal — spec'teki sinematik geçişler eksik
- Staggered entrance animation yok

### Control Room
- Users sayfası örnek veri — real user management yok
- Audit log actor alanı hep "system" — real user identification yok
- Date range filter audit log'da yok
- Dashboard auto-refresh yok
- Run deletion geri alınamaz (soft-delete yok)

### Genel
- Session state in-memory — page refresh kaybeder (boardroom flow)
- Boardroom flow store'daki `selectedAgents` derivation hâlâ raw `BOARDROOM_AGENTS` kullanıyor (stage pages bypass ediyor ama store internal'ı eski)
- Old contract-review store + engine tamamen ayrı duruyor, temizlenmedi

---

## Önemli Spec Dosyaları

Yeni context'e girerken bunları da okuması gerekir:
- `docs/ai-boardroom-ui-spec.md`
- `docs/ai-boardroom-wireframe-spec.md`
- `docs/ai-boardroom-claude-wireframes.md`
- `docs/ai-boardroom-implementation-map.md`

---

## Key Files Quick Reference

| Dosya | Amaç |
|-------|------|
| `src/lib/boardroom-flow-store.ts` | Stage flow state (Zustand) |
| `src/lib/control-room-store.ts` | Panel data (Zustand + persist) |
| `src/lib/stage-agents.ts` | Published-only agent projection |
| `src/lib/boardroom-orchestrator.ts` | AI → cinematic steps + fallback |
| `src/lib/boardroom-engine/` | 4-stage AI pipeline |
| `src/lib/run-history.ts` | Run persistence + frozen snapshots |
| `src/lib/audit-log.ts` | Audit event persistence |
| `src/lib/prompt-behavior.ts` | Prompt → debate style |
| `src/lib/config/roles.ts` | Role resolution (env-based) |
| `src/lib/config/site.ts` | Brand config + stage steps |
| `src/lib/boardroom-agents.ts` | Default agent definitions |
| `src/app/api/boardroom/route.ts` | Multi-step Gemini pipeline |
| `src/components/stage/` | TopBar, ProgressBar, Layout |
| `src/components/boardroom/` | Scene, Seats, Timeline, Phase |
| `src/components/verdict/` | Hero, Decisions, Perspectives, etc. |
| `src/components/control-room/` | Layout, Sidebar, PermissionGate |

---

## Nasıl Devam Edilir

Yeni context'e şu prompt ile başlayın:

```
You are continuing the AI Boardroom implementation in this repository.

Project root: `/Users/egeusluer/Documents/agentex`

Read these files first:
- `/Users/egeusluer/Documents/agentex/AI-BOARDROOM-HANDOFF.md`
- `/Users/egeusluer/Documents/agentex/docs/ai-boardroom-ui-spec.md`
- `/Users/egeusluer/Documents/agentex/docs/ai-boardroom-implementation-map.md`

Then inspect the current implementation:
- `src/lib/boardroom-flow-store.ts`
- `src/lib/boardroom-engine/types.ts`
- `src/app/api/boardroom/route.ts`
- `src/app/app/boardroom/page.tsx`
- `src/app/app/verdict/page.tsx`

[Sonra spesifik task'ı buraya ekleyin]
```
