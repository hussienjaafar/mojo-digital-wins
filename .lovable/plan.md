

# Fix: Duplicate Transcripts From Parallel FFmpeg Processing

## Root Cause

The audio extraction uses a **shared singleton FFmpeg instance** with **hardcoded filenames** in its virtual filesystem:
- Input: `input_video.mp4`
- Output: `output_audio.m4a`

When two videos are processed in parallel (via the `Promise.allSettled` change), they both write to the same virtual filesystem paths. The second video overwrites the first video's data, causing both extractions to produce the same audio -- and therefore the same transcript.

## Fix

Add a **processing lock** (mutex) to the `extractAudio` function so that only one extraction runs at a time. This is the safest approach because:
- FFmpeg.wasm's virtual filesystem is shared across calls
- Creating multiple FFmpeg instances is memory-prohibitive (each loads ~30MB WASM)
- Unique filenames alone aren't sufficient because FFmpeg.wasm may have other shared state

The parallel `Promise.allSettled` remains in place for the overall flow (upload, DB insert, transcription trigger), but audio extraction specifically will be serialized.

## Implementation

### File: `src/lib/audio-extractor.ts`

Add a simple async mutex (promise chain) at the module level:

```
let extractionQueue: Promise<void> = Promise.resolve();

export async function extractAudio(videoFile, options) {
  // Queue this extraction behind any in-progress one
  const result = await new Promise((resolve, reject) => {
    extractionQueue = extractionQueue.then(async () => {
      try {
        const r = await extractAudioInternal(videoFile, options);
        resolve(r);
      } catch (e) {
        reject(e);
      }
    });
  });
  return result;
}

// Rename current extractAudio to extractAudioInternal (no other changes)
async function extractAudioInternal(videoFile, options) {
  // ... existing extraction logic unchanged ...
}
```

This ensures:
- Video 1 extracts audio, completes, cleans up virtual FS
- Video 2 then extracts audio with clean virtual FS
- Both videos still upload and trigger transcription in parallel (only the FFmpeg step is serialized)
- No risk of filename collisions or shared state corruption

### No other files need changes

The `useVideoUpload.ts` parallel processing stays as-is. The serialization is scoped to just the FFmpeg extraction step, which is the only part that can't safely run concurrently.

