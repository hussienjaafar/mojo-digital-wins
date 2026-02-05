
## Fix: FFmpeg.wasm Hanging on `load()` - Root Cause Found

### Problem Diagnosis

After researching the FFmpeg.wasm GitHub issues (#815, #687, #804) and the official React Vite example, the root cause of the initialization hang is clear:

**Vite pre-bundles `@ffmpeg/ffmpeg` and `@ffmpeg/util` by default, which breaks the internal Web Worker loading mechanism.** This causes `ffmpeg.load()` to hang indefinitely without any error.

From GitHub Issue #815 (Jan 2025):
> "if you are using vite adding ffmpeg in the exclude array in the optimizedeps filed in vite.config file solved the issue."

The official FFmpeg.wasm React Vite example includes this configuration:
```typescript
optimizeDeps: {
  exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
}
```

Your current `vite.config.ts` is missing this configuration entirely.

---

### Solution

#### Change 1: Update vite.config.ts

Add the `optimizeDeps.exclude` configuration to prevent Vite from pre-bundling FFmpeg:

| File | Change |
|------|--------|
| `vite.config.ts` | Add `optimizeDeps: { exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"] }` |

```typescript
// vite.config.ts - add this configuration
export default defineConfig(({ mode }) => ({
  // ... existing config ...
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
  // ... rest of config ...
}));
```

#### Change 2: Update CDN to match installed version

The installed `@ffmpeg/ffmpeg` version is `0.12.15`, but the code tries to load `@ffmpeg/core@0.12.6` from CDN. Update to use a matching/compatible version:

| File | Change |
|------|--------|
| `src/lib/audio-extractor.ts` | Update `CDN_SOURCES` to use `@ffmpeg/core@0.12.10` (the latest stable) |

```typescript
// Updated CDN_SOURCES
const CDN_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
  'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];
```

---

### Technical Details

#### Why `optimizeDeps.exclude` is Required

1. `@ffmpeg/ffmpeg` uses dynamic imports and Web Workers internally
2. When Vite pre-bundles the package, it mangles the internal module structure
3. This breaks the Web Worker loading mechanism (wrong MIME types, missing chunks)
4. The result is `ffmpeg.load()` hangs forever without throwing an error

#### Why Version Alignment Matters

- The `@ffmpeg/ffmpeg` wrapper (v0.12.15) expects specific file structures from `@ffmpeg/core`
- Using v0.12.6 core files with v0.12.15 wrapper may cause subtle incompatibilities
- v0.12.10 is the latest stable version with confirmed working CDN files

---

### Files to Modify

1. **`vite.config.ts`** - Add optimizeDeps.exclude configuration
2. **`src/lib/audio-extractor.ts`** - Update CDN version to 0.12.10

---

### Verification Steps

After implementing:

1. **Hard refresh the page** (Ctrl+Shift+R / Cmd+Shift+R) to clear cached modules
2. Open browser DevTools Network tab
3. Go to `/admin/ad-copy-studio`
4. Upload a video file
5. Confirm you see:
   - "Connecting to jsDelivr..." message
   - "Downloading audio processor (X MB / 30 MB)..." with progress
   - "Initializing audio processor..." (should complete in 1-5 seconds)
   - "Audio processor ready"
6. The extraction should then proceed normally

---

### Why Previous Fixes Didn't Work

| Previous Attempt | Why It Failed |
|-----------------|---------------|
| Fixing CDN URLs | Files downloaded successfully, but `load()` still hung |
| Adding timeouts | The hang is in WASM compilation, not a timeout issue |
| Changing CDN order | All CDNs work fine; the issue is Vite's pre-bundling |
| Passing AbortSignal | The `load()` method doesn't support abort during WASM init |

The `optimizeDeps.exclude` fix addresses the actual root cause: Vite's incorrect pre-bundling of FFmpeg modules.
