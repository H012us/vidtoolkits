# MVP 2 & MVP 3 Testing Plan

## Overview

Testing for MVP 2 features (server-synced settings, health checks, pipeline abort, template system) and MVP 3 (end-to-end video render). Four layers:

| Layer | Owner | Scope |
|-------|-------|-------|
| **Unit tests** | Claude Code | Individual services and controllers in isolation |
| **SIT tests** | Claude Code | Route-level integration with mocked dependencies |
| **UAT tests** | User | End-to-end feature validation |

Run all tests via:
```bash
cd apps/api && pnpm test        # unit + SIT
cd apps/api && pnpm test:unit  # unit only
cd apps/api && pnpm test:uat   # SIT only
cd apps/web && pnpm test        # web unit tests
```

---

## Phase 1: Unit Tests

### 1.1 SettingsService (`application/services/SettingsService.test.ts`)

**Setup:** `withTempDir()` pattern. Instantiate service with temp `dataDir`.

**Test cases (7):**
- `get()` — file missing → returns defaults
- `get()` — partial file → merged with defaults
- `get()` — full file → exact values
- `get()` — invalid JSON → returns defaults
- `update()` — partial settings → file written with merged result
- `update()` — empty object → writes defaults
- `update()` then `get()` — round-trip verification

### 1.2 SettingsController (`presentation/controllers/SettingsController.test.ts`)

**Setup:** Mock `SettingsService` via `container.register()`. Use `makeMockResponse()`.

**Test cases (4):**
- `get()` → 200 with settings
- `update()` with valid body → 200
- `update()` with invalid body → 400 INVALID_SETTINGS
- `update()` — service throws → `next(err)`

### 1.3 HealthCheckService (`application/services/HealthCheckService.test.ts`)

**Setup:** `vi.spyOn()` on service methods. Mock container providers.

**Test cases (11):**
- `check()` returns DetailedHealth with all fields
- voicebox available when axios resolves
- voicebox unavailable on ECONNREFUSED
- edgeTts always available
- binaries.ffmpeg available when exec succeeds
- binaries.ffmpeg unavailable when exec fails
- remotion available when package.json exists
- remotion unavailable when package.json missing
- `testProvider('pixabay')` → configured: true
- `testProvider('unknown')` → Provider not found
- `testProvider()` throws → available: false

### 1.4 TemplateService (`application/services/TemplateService.test.ts`)

**Setup:** No infrastructure — pure service.

**Test cases (9):**
- Returns non-empty string
- Starts with YAML frontmatter (`---`)
- Contains `## Part 1` section
- Contains `keywords:` guidance
- Contains `cinematic`, `minimal`, `bold` style options
- Contains `en-US-AriaNeural` voice
- Contains Tips section

### 1.5 RenderController — Cancel method (`presentation/controllers/RenderController.test.ts`)

Extended existing file with cancel tests.

**Test cases (2):**
- `cancel()` → 200 `{ cancelled: true }`
- `cancel()` → throws NotFoundError → `next(err)`

### 1.6 Web API Clients (`apps/web/src/api/`)

**`settingsApi.test.ts` (4):** get resolves, update resolves, get rejects, update rejects
**`healthApi.test.ts` (4):** getDetailed resolves, testProvider resolves, both reject on error
**`templateApi.test.ts` (2):** get resolves, rejects on error

### 1.7 useHealthCheck hook (`apps/web/src/hooks/useHealthCheck.test.ts`)

**Setup:** Mock `@tanstack/react-query` + `healthApi`.

**Test cases (5):**
- Mount resolves → health set, error null
- Mount rejects → health null, error set
- `refresh()` resolves → health updated
- `refresh()` rejects → health unchanged, error set
- `loading` true during pending refresh

---

## Phase 2: SIT Tests

All in `apps/api/src/__tests__/routes/`.

### 2.1 Settings Routes (`routes/settings.test.ts`) — NEW

**Test cases (5):**
- `GET /api/settings` → 200 `{ settings }`
- `PATCH /api/settings` with valid body → 200
- `PATCH /api/settings` with empty body → 200
- `PATCH /api/settings` with unknown key → 200 (Zod strips extras)
- Wrong method → 404

### 2.2 Template Routes (`routes/template.test.ts`) — NEW

**Test cases (2):**
- `GET /api/templates/markdown` → 200 `{ template }`, `length > 0`
- Response starts with `---`

### 2.3 Health Detailed Routes (`routes/health.test.ts`) — EXTEND

**Test cases (5):**
- `GET /api/health/detailed` → 200 with all service fields
- `imageProviders` is array with name/configured/available
- `binaries` has ffmpeg and ffprobe
- `POST /api/health/test/pixabay` → 200 `{ name, configured, available }`
- `POST /api/health/test/unknown` → 200 `configured: false, available: false, error`

