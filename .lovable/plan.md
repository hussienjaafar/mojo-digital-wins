
## Goal
Deeply investigate why client-side audio extraction is still slow and make it reliably fast for typical MP4 uploads (especially AAC-in-MP4), with clear diagnostics when it’s not.

## What we know from the codebase (current state)
From `src/lib/audio-extractor.ts`:
- Extraction is split into phases with timings:
  - `wasmLoadMs`, `writeInputMs`, `probeMs`, `extractMs`, `readOutputMs`, `totalMs`
- Even in “copy mode”, we still do:
  1) `await fetchFile(videoFile)` (reads the entire file into memory)
  2) `await ffmpeg.writeFile(...)` (ships a large Uint8Array to the worker)
  3) then `ffmpeg.exec(...)`

From `src/hooks/useVideoUpload.ts`:
- For files > 25MB, we extract audio first, then upload the extracted audio.
- The UI progress mapping treats extraction as 0–40% overall progress.

From `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`:
- FFmpeg preloads after 1s (good), but that only solves core download/load time.

## Likely root causes of “still very long”
1) **Input write step dominates**: `fetchFile(videoFile)` + `writeFile` must read/copy the full video into FFmpeg’s virtual FS. For 150–500MB, this can take a long time and spike memory. This cost exists even when we do fast `-acodec copy`.
2) **Console log overhead**: We currently attach a global `ffmpeg.on('log', ...)` that prints every FFmpeg log line. FFmpeg can emit a lot of logs; heavy `console.log` can materially slow long-running operations.
3) **We still may be re-encoding in practice**: If probe fails to detect AAC/MP3 correctly, or input has an unusual codec, we fall back to re-encode. Even with optimized settings, WASM re-encoding can be slow on some machines.
4) **Single-threaded runtime**: Multi-threaded FFmpeg.wasm requires cross-origin isolation headers; if unavailable, we’re in a slower mode. Even if copy-mode is fast, any re-encode becomes painful.

## Investigation-first approach (what we’ll build to debug deeply)
### A) Add a “Diagnostics Report” for every extraction
Implement a structured debug report that can be copied to clipboard from the UI when extraction is slow or fails:
- Browser info: `navigator.userAgent`, `navigator.hardwareConcurrency`
- Security/runtime: `crossOriginIsolated`, `typeof SharedArrayBuffer !== 'undefined'`
- File stats: size, extension, mime type
- Codec detection results (what we *think* codec is)
- Extraction mode used: copy vs reencode
- Timings: wasmLoad/write/probe/extract/read/total
- A capped ring buffer of FFmpeg log lines (last N=200), only collected when diagnostics is enabled or extraction exceeds a threshold (ex: 20s)

Where it will surface:
- In `VideoUploadStep`, add a “View extraction details” link for items in `extracting` or `error`.
- Optionally auto-show it if `totalMs > X`.

### B) Make timings visible during extraction (not only at the end)
Right now, timings are logged when extraction completes. If it takes minutes, we need visibility mid-flight.
- Show “Stage: Loading / Preparing file / Probing / Extracting / Finalizing”
- Show elapsed time since extraction start
- Show which stage is currently consuming time (especially “Preparing file” vs “Extracting”)

## Performance fixes we’ll implement (based on strongest bottlenecks)
### 1) Avoid the full-file copy into MEMFS by using `WORKERFS` mount (major improvement)
Replace:
- `await ffmpeg.writeFile(inputFileName, await fetchFile(videoFile))`

With:
- `await ffmpeg.createDir('/work')`
- `await ffmpeg.mount(FFFSType.WORKERFS, { files: [videoFile] }, '/work')`
- Use input path like `/work/${videoFile.name}` (sanitized as needed)

Why:
- `WORKERFS` lets FFmpeg access the File without us first converting it to a huge Uint8Array and transferring it to the worker.
- This typically reduces both time and memory pressure dramatically for large files.

Cleanup:
- Ensure `unmount('/work')` and directory cleanup happens in `finally` to avoid accumulating mounted FS state across runs.

### 2) Remove (or gate) the always-on `ffmpeg.on('log', console.log...)` handler
Change to:
- Default: do not print every FFmpeg log line.
- Debug mode only: capture logs into a ring buffer, optionally print a minimal subset.
This prevents console I/O from becoming the bottleneck.

