# vidtoolkits — Video Creation Toolkit

## MVP Progress

### MVP 1 — Core Pipeline (COMPLETED) ✅
**Repository:** https://github.com/H012us/vidtoolkits

**What was built:**
- Complete render pipeline with 7 steps: FETCH_IMAGES → GENERATE_TTS → MEASURE_DURATIONS → ASSEMBLE_COMPOSITION → RENDER_VIDEO → POST_PROCESS → DELIVER_RESULT
- Remotion `renderMedia()` with real HTTP serveUrl (spawns temp preview server, waits for localhost:PORT, then renders)
- SSE (Server-Sent Events) progress broadcasting to frontend with step/progress/error/complete/heartbeat events
- FFmpeg H.265 post-processing with QSV hardware acceleration (auto-detect, fallback to libx265)
- Two-tier cache: LRU memory (500 items, 1h TTL) + disk JSON (2GB, 7-day TTL)
- Vitest test suite: unit + UAT integration tests (35 test files)
- Fixed bugs: upload 500, SSE 404, false-positive UI success message, Remotion codec "undefined"

**Bugs fixed during MVP 1:**
- Upload returned 500 (fixed: missing UploadService registration)
- SSE status endpoint returned 404 (fixed: incorrect route path)
- UI showed "Video rendered successfully" when pipeline actually failed (fixed: SSE hook now checks `result.success`)
- Remotion "Got unexpected codec 'undefined'" (fixed: added required `codec:'h264'` param + proper serveUrl approach)

### MVP 2 — API Keys, Health Checks, Error Logging, Template Guide (COMPLETED) ✅
**Repository:** https://github.com/H012us/vidtoolkits (branch: master)

**What was built:**

1. **Server-synced API key configuration**
   - `GET /api/settings`, `PATCH /api/settings` persisting to `data/settings.json`
   - `SettingsService` with get/update, merged with `.env` at bootstrap (env wins)
   - Settings page auto-loads from server, per-field save with visual confirmation

2. **Pre-render prerequisite health checks**
   - `GET /api/health/detailed` — checks Voicebox, Edge-TTS, media providers, ffmpeg, ffprobe, remotion
   - `POST /api/health/test/:provider` — test individual provider
   - `HealthCheckService` — parallel checks with latency measurement
   - `RenderService.startRender()` validates services → 503 with failure list if unavailable
   - Settings page shows live green/red/yellow health badges per service
   - ProjectPage "Check Readiness" button with modal showing full health report

3. **Process log with stop-on-error checkpoints**
   - Pipeline aborts on first critical failure (strict failure — no partial renders)
   - `FETCH_IMAGES`, `GENERATE_TTS` use `Promise.all` with try/catch → throws `RenderError`
   - `RENDER_VIDEO` catches errors, broadcasts error, fails job
   - SSE events include `partIndex`, `partTitle` for per-part detail
   - `DELETE /api/render/:id` cancel endpoint with `AbortController` per job
   - `type: 'stopped'` SSE event on cancellation
   - RenderProgress: color-coded log (gray/green/yellow/red), per-part status grid, "Stop Render" button

4. **Comprehensive markdown template**
   - `GET /api/templates/markdown` — full annotated template
   - `/template` page — copy, download, edit+create modal
   - HomePage "New from Template" shortcut button
   - `POST /api/projects/from-template` — create project from markdown body
   - Template includes: YAML frontmatter, annotated part sections, keyword tips, style guide, usage tips

## Project Overview

A web app that converts markdown scripts into videos using AI-generated voice-over and free stock imagery.
**Target hardware:** Windows 11, i7 10th gen, 16GB RAM.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start development (all apps in parallel)
pnpm dev

# Start individual apps
pnpm dev:api    # API: http://localhost:3001
pnpm dev:web    # Frontend: http://localhost:5173
pnpm dev:remotion  # Remotion Studio: http://localhost:1000