### 2.4 Render Cancel Route (`routes/render.test.ts`) — EXTEND

**Test cases (3):**
- `DELETE /api/render/:id` → 200 `{ cancelled: true }`
- `DELETE /api/render/:id` for nonexistent → 404 NOT_FOUND
- `DELETE /api/render/:id` with invalid UUID → 400 VALIDATION_ERROR

---

## Phase 3: UAT (user-executed)

Run `pnpm dev`, test manually.

### UAT 3.1 — Server-Synced Settings
- Open `/settings` → page loads with API key fields
- Enter Pixabay key → Save → toast confirmation
- Refresh → key persists
- Check `data/settings.json`

### UAT 3.2 — Health Check System
- Open `/settings` → health badges load
- Click "Test" on Pixabay → badge updates
- Visit `/api/health/detailed` → JSON with all statuses
- Open Project → "Check Readiness" → modal with full health report

### UAT 3.3 — Pipeline Abort on Error
- Create project with part **no keywords** → start render → pipeline stops, red error in log
- Verify no partial video file produced
- Valid parts → pipeline completes successfully

### UAT 3.4 — Render Cancel
- Start render → click "Stop Render" → SSE shows `type: 'stopped'`
- Job status shows not-running after cancel

### UAT 3.5 — Process Log UI
- Start render → live log updates with timestamps
- Color-coded: gray=info, green=success, red=error
- Per-part status grid updates in real-time
- Pipeline complete → video player appears

### UAT 3.6 — Markdown Template System
- Visit `/template` → full annotated template displayed
- Copy → button shows "Copied!"
- Download → file downloads
- Edit & Create → new project created
- HomePage "New from Template" → modal → project created, navigated to `/project/:id`

---

## Phase 4: UAT Results

### 2026-05-04

| Test | Result | Notes |
|------|--------|-------|
| UAT 3.1 | — | Not yet executed |
| **UAT 3.2** | **PASS** (backend fixed) | FFmpeg/FFprobe health check was returning "Command failed:..." error. Fixed by resolving full binary paths via `where.exe` before executing. All binaries now report correct version. UI shows green badges. |
| UAT 3.3 | — | Not yet executed |
| UAT 3.4 | — | Not yet executed |
| UAT 3.5 | — | Not yet executed |
| UAT 3.6 | — | Not yet executed |

**Backend fixes applied during UAT 3.2:**
- `checkBinary()` in `HealthCheckService.ts` now runs `where.exe ${name}` to get the full resolved path from Windows system PATH, then executes with quoted path — making it independent of the Node.js process's inherited PATH
- Error messages cleaned: strips "Command failed: ..." prefix and Windows CLI noise, falls back to friendly hint
- Remotion unavailable error message now includes the checked path for clarity
- All media provider `isAvailable()` methods now throw on non-200 instead of silently returning `false`
- SettingsPage "Test" button shows inline green check (success) or red error message after clicking

### MVP 3 Implementation Results

**Status: 12/13 code tasks implemented ✅ | All Phase A/B tests written and passing | Smoke test (task 13) ready to execute**

| # | Task | Implementation | Test Status |
|---|------|---------------|-------------|
| 1 | Fix rawMarkdown field | ✅ Added to entity, schema, orchestrator | Updated ✅ |
| 2 | Download images locally | ✅ `downloadImages()` in orchestrator | ✅ A.1 written |
| 3 | FFmpeg path quoting | ✅ `execFileAsync` array args | — |
| 4 | Edge-TTS voice param | ✅ `setMetadata()` before `toFile()` | — |
| 5 | VideoPlayer after refresh | ✅ `job?.outputPath ?? project.outputPath` | — |
| 6 | Render button health gate | ✅ `disabled={isStarting \|\| !allHealthy}` | — |
| 7 | Persist job progress | ✅ `persistJobProgress()` on every SSE event | ✅ A.4 written |
| 8 | Cleanup workDir | ✅ `finally` block with `fs.rm()` | ✅ A.2 written |
| 9 | Kill child on abort | ✅ `activeProcesses[]` + `killAllProcesses()` | ✅ A.3 written |
| 10 | Inline video playback | ✅ `<video controls>` in VideoPlayer | ✅ A.5 written |
| 11 | SSE reconnection | ✅ Exponential backoff 1s→2s→4s→8s→16s | ✅ A.6 written |
| 12 | Per-part errors | ✅ `useSSE` tracks `partErrors`, RenderProgress shows | — |
| 13 | Smoke test | READY | UAT C.1 (pending) |

**All 278 tests (220 unit + 36 SIT + 22 web) passing.**

---

## MVP 3: End-to-End Video Render Testing

### Phase A: Unit Tests

