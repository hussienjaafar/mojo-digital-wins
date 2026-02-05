
# Client-Side Audio Extraction with FFmpeg.wasm

## Overview

This plan implements browser-based audio extraction from video files before upload, reducing a 200MB video to a ~10-20MB audio file. This bypasses the 150MB Edge Function memory limit and fits within the Whisper API's 25MB limit.

## Problem Solved

| Current Issue | With FFmpeg.wasm |
|--------------|------------------|
| 50MB Edge Function limit for Google Drive imports | Extract audio locally, upload only audio |
| 200MB+ videos exhaust server memory | Processing happens in user's browser |
| Large videos exceed Whisper's 25MB limit | Audio-only files are 10-20x smaller |

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│  ┌─────────────┐     ┌──────────────┐     ┌───────────────────┐    │
│  │ Video File  │ ──▶ │ FFmpeg.wasm  │ ──▶ │ Audio File (MP3)  │    │
│  │ (200MB MP4) │     │ (Client-side)│     │ (~15MB)           │    │
│  └─────────────┘     └──────────────┘     └───────────────────┘    │
│                                                    │               │
│                                                    ▼               │
│                              ┌───────────────────────────────────┐ │
│                              │ Upload to Supabase Storage        │ │
│                              │ (Standard upload, no Edge limits) │ │
│                              └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌───────────────────────────────────────────────┐
                     │              WHISPER API                       │
                     │  Transcribes audio (already within 25MB limit) │
                     └───────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Install FFmpeg.wasm Dependencies

Add the required packages:
- `@ffmpeg/ffmpeg` - Core FFmpeg functionality
- `@ffmpeg/util` - Helper utilities for file handling

### Step 2: Create Audio Extraction Utility

**New file: `src/lib/audio-extractor.ts`**

This utility will:
- Load FFmpeg.wasm on first use (~30MB download, cached by browser)
- Accept video File or Blob input
- Extract audio track using FFmpeg's `-vn` (no video) flag
- Output as MP3 (optimal size/quality balance for speech)
- Report progress during extraction
- Handle errors gracefully with user-friendly messages

Key FFmpeg command:
```
ffmpeg -i input.mp4 -vn -acodec libmp3lame -q:a 2 output.mp3
```

Options breakdown:
- `-i input.mp4` - Input video file
- `-vn` - No video (audio only)
- `-acodec libmp3lame` - Use LAME MP3 encoder
- `-q:a 2` - High quality audio (VBR ~190kbps, good for speech)

### Step 3: Update Video Upload Hook

**Modify: `src/hooks/useVideoUpload.ts`**

Changes:
1. Add a new processing step after file selection: "Extracting audio..."
2. For files over 25MB, extract audio before upload
3. Upload the extracted audio file instead of the full video
4. Store both the audio file (for transcription) and original video metadata
5. Update progress tracking to show extraction progress

New flow:
```text
File Selected → Validate → Extract Audio (if >25MB) → Upload Audio → Create DB Record
```

### Step 4: Update Video Upload Step UI

**Modify: `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`**

Changes:
1. Add new status: `'extracting'` with appropriate label ("Extracting audio...")
2. Show extraction progress (FFmpeg reports progress via events)
3. Add tooltip explaining that audio is extracted locally for large files
4. Update the "Processing" states to handle extraction step

### Step 5: Update Type Definitions

**Modify: `src/types/ad-copy-studio.ts`**

Add new status value:
```typescript
status: 'pending' | 'uploading' | 'extracting' | 'transcribing' | 'analyzing' | 'ready' | 'error';
```

### Step 6: Improve Google Drive Large File Handling

**Modify: `supabase/functions/import-gdrive-video/index.ts`**

For files that exceed the 50MB Edge Function limit:
1. Return a specific error code: `FILE_TOO_LARGE_FOR_GDRIVE`
2. Include a user-friendly message explaining that:
   - The file is too large for automated import
   - They should download it from Google Drive
   - Use the direct upload feature (which will extract audio locally)

---

## Technical Details

### FFmpeg.wasm Loading Strategy

The FFmpeg core is ~30MB and will be loaded from a CDN on first use:
- Uses SharedArrayBuffer if available (faster, multi-threaded)
- Falls back to single-threaded mode if needed
- Cached by browser's service worker after first load

### Memory Considerations

FFmpeg.wasm processes files in a virtual filesystem:
- For very large files (>500MB), may need to use streaming
- Will add a warning for files approaching browser memory limits
- Target extraction time: ~30 seconds for a typical 2-minute campaign video

### Browser Compatibility

FFmpeg.wasm works in:
- Chrome 79+ (full support)
- Firefox 76+ (full support)
- Safari 14.1+ (single-threaded only)
- Edge 79+ (full support)

### File Size Expectations

| Video File | Duration | Audio Output (MP3 192kbps) |
|-----------|----------|---------------------------|
| 50MB      | ~1 min   | ~1.5MB                    |
| 100MB     | ~2 min   | ~3MB                      |
| 200MB     | ~4 min   | ~6MB                      |
| 500MB     | ~10 min  | ~15MB                     |

All outputs well within Whisper's 25MB limit.

---

## Summary of File Changes

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Add dependencies | @ffmpeg/ffmpeg, @ffmpeg/util |
| `src/lib/audio-extractor.ts` | Create new | FFmpeg.wasm utility for audio extraction |
| `src/hooks/useVideoUpload.ts` | Modify | Integrate audio extraction before upload |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Modify | Add "extracting" status, progress UI |
| `src/types/ad-copy-studio.ts` | Modify | Add 'extracting' status type |
| `supabase/functions/import-gdrive-video/index.ts` | Modify | Better error message for large GDrive files |

## Benefits

- **500MB+ video support**: No more Edge Function memory limits
- **Faster uploads**: Audio files are 10-20x smaller than videos
- **Whisper compatibility**: All files fit within 25MB limit
- **No server costs**: Processing happens in user's browser
- **Privacy**: Video content never touches your servers (only audio)
- **Better UX**: Clear progress feedback during extraction

