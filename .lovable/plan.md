

## Fix: Correct cdnjs URL Path for FFmpeg Core

### Problem
The cdnjs URL is returning 404 because the wrong library name is used in the path:
- **Current (wrong):** `cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.12.6/esm`
- **Correct:** `cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/esm`

The package on cdnjs is called `ffmpeg-core`, not `ffmpeg`.

### Solution
Fix the CDN path in `src/lib/audio-extractor.ts`:

```typescript
const CDN_SOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/esm',  // Fixed: ffmpeg → ffmpeg-core
  'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
];
```

### File to Change

| File | Change |
|------|--------|
| `src/lib/audio-extractor.ts` | Line 103: Change `ffmpeg` to `ffmpeg-core` |

### Expected Result
After this one-character fix, the cdnjs CDN will load successfully and your 162MB video upload should proceed through audio extraction.