# Build for production
pnpm build

# Run tests
pnpm test
```

## Architecture

### Monorepo Structure (pnpm workspaces)

```
vidtoolkits/
├── apps/
│   ├── api/              # Node.js/Express backend (Clean Architecture)
│   └── web/              # React 18 + Vite frontend
├── packages/
│   └── shared/           # Shared TypeScript interfaces, types, constants
└── remotion/             # Remotion video composition (separate entry point)
```

### Clean Architecture Layers (apps/api)

```
presentation  →  routes, controllers, SSE
      ↓
application   →  services (PipelineOrchestrator, MarkdownParserService, etc.)
      ↓
domain        →  entities (VideoProjectEntity, RenderJobEntity), errors
      ↑
infrastructure →  implements application interfaces (media-providers, tts-engines, cache, remotion)
```

### Key Design Decisions

1. **Plugin architecture for media providers** — `IMediaProvider` interface with Pixabay (priority 1) > Pexels (2) > Unsplash (3) fallback chain. Add a new source by implementing `IMediaProvider` and registering in `bootstrap.ts`.
2. **Plugin architecture for TTS engines** — `ITTSEngine` with Voicebox (local, priority 1) → Edge-TTS (cloud, priority 2). Auto-detects which engine is available via `isAvailable()`.
3. **Pipeline pattern** — `PipelineOrchestrator` runs 8 sequential steps with controlled parallelism (p-limit). Progress via SSE (Server-Sent Events).
4. **Two-tier cache** — LRU memory cache (500 items, 1h TTL) + disk cache (2GB, 7-day TTL).
5. **Manual DI container** — `apps/api/src/infrastructure/container.ts`. Services registered in `bootstrap.ts`.

## Pipeline Steps (in order)

1. **FETCH_IMAGES** — Parallel (p-limit 6). MediaProviderRegistry tries providers in priority order.
2. **GENERATE_TTS** — Parallel (p-limit 2). Voicebox → Edge-TTS fallback.
3. **MEASURE_DURATIONS** — Parallel. ffprobe each TTS file.
4. **ASSEMBLE_COMPOSITION** — Write `compositions.json` with all part data.
5. **RENDER_VIDEO** — Remotion `renderMedia()`. Concurrency auto-detected (min(cpus-1, 4) = 3 on target).
6. **POST_PROCESS** — FFmpeg H.265 with QSV hardware acceleration (fallback: libx265).
7. **DELIVER_RESULT** — Move to output/, SSE broadcast, job status update.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/upload | Upload .md file, returns project |
| GET | /api/projects | List all projects |
| GET | /api/projects/:id | Get project details |
| PATCH | /api/projects/:id | Update project (title, voice, etc.) |
| DELETE | /api/projects/:id | Delete project |
| POST | /api/render/:id/start | Start render pipeline |
| GET | /api/render/:id/status | SSE stream for progress |
| GET | /api/render/:id/download | Download rendered video |
| GET | /api/health | Health check |

## Markdown Format

```markdown
---
title: "My Video Title"
style: "cinematic"       # cinematic | minimal | bold
voice: "en-US-AriaNeural"
durationPerPart: 8
---

## Part 1: Introduction
keywords: sunset, ocean, beach

Welcome to this video about beautiful sunsets.
We'll explore the most stunning ocean views.

## Part 2: Deep Dive
keywords: mountain, forest, hiking

