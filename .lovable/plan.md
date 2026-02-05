
## What’s happening (root cause)

From the current code in `src/lib/audio-extractor.ts`, the FFmpeg loader downloads only:

- `ffmpeg-core.js`
- `ffmpeg-core.wasm`

…but **does not download/provide `ffmpeg-core.worker.js`** and also **does not pass `workerURL`** into `ffmpeg.load()`.

With `@ffmpeg/ffmpeg` (0.12.x), the worker script is required. When `coreURL` is a **blob URL** (as we create with `URL.createObjectURL()`), FFmpeg can’t reliably infer the worker script location. This commonly results in **FFmpeg.load() hanging indefinitely**, which matches “Loading audio processor…” with no progress.

A second, separate UX issue: `VideoUploadStep` calls `preloadFFmpeg()` on mount. That can start the load **without any onProgress callback**, and later `extractAudio()` can’t attach progress to an in-flight `ffmpegLoadPromise`. So users can see “Loading…” with no “real progress” even when the download is actually happening.

## Goals

1. Make FFmpeg loading reliable (no infinite “Loading audio processor…”).
2. Ensure progress updates always show up, even if preload started first.
3. Fail fast with a clear error + retry path if loading stalls.

---

## Changes to implement

### 1) Fix FFmpeg load by including the worker script (primary fix)
**File:** `src/lib/audio-extractor.ts`

- Update `loadFFmpegFromCDN()` to fetch **three** assets:
  - `ffmpeg-core.js` (coreURL)
  - `ffmpeg-core.wasm` (wasmURL)
  - `ffmpeg-core.worker.js` (workerURL)
- Call:
  - `await ffmpeg.load({ coreURL, wasmURL, workerURL })`

Why: this eliminates the “hang” caused by missing worker resolution when using blob URLs.

Also:
- Add a progress message before the `ffmpeg.load()` call like “Initializing audio processor…” so the user sees progress even after downloads complete.

### 2) Add a real “overall load timeout” (covers hangs inside ffmpeg.load)
**File:** `src/lib/audio-extractor.ts`

Right now the 30s timeout aborts the `fetch()` calls, but if downloads finish and `ffmpeg.load()` hangs, it can still stall forever.

- Wrap the entire CDN attempt (downloads + `ffmpeg.load`) in `Promise.race()` with a timer.
- If it fires, throw `FFMPEG_LOAD_TIMEOUT`.
- Ensure we reset `ffmpegLoadPromise = null` so a retry is possible.

### 3) Ensure progress works even if preload started first (subscriber model)
**File:** `src/lib/audio-extractor.ts`

Implement a small subscriber system:

- Maintain `Set<(p: AudioExtractionProgress) => void>` for “load progress listeners”
- When `getFFmpeg(onProgress)` is called:
  - If a load is already in progress (`ffmpegLoadPromise` exists), **register the callback** and return the same promise.
  - The loader emits progress to **all** subscribers.
- On completion or failure, clear subscribers.

Result: even if `preloadFFmpeg()` kicked off loading without UI, the moment the user uploads a video, the UI can attach and start receiving progress updates.

### 4) Surface “FFmpeg load timeout” cleanly in the upload flow
**File:** `src/hooks/useVideoUpload.ts`

Add explicit handling for `FFMPEG_LOAD_TIMEOUT` (and “failed to load audio processor” errors) to:

- Set `status: 'error'`
- Provide a clear message: “Audio processor download/initialization timed out. Please retry.”
- For smaller files (<= 50MB), continue offering fallback to upload original video (as you already do).

### 5) Improve the UI message shown during loading (optional but recommended)
**File:** `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`
**Types:** `src/types/ad-copy-studio.ts`

Right now the UI only displays a stage label (“Loading audio processor…”). We should display the real download message we already generate (e.g., `Downloading audio processor (5.2MB / 31.2MB)...`).

- Extend `VideoUpload` to include:
  - `extractionMessage?: string`
  - (optional) `extractionStagePercent?: number` (raw 0–100 for the stage)
- In `useVideoUpload` onProgress handler, set:
  - `extractionMessage = progress.message`
  - `extractionStagePercent = progress.percent`
- In `VideoUploadStep`, show `video.extractionMessage ?? getExtractionStageLabel(...)`

This makes “real progress” visible during loading, not just a generic label.

---

## Testing plan (end-to-end)

1. Go to `/admin/ad-copy-studio`.
2. Hard refresh (to avoid cached old FFmpeg assets) and upload a >25MB video.
3. Confirm you see:
   - “Starting audio processor download…”
   - Then “Downloading audio processor (XMB / YMB)…”
   - Then “Initializing audio processor…”
   - Then stage moves to “Reading video file…” etc.
4. Simulate bad network (Chrome DevTools → Network throttling “Slow 3G”):
   - Confirm progress still updates
   - If it stalls, it should error out with a clear timeout message rather than loading forever.
5. Try a second upload after a timeout:
   - Confirm it retries successfully (i.e., `ffmpegLoadPromise` resets correctly).

---

## Notes on the manifest.webmanifest CORS error

The `manifest.webmanifest` CORS message you pasted is unrelated to FFmpeg loading and does not explain the “Loading audio processor…” hang. We’ll focus on fixing the FFmpeg loader reliability first.

---

## “Next” improvements (after this is stable)

- Add a visible “Retry” button on the stuck/extracting row when loading fails.
- Add a “Cancel extraction” button that aborts ongoing extraction via an exposed AbortController.
- Add a lightweight diagnostics modal showing the last FFmpeg logs for debugging user-specific issues.
