
# Fix: Transcription Fails Due to Incorrect File Extension Sent to Whisper API

## Problem Identified

The transcription is failing with this error from OpenAI Whisper:
```
Invalid file format. Supported formats: ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']
```

**Root Cause:** The edge function `transcribe-meta-ad-video/index.ts` hardcodes the filename as `video.mp4` when sending to Whisper:

```typescript
// Line 108 - Current code (broken)
formData.append('file', videoBlob, 'video.mp4');
```

The actual file is an `.m4a` audio file (extracted by client-side FFmpeg), but Whisper receives it with a `.mp4` extension. This causes a format detection mismatch.

## Solution

Update the edge function to:
1. Extract the correct file extension from the source URL
2. Pass the proper filename (with correct extension) to the Whisper API
3. Ensure the Blob has the correct MIME type

## Technical Changes

### File: `supabase/functions/transcribe-meta-ad-video/index.ts`

**1. Add helper function to extract filename from URL:**

```typescript
function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'audio.m4a';
    // Ensure we have a valid audio/video extension
    const validExtensions = ['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'];
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext && validExtensions.includes(ext)) {
      return filename;
    }
    // Default to m4a if extension is unrecognized
    return 'audio.m4a';
  } catch {
    return 'audio.m4a';
  }
}
```

**2. Update `downloadVideo` to also return the detected filename:**

```typescript
async function downloadMedia(sourceUrl: string): Promise<{ blob: Blob; filename: string } | null> {
  try {
    console.log(`[TRANSCRIBE] Downloading from: ${sourceUrl.substring(0, 80)}...`);
    const response = await fetch(sourceUrl);

    if (!response.ok) {
      console.error(`[TRANSCRIBE] Download failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const blob = await response.blob();
    const filename = getFilenameFromUrl(sourceUrl);
    console.log(`[TRANSCRIBE] Downloaded ${(blob.size / 1024 / 1024).toFixed(2)} MB as ${filename}`);
    return { blob, filename };
  } catch (err) {
    console.error(`[TRANSCRIBE] Download error:`, err);
    return null;
  }
}
```

**3. Update `transcribeWithWhisper` to accept filename:**

```typescript
async function transcribeWithWhisper(
  mediaBlob: Blob,
  filename: string,  // New parameter
  openaiApiKey: string
): Promise<TranscriptionResult | null> {
  try {
    console.log(`[TRANSCRIBE] Calling Whisper API with file: ${filename}...`);

    const formData = new FormData();
    formData.append('file', mediaBlob, filename);  // Use actual filename
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');
    formData.append('timestamp_granularities[]', 'segment');

    // ... rest unchanged
  }
}
```

**4. Update the main processing loop:**

```typescript
// Download media
const mediaResult = await downloadMedia(video.video_source_url);
if (!mediaResult) {
  // ... error handling unchanged
}

const { blob: mediaBlob, filename } = mediaResult;

// ... cancellation check ...

// Transcribe with correct filename
const transcription = await transcribeWithWhisper(mediaBlob, filename, openaiApiKey);
```

## Summary of Changes

| Location | Change |
|----------|--------|
| Line ~78 | Rename `downloadVideo` to `downloadMedia`, return `{ blob, filename }` |
| Line ~100 | Add `filename` parameter to `transcribeWithWhisper` |
| Line ~108 | Use `filename` instead of hardcoded `'video.mp4'` |
| Main loop | Destructure `{ blob, filename }` from download result |

## Expected Outcome

After this fix:
1. `.m4a` files will be sent to Whisper as `filename.m4a`
2. `.mp3` files will be sent as `filename.mp3`
3. Actual video `.mp4` files will still work correctly
4. Whisper will correctly detect the audio format and transcribe successfully

## Testing

After implementing, retry the cancelled transcription:
1. Reset the video status to `PENDING` 
2. Re-invoke the transcription
3. Verify the logs show the correct filename being sent
4. Confirm transcript is created successfully