### 3) Replace “probe by failing ffmpeg -i” with ffprobe or “try copy first”
Current probe:
- `ffmpeg.exec(['-i', input])` (expected to fail) and parse logs.

Improve to one of:
- Preferred: **try copy extraction first** (fast path) and if it fails, fall back to re-encode.
  - This avoids a whole extra run for the common AAC case.
- Or: use `ffmpeg.ffprobe(...)` with `-show_entries stream=codec_name,codec_type` output to a file, then read + parse. This is more deterministic and produces less noisy output than parsing logs.

### 4) Make re-encode faster by switching default fallback to AAC-in-M4A (optional but likely worthwhile)
If copy mode is not possible:
- Instead of MP3 (`libmp3lame`), try:
  - `-c:a aac -b:a 64k -ar 16000 -ac 1 output.m4a`
Rationale:
- AAC encoding is often faster than LAME MP3 in constrained environments.
- Whisper accepts M4A.
Fallback if AAC encoder is unavailable:
- Keep the current MP3 fallback.

### 5) Improve the command for copy mode reliability
When copying:
- Add explicit stream selection to avoid edge cases:
  - `-map 0:a:0 -vn -c:a copy`
Optionally add:
- `-sn -dn` to ignore subtitle/data streams that sometimes complicate mapping.

## Concrete file-level implementation plan
### File 1: `src/lib/audio-extractor.ts`
1) Add a `Diagnostics` capability:
   - `enableDiagnostics?: boolean`
   - `onDiagnostics?: (report) => void`
   - ring buffer for FFmpeg logs (last 200 lines)
2) Stop globally logging FFmpeg output by default.
3) Implement `WORKERFS` mount-based input handling:
   - mount `/work` with the actual `File`
   - use mounted path as input
   - ensure `unmount` in `finally`
4) Change extraction flow:
   - Attempt copy mode first (to `.m4a`), measure, if non-zero exit or error → fallback
   - Fallback to re-encode (prefer AAC → fallback MP3)
5) Ensure timings measure:
   - mount time (new)
   - copy attempt time (new)
   - fallback time (new)
6) Return richer result:
   - include `diagnosticsReport` optionally
   - include `selectedOutputMimeType` and extension reliably

### File 2: `src/hooks/useVideoUpload.ts`
1) Store extraction debug info per video (in-memory only):
   - last timings
   - mode used
   - output type
2) If extraction exceeds a threshold (e.g., 30s), set a “slow extraction” flag that enables diagnostics collection.
3) Ensure contentType handling is robust for `.m4a`.

### File 3: `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`
1) Add a “Details” UI affordance for each video row:
   - When status is `extracting`, show stage + elapsed time
   - When status is `ready` after extraction, show “Extracted as M4A (copy)” or “Converted to M4A (re-encode)”
   - When slow/error, show a “Copy diagnostic report” button
2) Make sure progress UI doesn’t look “stuck” in copy mode:
   - Copy operations may complete without many progress events; we’ll show stage-based activity (spinner + elapsed time) even if percent doesn’t move.

## How we’ll validate (deep investigation checklist)
1) Run extraction on a known AAC-in-MP4 file:
   - Expect: mount time small, copy attempt succeeds, total time drops substantially.
2) Confirm which stage was slow before vs after:
   - Expect the biggest reduction in the “writeInput/mount” phase.
3) Test on at least two browsers (Chrome + Safari if possible):
   - Ensure mount works; if not, diagnostics report should clearly explain and we’ll gracefully fall back to current approach.
4) Confirm output uploads + downstream transcription still work with `.m4a`.
5) Confirm memory doesn’t balloon across multiple extractions (unmount cleanup).

## Risks / fallbacks
- `WORKERFS` can be finicky depending on environment; if mount fails:
  - fall back to the existing `fetchFile + writeFile` path automatically
  - include the mount failure in diagnostics
- AAC encoder availability:
  - If `-c:a aac` fails, automatically fallback to MP3 re-encode.

## Expected outcome
After these changes:
- Standard MP4s with AAC audio should be fast because:
  - no full-file copy into MEMFS (WORKERFS)
  - copy-first extraction path
  - reduced console overhead
- When extraction is slow, you will get a clear report showing exactly where time is spent (mount/copy/encode) and why (copy failed, no SAB, etc.).
