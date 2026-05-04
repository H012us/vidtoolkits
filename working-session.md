# Working Session Summary — 2026-05-04

## Starting Point

Session resumed from 2026-05-03. Previous session had fixed dotenv loading and REMOTION_CONCURRENCY empty-string crash. This session focused on UAT 3.2 (health check system) which surfaced FFmpeg/FFprobe binary detection issues.

## What We Did

### Bug Fix: FFmpeg/FFprobe Binary Check — "Command failed:..." Error

**Root cause (symptom):** The health check on `/api/health/detailed` showed FFmpeg and FFprobe as unavailable with raw Windows CLI errors: `'ffmpeg' is not recognized as an internal or external command`. Even after the user installed FFmpeg to `C:\Users\Raw\Downloads\Compressed\ffmpeg\bin\` and added it to the system PATH via PowerShell, the health check still failed.

**Root cause (code):** `checkBinary()` called bare `execAsync(`${name} ${args.join(' ')}`, ...)` (e.g., `ffmpeg -version`). This depends on the binary being in the shell's PATH. Node.js `exec()` inherits PATH from the parent process — but when Claude Code runs inside Git Bash, it inherits the bash session's PATH, not the Windows system PATH that PowerShell updated.

**Fix:** `checkBinary()` now resolves the full binary path via `where.exe ${name}` before executing:

```ts
const wherePath = await execAsync(`where.exe ${name}`, { timeout: 5000 })
  .then(r => r.stdout.trim().split('\n')[0].trim())
  .catch(() => null);
const binary = wherePath ?? name;
const { stdout } = await execAsync(`"${binary}" ${args.join(' ')}`, { timeout: 5000 });
```

`where.exe` resolves binaries against the Windows system PATH registry, which is the authoritative source. Quoting the full path also protects against paths with spaces.

Error message also cleaned: strips "Command failed: ..." prefix, strips Windows CLI noise (`'...' is not recognized...operable program or batch file.`), falls back to a friendly hint when the raw message is empty.

### Bug Fix: Media Provider `isAvailable()` Swallowed Errors

`PixabayProvider`, `PexelsProvider`, and `UnsplashProvider` wrapped their HTTP health-check calls in `try/catch` and returned `false` on any error. This meant a configured-but-unavailable provider (e.g., invalid API key returning HTTP 403) looked identical to an unconfigured one.

**Fix:** `isAvailable()` now throws on non-200 status instead of swallowing errors:

```ts
const response = await axios.get(...);
if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
return true;
```

`HealthCheckService` also updated to read API keys from `SettingsService` (persisted store) rather than the DI container's provider list, ensuring consistency between what the Settings page shows and what the health check tests.

### UX Fix: SettingsPage "Test" Button Feedback

The "Test" button for image providers on the Settings page showed only a spinner while testing. After the test completed, there was no visible confirmation of success or failure.

**Fix:** Added `testFeedback` state to track per-provider results. After testing:
- Success → green `CheckCircle` icon shown for 5 seconds
- Failure → red inline error message with the error text shown for 5 seconds

## Files Modified

```
MODIFIED (FFmpeg binary check fix):
  apps/api/src/application/services/HealthCheckService.ts
  apps/api/src/application/services/HealthCheckService.test.ts
  apps/infrastructure/media-providers/PixabayProvider.ts
  apps/infrastructure/media-providers/PexelsProvider.ts
  apps/infrastructure/media-providers/UnsplashProvider.ts
  apps/web/src/pages/SettingsPage.tsx

UPDATED (session notes):
  CLAUDE.md
  test.md
  working-session.md
```

## Test Results

```
cd apps/api && pnpm test     # 210 unit tests ✅
cd apps/api && pnpm test:uat # 32 SIT tests ✅
cd apps/web && pnpm test     # 15 web tests ✅
```

## How to Resume

1. Start servers: `pnpm dev:api` + `pnpm dev:web`
2. FFmpeg is installed at `C:\Users\Raw\Downloads\Compressed\ffmpeg\bin\` — health check should show green
3. Voicebox must be running at `http://localhost:8000` for its health check to show green
4. Remaining UAT: 3.1 (settings), 3.3 (pipeline abort), 3.4 (render cancel), 3.5 (process log), 3.6 (template)
5. MVP 3 defined: 13 tasks (6 critical path, 3 reliability, 3 UX polish, 1 smoke test). See CLAUDE.md for full task list. test.md updated with unit/SIT/UAT cases for MVP 3.