Let's talk about mountain adventures.
```

## Performance Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Node.js heap | 4GB max | `--max-old-space-size=4096` |
| Remotion concurrency | 3 | min(os.cpus()-1, 4) |
| Image fetching | 6 parallel | p-limit(6) |
| TTS generation | 2 parallel | p-limit(2) |
| Memory cache | 500 items | LRU, 1h TTL |
| Disk cache | 2GB | 7-day TTL, auto-cleanup |

## Security

- All API keys in `.env` (never in source code)
- Input validation via **Zod** on all routes
- Helmet security headers + CORS whitelist
- Rate limiting: 100 req/min general, 10 req/min render
- No HTML passthrough in markdown (remark strips it)
- All temp paths generated with UUIDs (no user input in file paths)

## Adding New Features

### New media provider
1. Create `apps/api/src/infrastructure/media-providers/MyProvider.ts`
2. Implement `IMediaProvider`
3. Register in `apps/api/src/infrastructure/bootstrap.ts`

### New TTS engine
1. Create `apps/api/src/infrastructure/tts-engines/MyEngine.ts`
2. Implement `ITTSEngine`
3. Register in `bootstrap.ts` — it automatically joins the fallback chain

### New pipeline step
1. Add to `PIPELINE_STEPS_ORDER` in `packages/shared/src/constants/index.ts`
2. Implement in `PipelineOrchestrator.ts`

## Technology Stack

| Layer | Tech |
|-------|------|
| Monorepo | pnpm workspaces |
| API | Express + TypeScript + Zod + Helmet + Pino |
| Frontend | React 18 + Vite + TailwindCSS + Zustand + React Query |
| Video | Remotion 4 (`renderMedia()`) + FFmpeg H.265/QSV |
| TTS | Voicebox (local, localhost:17493) → Edge-TTS (cloud fallback) |
| Images | Pixabay → Pexels → Unsplash (fallback chain) |
| Cache | lru-cache (memory) + disk JSON (2-tier) |
| MD Parsing | gray-matter + remark + unist-util-visit |

## Environment Variables

All in `.env.example`. **All optional** — the app works without API keys using fallback behavior.

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| FRONTEND_URL | CORS origin | http://localhost:5173 |
| PIXABAY_API_KEY | Pixabay API key | - |
| PEXELS_API_KEY | Pexels API key | - |
| UNSPLASH_ACCESS_KEY | Unsplash Access Key | - |
| VOICEBOX_URL | Voicebox base URL | http://127.0.0.1:17493 |

## File Structure Reference

```
apps/api/src/
├── server.ts                    # Express entry point + bootstrap
├── domain/
│   ├── entities/               # VideoProjectEntity, RenderJobEntity
│   └── errors/                 # DomainError subclasses
├── application/
│   └── services/               # PipelineOrchestrator, MarkdownParserService, RenderService,
│                                # SettingsService, HealthCheckService, TemplateService
├── infrastructure/
│   ├── config/                  # EnvConfig (Zod), AppConfig
│   ├── container.ts            # Manual DI container
│   ├── bootstrap.ts            # Service registration
│   ├── media-providers/        # Pixabay, Pexels, Unsplash + Registry
│   ├── tts-engines/            # Voicebox, Edge-TTS
│   ├── cache/                  # CacheManager (LRU + disk)
│   ├── persistence/            # FileSystemProjectStore, RenderJobStore
│   ├── logger.ts               # Pino logger
│   └── fsUtils.ts              # ensureDir, etc.
├── presentation/
│   ├── routes/                 # health, project, upload, render, settings, template routes
│   ├── controllers/            # ProjectController, UploadController, RenderController,
│   │                            # SettingsController
│   ├── middleware/             # errorHandler, validateRequest, rateLimiter
│   └── SSE/                    # SSEManager (Server-Sent Events)
└── __tests__/                  # Vitest test suite + helpers/factories/fixtures

apps/web/src/
├── api/                         # client, projectApi, renderApi, uploadApi, settingsApi,
│                                # healthApi, templateApi
├── components/                  # AppLayout, RenderProgress, VideoPlayer, TemplateEditor
├── hooks/                      # useSSE, useProject, useRender, useUpload, useHealthCheck
├── pages/                      # HomePage, ProjectPage, SettingsPage, TemplatePage
├── stores/                     # appStore (Zustand)
└── types/                     # AppSettings, VideoProject types
```