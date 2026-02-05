
# Fix Audio Extraction Loading State Issue

## Problem Summary

The audio extraction feature gets stuck in a permanent loading state when users upload large video files. The root cause is known issues with FFmpeg.wasm 0.12.x.

## Root Causes Identified

| Issue | Impact | Evidence |
|-------|--------|----------|
| WORKERFS mount fails | Silent failure, falls back to slow path | GitHub issue #757 - "ErrnoError: FS error" |
| writeFile stalls on large files | Infinite hang during "Preparing file..." | StackOverflow reports of writeFile never completing |
| No timeout mechanism | Users stuck with spinning loader forever | Code review shows no timeout/abort logic |
| Single-threaded FFmpeg | 3-5x slower processing | No COOP/COEP headers, no SharedArrayBuffer |

## Solution Strategy

Since WORKERFS mounting is unreliable in FFmpeg.wasm 0.12.x, we need to:

1. **Remove WORKERFS entirely** - Go back to writeFile but with safeguards
2. **Add timeout protection** - Abort extraction if it takes too long
3. **Use chunked reading** - Read file in chunks to show progress and reduce memory pressure
4. **Add a fallback option** - Let users skip extraction and upload the full video (for small files)
5. **Better error recovery** - Show clear error messages with retry/skip options

## Implementation Plan

### File 1: `src/lib/audio-extractor.ts`

**Changes:**

1. **Remove WORKERFS mount attempt entirely**
   - Delete the `mountOrWriteFile` function
   - Use `fetchFile` + `writeFile` directly with progress simulation

2. **Add extraction timeout**
   - Set a maximum extraction time (e.g., 5 minutes for re-encoding)
   - Abort FFmpeg execution if timeout exceeded

3. **Add chunked file reading with progress**
   - Use FileReader to read file in chunks
   - Report progress during the "Preparing file" stage

4. **Improve error messages**
   - Distinguish between timeout, memory, and codec errors
   - Provide actionable suggestions

### File 2: `src/hooks/useVideoUpload.ts`

**Changes:**

1. **Add extraction timeout handling**
   - Wrap extraction call with timeout promise
   - On timeout, set clear error message

2. **Add skip extraction option**
   - For files 25-50MB, allow direct upload as fallback
   - Update UI state to reflect this option

3. **Improve error recovery**
   - Allow retry with different settings
   - Allow skipping extraction for borderline files

### File 3: `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`

**Changes:**

1. **Add timeout warning**
   - After 30 seconds, show "This is taking longer than expected"
   - Offer "Cancel" and "Keep waiting" options

2. **Add extraction error actions**
   - "Retry extraction" button
   - "Upload original file instead" button (for 25-50MB files)

3. **Improve progress visibility**
   - Show file reading progress separately from FFmpeg processing
   - Display estimated time based on file size

## Technical Details

### Timeout Implementation

```typescript
const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function extractAudioWithTimeout(file: File, options: AudioExtractorOptions) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('EXTRACTION_TIMEOUT')), EXTRACTION_TIMEOUT_MS);
  });
  
  return Promise.race([
    extractAudio(file, options),
    timeoutPromise
  ]);
}
```

### Chunked File Reading

```typescript
async function readFileWithProgress(
  file: File, 
  onProgress: (percent: number) => void
): Promise<Uint8Array> {
  const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
  const chunks: Uint8Array[] = [];
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();
    chunks.push(new Uint8Array(buffer));
    offset += CHUNK_SIZE;
    onProgress(Math.min(100, (offset / file.size) * 100));
  }
  
  // Combine chunks
  const combined = new Uint8Array(file.size);
  let position = 0;
  for (const chunk of chunks) {
    combined.set(chunk, position);
    position += chunk.length;
  }
  return combined;
}
```

### UI Timeout Warning

After 30 seconds in extraction state, show:
- "Extraction is taking longer than expected"
- "For large videos, this can take several minutes"
- Cancel button to abort and try again

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Chunked reading still slow | Show clear progress so users know it's working |
| Memory issues persist | Add 100MB soft limit with warning |
| Timeout too aggressive | Allow "Keep waiting" option |
| Users confused by options | Clear explanatory text in UI |

## Expected Outcome

After these changes:
- Users will see clear progress during file preparation
- Extraction that hangs will timeout with actionable options
- Users can choose to upload original file if extraction fails
- Error messages will explain what went wrong and what to do

## Files to Modify

| File | Change Type |
|------|-------------|
| `src/lib/audio-extractor.ts` | Remove WORKERFS, add timeout, chunked reading |
| `src/hooks/useVideoUpload.ts` | Add timeout wrapper, skip option |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Add timeout UI, error actions |