## MVP 3 Planning Session (2026-05-04, continued)

After committing the FFmpeg fix (`45cb292`), the MVP 3 scope was defined. Full codebase exploration (3 agents) revealed these key findings:

### Critical gaps blocking end-to-end video render
1. `rawMarkdown` bug — PipelineOrchestrator sets `rawMarkdown: entity.createdAt` instead of actual markdown text
2. Images are remote URLs — `MediaAsset` has no local paths; Remotion can't reliably fetch remote images in headless Chromium; thumbnail URLs used (wrong resolution)
3. FFmpeg path quoting — `execAsync('ffmpeg "${path}"')` breaks on Windows paths with spaces
4. Edge-TTS ignores voice — `MsEdgeTTS.toFile()` never receives the voice parameter
5. VideoPlayer hidden after refresh — `job?.outputPath` guard fails, `project.outputPath` ignored
6. Render button not gated — always enabled regardless of health status

### Reliability gaps
7. Job entity never updated during execution — `setStep()` never called
8. Temp workDir never cleaned — disk space leak after every render
9. Abort doesn't kill child processes — FFmpeg/Remotion keep running after cancel

### UX gaps
10. No inline video playback — `<video>` tag missing, only download link
11. No SSE reconnection — EventSource onerror closes without retry
12. Per-part errors not visible in grid — log scroll only

### Files that need changes for MVP 3
- `apps/api/src/application/services/PipelineOrchestrator.ts` — tasks 1, 2, 3, 8, 9
- `apps/api/src/domain/entities/VideoProjectEntity.ts` — task 1
- `apps/api/src/application/services/RenderService.ts` — tasks 7, 9
- `apps/api/src/infrastructure/tts-engines/EdgeTTSEngine.ts` — task 4
- `apps/api/src/infrastructure/services/ProjectService.ts` — task 1
- `apps/web/src/pages/ProjectPage.tsx` — tasks 5, 6, 12
- `apps/web/src/components/VideoPlayer.tsx` — task 10
- `apps/web/src/hooks/useSSE.ts` — task 11
- `apps/web/src/components/RenderProgress.tsx` — task 12

## Starting Point

Session resumed from 2026-05-02's session. Previous session had fixed the web API test mocks and verified all 257 tests passing. Committed in `e61a3d2`. This session focused on UAT setup and a Voicebox health check investigation.

## What We Did

### Bug Fix: dotenv Loading from Wrong Directory (session 2026-05-02)

**Root cause:** `dotenv.config()` resolved `.env` relative to `process.cwd()`, which was `apps/api/` during development. Since `.env` lives at the project root, dotenv couldn't find it and all env vars fell back to Zod defaults. This caused `VOICEBOX_URL` to default to `http://127.0.0.1:17493` instead of reading from `.env`.

**Fix:** `EnvConfig.ts` now explicitly passes the root `.env` path to dotenv:
```ts
dotenv.config({ path: path.resolve(fileURLToPath(import.meta.url), '../../../../../../.env') });
```
6 levels up from `apps/api/src/infrastructure/config/` lands at the project root.

### Bug Fix: REMOTION_CONCURRENCY Crash (session 2026-05-02)

**Root cause:** `.env` had `REMOTION_CONCURRENCY=` (empty string). `z.coerce.number()` converts `""` to `NaN`, which fails `min(1)`.

**Fix:** Added `z.preprocess()` to convert empty strings to `undefined`:
```ts
REMOTION_CONCURRENCY: z.preprocess(v => v === '' ? undefined : v, z.coerce.number().int().min(1).max(8).optional()),
```

### Investigation: Voicebox Health Check "Cannot Reach"

