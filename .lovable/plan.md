

# Fix FFmpeg Loading Stuck at "Loading audio processor..."

## Problem
The audio extraction is getting stuck at "Loading audio processor..." because the FFmpeg.wasm core files (~30MB total) are being fetched from unpkg.com using `toBlobURL()` which has no timeout or progress reporting. If the network is slow or the CDN is unresponsive, this fetch hangs indefinitely.

## Root Cause Analysis

| Issue | Impact |
|-------|--------|
| `toBlobURL` has no timeout | Fetches can hang forever |
| No progress during 30MB download | Users see 0% with no indication of activity |
| Single CDN dependency (unpkg.com) | If unpkg is slow, extraction fails |
| Preload failure is silent | Users don't know until they try to upload |

## Solution

### 1. Add timeout to FFmpeg loading
Wrap the `toBlobURL` calls with a timeout to fail fast if loading takes too long (30 seconds).

### 2. Add real progress during FFmpeg download  
Use `fetch` with progress tracking instead of `toBlobURL` to show actual download progress during the "Loading audio processor" phase.

### 3. Add CDN fallback
Try multiple CDN sources (unpkg, jsdelivr, esm.sh) if the primary fails.

### 4. Improve error messaging
Show clear error when FFmpeg fails to load with retry option.

## Implementation Details

### File: `src/lib/audio-extractor.ts`

**Replace the `getFFmpeg` function to include:**

1. **Progress-tracked fetch function**
```typescript
async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  
  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');
  
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, total);
  }
  
  return new Blob(chunks);
}
```

2. **CDN fallback list**
```typescript
const CDN_SOURCES = [
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
  'https://esm.sh/@ffmpeg/core@0.12.6/dist/esm',
];
```

3. **Loading timeout (30 seconds)**
```typescript
const FFMPEG_LOAD_TIMEOUT_MS = 30 * 1000;

// In getFFmpeg:
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('FFMPEG_LOAD_TIMEOUT')), FFMPEG_LOAD_TIMEOUT_MS);
});

await Promise.race([loadFFmpegWithProgress(), timeoutPromise]);
```

4. **Progress reporting during download**
```typescript
onProgress?.({
  stage: 'loading',
  percent: Math.round((loaded / total) * 50), // 0-50% for core.js, 50-100% for wasm
  message: `Downloading audio processor (${(loaded / 1024 / 1024).toFixed(1)}MB)...`,
});
```

### File: `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`

**Add better loading state display:**
- Show download progress percentage during FFmpeg loading
- Display estimated time remaining based on download speed
- Add "Cancel" button to abort loading

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/audio-extractor.ts` | Replace toBlobURL with progress-tracked fetch, add timeout, add CDN fallback |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Show download progress during loading stage |

## Expected Outcome

After these changes:
- Users will see real download progress (e.g., "Downloading audio processor (5.2MB / 30MB)...")
- Loading that takes too long will timeout with a clear error
- CDN failures will automatically try alternative sources
- Users can cancel if loading is too slow

