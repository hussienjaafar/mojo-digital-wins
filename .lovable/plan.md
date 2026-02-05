
## Diagnosis (why you’re still seeing the timeout)

From the latest logs:

- `https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/esm/ffmpeg-core.js` loads (200)
- `https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/esm/ffmpeg-core.wasm` fails (404)

So CDN #1 can never succeed because **cdnjs does not host the required `.wasm` file** for this library (it appears to only host the JS wrapper files). After that, we fall back to unpkg/jsdelivr, but the loader currently has two behaviors that make timeouts much more likely:

1) **Timeout is too aggressive (60s) for a ~30MB wasm download** on slower connections.  
2) **One shared AbortController / timeout is used across all CDN attempts**, so if CDN #1 fails quickly, CDN #2 often has significantly less than 60s left before it gets aborted.

Result: users hit `FFMPEG_LOAD_TIMEOUT` even though their network is “fine”, just not fast enough (or one CDN is slow/blocked).

---

## What we will change

### A) Remove cdnjs from the FFmpeg CDN fallback list (because it can’t supply the wasm)
**File:** `src/lib/audio-extractor.ts`

- Update `CDN_SOURCES` to only include sources that actually host:
  - `ffmpeg-core.js`
  - `ffmpeg-core.wasm`

Recommended order:
1. jsDelivr (often most reliable)
2. unpkg
(Optionally add a 3rd known-good mirror if desired.)

### B) Give each CDN attempt its own timeout + abort controller (so retries are real retries)
**File:** `src/lib/audio-extractor.ts`

Refactor `getFFmpeg()` so each CDN attempt does:

- `const attemptAbortController = new AbortController()`
- `const attemptTimeoutId = setTimeout(() => attemptAbortController.abort(), ATTEMPT_TIMEOUT_MS)`
- Call `loadFFmpegFromCDN(..., attemptAbortController.signal)`
- `clearTimeout(attemptTimeoutId)` in both success and failure paths

This prevents CDN #2 from inheriting a “nearly expired” timer from CDN #1.

### C) Increase the FFmpeg load timeout to something realistic for wasm downloads
**File:** `src/lib/audio-extractor.ts`

- Increase `FFMPEG_LOAD_TIMEOUT_MS` from **60s → 180s** (3 minutes), or make it configurable.
- Keep extraction timeout separate (already 3 minutes for the entire extraction).

This is specifically to accommodate:
- 30MB wasm download time on slower networks
- the `ffmpeg.load()` initialization step after download

### D) Improve error reporting to avoid “timeout” when it’s actually a 404
**File:** `src/lib/audio-extractor.ts`

- When a CDN fails with `HTTP 404`, we’ll log/emit a progress message like:
  - “CDN missing required file; switching to backup…”
- Only throw `FFMPEG_LOAD_TIMEOUT` after:
  - all CDNs have been tried, and
  - the failures were timeouts (not immediate 404s)

This makes the UI error more accurate and makes debugging easier.

---

## Files to change

- `src/lib/audio-extractor.ts` (only)

No database/backend changes required.

---

## How we’ll verify (end-to-end)

1. Go to `/admin/ad-copy-studio` and hard refresh.
2. Upload the 162MB video again.
3. Confirm in the UI:
   - It no longer tries the cdnjs URL first
   - You see “Downloading audio processor (XMB / YMB)…”
   - It proceeds past “Initializing audio processor…”
4. Throttle network to “Fast 3G” in DevTools and retry:
   - Confirm it does not fail at 60 seconds anymore.
5. Re-test once more after a failed attempt (retry path):
   - Confirm it can still recover and try again (promise resets properly).

---

## Notes / optional follow-up improvement (if needed)

If some corporate networks block unpkg/jsDelivr entirely, the most robust long-term solution is to **self-host the two FFmpeg core files** (JS + WASM) as static assets under your app (or your backend file storage with proper caching headers). That would eliminate third-party CDN reliability issues. We can consider that if the timeout persists after the fixes above.
