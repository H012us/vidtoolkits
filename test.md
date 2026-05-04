# MVP 2 Testing Plan

## Overview

Testing for MVP 2 features — server-synced settings, health checks, pipeline abort, and markdown template system. Three layers:

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
