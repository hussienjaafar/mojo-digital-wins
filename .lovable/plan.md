
# Debugging & Optimizing FFmpeg.wasm Audio Extraction Performance

## Problem Analysis

Based on code review and research, the slow audio extraction is caused by multiple factors:

### Root Causes Identified

| Issue | Impact | Current Code |
|-------|--------|--------------|
| **Re-encoding audio** | Very slow - CPU-intensive transcoding | Uses `-acodec libmp3lame` which re-encodes |
| **Single-threaded mode** | 3-10x slower than multi-threaded | No SharedArrayBuffer (requires COOP/COEP headers) |
| **Large WASM download** | ~30MB download on first use | Loading from unpkg CDN |
| **Full file buffering** | Memory pressure for large files | `fetchFile()` loads entire video into memory |
| **High quality settings** | Slower encoding | `-q:a 2` is VBR ~190kbps |

### Current FFmpeg Command (Slow)
```
ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 -ar 44100 -ac 1 output.mp3
```
This **re-encodes** audio using LAME MP3 encoder, which is CPU-intensive in WebAssembly.

## Optimization Strategy

### 1. Use Copy Codec When Possible (Fastest)

If the source video has AAC audio (most MP4s do), we can **copy it directly** without re-encoding:

```
ffmpeg -i input.mp4 -vn -acodec copy output.m4a
```

This is **nearly instant** because it just extracts the audio stream without any processing.

**Trade-off**: Output format matches source (usually AAC/M4A), not MP3. Whisper supports both.

### 2. Detect Audio Codec First

Before extraction, probe the video to determine if copy is possible:

```
ffmpeg -i input.mp4  (parse output for audio codec info)
```

If audio is AAC → use copy codec (instant)
If audio is something else → fall back to re-encode

### 3. Optimize Re-encoding Settings (When Needed)

If re-encoding is necessary, use faster settings:

| Setting | Current | Optimized | Impact |
|---------|---------|-----------|--------|
| Quality | `-q:a 2` (VBR ~190kbps) | `-b:a 64k` (CBR 64kbps) | 3x faster, fine for speech |
| Sample rate | 44100 Hz | 16000 Hz | 2x faster, ideal for Whisper |
| Channels | Mono (good) | Mono | Keep as-is |

Optimized command for speech:
```
ffmpeg -i input.mp4 -vn -acodec libmp3lame -b:a 64k -ar 16000 -ac 1 output.mp3
```

### 4. Enable Multi-Threading (Requires Server Config)

FFmpeg.wasm can use multi-threading with SharedArrayBuffer, but requires specific HTTP headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

This provides **3-5x speedup** but requires Lovable platform support.

### 5. Add Progress Visibility & Timing

Add detailed timing logs to understand where time is spent:
- WASM loading time
- File writing time
- Extraction/encoding time
- File reading time

## Implementation Plan

### Step 1: Add Codec Detection & Copy Mode

Update `src/lib/audio-extractor.ts`:

1. Add a `probeVideo()` function to detect audio codec
2. If audio is AAC/MP3 → use `-acodec copy` for instant extraction
3. Output as `.m4a` (for AAC) or `.mp3` (for MP3 source)
4. Fall back to re-encode only when necessary

### Step 2: Optimize Re-encoding Settings for Speech

When re-encoding is needed:
- Lower bitrate: 64kbps (sufficient for speech transcription)
- Lower sample rate: 16kHz (Whisper's native rate)
- Use CBR instead of VBR (faster encoding)

### Step 3: Add Performance Timing

Add detailed timing to identify bottlenecks:
```typescript
console.time('[FFmpeg] WASM Load');
console.time('[FFmpeg] Write Input');
console.time('[FFmpeg] Extract');
console.time('[FFmpeg] Read Output');
```

### Step 4: Preload FFmpeg WASM

Add option to preload FFmpeg during idle time so it's ready when needed:
- Trigger preload when user navigates to Ad Copy Studio
- Cache the loaded instance

### Step 5: Update Storage & Database

- Support both `.mp3` and `.m4a` audio files
- Update content type detection

## Expected Performance Improvements

| Scenario | Current Time | After Optimization |
|----------|--------------|-------------------|
| AAC audio in MP4 (copy mode) | 30-60 seconds | 2-5 seconds |
| Non-AAC audio (optimized re-encode) | 30-60 seconds | 10-20 seconds |
| WASM preloaded | N/A | Saves 5-15 seconds |

## File Changes Summary

| File | Change |
|------|--------|
| `src/lib/audio-extractor.ts` | Add codec detection, copy mode, optimized encoding settings, timing logs |
| `src/hooks/useVideoUpload.ts` | Handle .m4a output, trigger FFmpeg preload |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Add preload trigger on component mount |

## Technical Details

### Codec Detection Approach

FFmpeg outputs codec info to stderr when probing. We'll parse this:
```
Stream #0:1: Audio: aac (LC), 48000 Hz, stereo
```

### Whisper Compatibility

OpenAI Whisper supports: mp3, mp4, mpeg, mpga, m4a, wav, webm

Both MP3 and M4A are fully supported, so using copy mode with M4A output is safe.

### Browser Compatibility

Copy codec mode works in all browsers since it doesn't require heavy CPU processing. The optimization benefits all users regardless of device speed.