During UAT, the health check showed "Cannot reach Voicebox at http://127.0.0.1:17493" even with Voicebox running. Verified that:
- `.env` had correct `VOICEBOX_URL=http://127.0.0.1:8000`
- After dotenv fix, API now correctly reports `http://127.0.0.1:8000`
- Voicebox at `localhost:8000` was not actually running — confirmed with `curl http://localhost:8000/profiles` (connection refused)
- Health check is **working correctly** — it reports unavailable because Voicebox wasn't started

**Key finding:** Voicebox must be started at `localhost:8000` before clicking the refresh button, or the health check will show "unavailable".

### Remotion Studio Breaking Change

`pnpm dev` (all workspaces) fails because `remotion.config.ts` uses `import { defineConfig } from 'remotion'`, which is no longer exported in remotion 4.0.454. This crashes the entire parallel run, killing API and web servers.

**Workaround:** Run API and web separately:
```bash
pnpm dev:api   # API on port 3001
pnpm dev:web   # Web on port 5173
```

### Commits

```
f712db5 fix: load .env from project root + handle empty REMOTION_CONCURRENCY
e61a3d2 fix: align TemplateEditor, health/settings/template APIs to use shared axios client
a783629 test: add unit, SIT and web tests for MVP 2 features
```

## Files Modified

```
MODIFIED:
  apps/api/src/infrastructure/config/EnvConfig.ts   — dotenv path fix + REMOTION_CONCURRENCY preprocess
  apps/web/src/api/healthApi.test.ts                — mock ./client instead of axios
  apps/web/src/api/settingsApi.test.ts             — mock ./client instead of axios
  apps/web/src/api/templateApi.test.ts             — mock ./client instead of axios
  CLAUDE.md                                        — session notes updated
```

## How to Resume

1. Ensure Voicebox is running at `http://localhost:8000` before testing health checks
2. Start servers: `pnpm dev:api` + `pnpm dev:web` (do NOT use `pnpm dev` — Remotion Studio will crash it)
3. Run tests: `cd apps/api && pnpm test && pnpm test:uat && cd ../web && pnpm test`
4. Check `test.md` for remaining UAT scenarios (3.1–3.6, all pending)
5. Remotion Studio fix is pending — `defineConfig` breaking change in remotion 4.0.454

---

# Working Session Summary — 2026-05-02

## Starting Point

Session resumed from 2026-05-01's session. Previous session had written 257 tests (210 unit + 32 SIT + 15 web) for MVP 2 features. All code committed in `e61a3d2`. Two untracked files: `test.md` (UAT plan) and `working-session.md`.

## What We Did

### Bug Fix: Web API Tests Broken

The 3 web API test files (`healthApi.test.ts`, `settingsApi.test.ts`, `templateApi.test.ts`) were failing with:
```
TypeError: Cannot read properties of undefined (reading 'interceptors')
  at src/api/client.ts:8
```

**Root cause:** `client.ts` calls `axios.create()` at module load time. The tests called `vi.mock('axios')` after importing, so the mock wasn't active when `client.ts` initialized.

**Fix:** Changed all 3 test files to mock `./client` directly instead of `axios`:
```ts
// BEFORE (broken):
vi.mock('axios');
const mockedAxios = axios as unknown as { ... };

// AFTER (working):
vi.mock('./client', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
import { api } from './client';
```

All 257 tests now passing.

### Test Results

```bash
cd apps/api && pnpm test     # 210 unit tests ✅
cd apps/api && pnpm test:uat # 32 SIT tests ✅
cd apps/web && pnpm test     # 15 web tests ✅
```

## Files Modified

```
MODIFIED (fix: mock ./client instead of axios):
  apps/web/src/api/healthApi.test.ts
  apps/web/src/api/settingsApi.test.ts
  apps/web/src/api/templateApi.test.ts
```

## How to Resume

1. Run `pnpm install && pnpm dev` to start all apps
2. Run test suite: `cd apps/api && pnpm test && pnpm test:uat && cd ../web && pnpm test`
3. Check `working-session.md` and `test.md` for UAT section — 6 manual test scenarios remain unexecuted
4. Web API tests use `vi.mock('./client')` pattern — remember not to mock `axios` directly when `client.ts` is in the import chain