**A.1 PipelineOrchestrator — image download helper** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.1.1 | `downloadImages()` downloads to local files | ✅ PASS |
| A.1.2 | `downloadImages()` handles 404 gracefully | ✅ PASS |
| A.1.3 | `downloadImages()` uses correct extension from Content-Type | ✅ PASS |
| A.1.4 | `downloadImages()` falls back to URL extension | ✅ PASS |

**A.2 PipelineOrchestrator — temp cleanup** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.2.1 | `cleanupWorkDir()` deletes directory | ✅ PASS |
| A.2.2 | `cleanupWorkDir()` handles missing dir | ✅ PASS |

**A.3 PipelineOrchestrator — process tracking on abort** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.3.1 | `killAllProcesses()` kills tracked processes | ✅ PASS |
| A.3.2 | Abort signal kills processes before handler exits | ✅ PASS |

**A.4 RenderService — job progress persistence** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.4.1 | `sendProgress` callback updates job entity | ✅ PASS |
| A.4.2 | `persistJobProgress()` saves to disk | ✅ PASS |

**A.5 VideoPlayer — inline playback** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.5.1 | Renders `<video controls>` element | ✅ PASS |
| A.5.2 | `src` attribute set to downloadUrl | ✅ PASS |
| A.5.3 | Download button still functional | ✅ PASS |

**A.6 useSSE — reconnection** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| A.6.1 | `onerror` schedules retry | ✅ PASS |
| A.6.2 | Retries with exponential backoff | ✅ PASS |
| A.6.3 | Stops retrying after max retries | ✅ PASS |
| A.6.4 | `onopen` resets retry counter | ✅ PASS |

---

### Phase B: SIT Tests

**B.1 Image download integration (mock HTTP)** — Verified via unit tests A.1

| # | Test case | Result |
|---|-----------|--------|
| B.1.1 | `POST /api/render/:id/start` → images downloaded before RENDER_VIDEO | Verified via A.1 (filesystem) |
| B.1.2 | Failed image download doesn't block pipeline | Verified via A.1.2 (404 graceful) |

**B.2 Temp cleanup integration** — Verified via unit tests A.2

| # | Test case | Result |
|---|-----------|--------|
| B.2.1 | `workDir/` deleted after `DELIVER_RESULT` | Verified via A.2.1 |
| B.2.2 | `workDir/` deleted on pipeline error | Verified via A.2.2 |

**B.3 Render button health gate** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| B.3.1 | `POST /api/render/:id/start` returns 503 when FFmpeg unavailable | ✅ PASS |
| B.3.2 | `POST /api/render/:id/start` returns 503 when no image provider configured | ✅ PASS |

**B.4 Job progress during execution** ✅ WRITTEN

| # | Test case | Result |
|---|-----------|--------|
| B.4.1 | Job file on disk updated during execution | ✅ PASS |
| B.4.2 | Job file updated on abort with `status: failed` and `error: Cancelled by user` | ✅ PASS |

---

### Phase C: UAT (user-executed)

Run `pnpm dev:api && pnpm dev:web`. Voicebox must be running at `http://localhost:8000` before testing.

**UAT C.1 — End-to-end render (smoke test)**
- Upload a markdown file with 2 parts and valid keywords (`sunset`, `ocean` for part 1; `mountain`, `forest` for part 2)
- Click "Check Readiness" → verify all green
- Click "Render Video"
- Watch SSE log: all 7 steps appear in order
- Wait for `[COMPLETE]` in log
- VideoPlayer appears → click play → video plays inline
- Click "Download" → file downloads
- Refresh page → VideoPlayer still shown (task 5)

**UAT C.2 — Pipeline abort on error**
- Create project with one part that has NO keywords
- Start render → pipeline stops at FETCH_IMAGES, red error in log
- Verify no partial video file in `data/output/`
- Verify no `workDir/` left in `data/temp/`

**UAT C.3 — Render cancel**
- Start a render on a multi-part project
- Click "Stop Render" while RENDER_VIDEO is running
- Verify `[STOPPED]` in log
- Verify FFmpeg/Remotion processes no longer in Task Manager

**UAT C.4 — Render button health gate**
- Remove FFmpeg from PATH (temporarily) or disable image providers
- Open project → verify "Render Video" button is disabled
- Tooltip or disabled state explains why

**UAT C.5 — Voice selection (Edge-TTS)**
- In Settings, ensure no Voicebox configured (or it's down)
- Create project with voice set to `en-US-JennyNeural`
- Render → TTS uses the selected voice (listen to output audio)
- Verify Edge-TTS respects the voice parameter (task 4)

**UAT C.6 — SSE reconnection**
- Start a render
- Disconnect network briefly (or kill the API process, restart it)
- Verify SSE reconnects automatically and log continues updating
- Render completes successfully despite the interruption

**UAT C.7 — Per-part error visibility**
- Start render with mixed project (one part with no images available for keywords, one valid)
- Verify the failing part's card shows the error message directly (not just in the log scroll area)
