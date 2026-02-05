

## Fix: FFmpeg Worker File Not Found (HTTP 404)

### Problem Identified
The console logs show both CDN attempts are failing:
- **CDN 1 (unpkg.com)**: `Failed to fetch` - CORS/network issue 
- **CDN 2 (jsdelivr)**: `HTTP 404` - The file `ffmpeg-core.worker.js` does not exist

The root cause: **`@ffmpeg/core@0.12.6` does NOT include `ffmpeg-core.worker.js` in the ESM distribution**. This is a known issue in the ffmpeg.wasm project (GitHub issues #758, #767).

### Solution
For single-threaded FFmpeg.wasm (which is what `@ffmpeg/core` provides), we do NOT need the worker file. The correct approach is:

1. **Remove the worker file fetch** - it doesn't exist in the package
2. **Use cdnjs.cloudflare.com** as the primary CDN - better reliability than unpkg
3. **Load only `ffmpeg-core.js` and `ffmpeg-core.wasm`** - these are sufficient for single-threaded operation

### Changes

**File: `src/lib/audio-extractor.ts`**

| Change | Details |
|--------|---------|
| Update CDN sources | Use cdnjs.cloudflare.com as primary (more reliable), keep jsdelivr as fallback |
| Remove worker fetch | Single-threaded mode doesn't need `ffmpeg-core.worker.js` |
| Fix load call | Call `ffmpeg.load({ coreURL, wasmURL })` without workerURL |

Updated CDN sources:
```typescript
const CDN_SOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
];
```

Updated load function (simplified):
```typescript
async function loadFFmpegFromCDN(...) {
  // Only fetch TWO files (not three)
  const [coreURL, wasmURL] = await Promise.all([
    fetchToBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript', ...),
    fetchToBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm', ...),
  ]);

  // Load without workerURL for single-threaded mode
  await ffmpeg.load({ coreURL, wasmURL });
}
```

### Why This Works
- `@ffmpeg/core` is the single-threaded version of FFmpeg.wasm
- Single-threaded mode runs everything in the main WASM context, no Web Worker needed
- The worker file only exists in `@ffmpeg/core-mt` (multi-threaded version)
- cdnjs.cloudflare.com is a highly reliable CDN with better CORS support

### Expected Result
After this fix:
- FFmpeg will load successfully from cdnjs
- Download progress will show (5.2MB / 30MB etc.)
- The 162MB video will proceed to audio extraction
- If cdnjs fails, fallback CDNs will be tried

