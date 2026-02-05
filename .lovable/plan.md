
# COMPLETED: Fix Transcription File Extension Issue

## Summary
Fixed the transcription failure caused by sending `.m4a` files to Whisper API with incorrect `.mp4` extension.

## Changes Made

### `supabase/functions/transcribe-meta-ad-video/index.ts`

1. **Added `getFilenameFromUrl()` helper** - Extracts correct filename with valid Whisper extension from source URL
2. **Renamed `downloadVideo()` to `downloadMedia()`** - Now returns `{ blob, filename }` tuple
3. **Updated `transcribeWithWhisper()`** - Added `filename` parameter, uses correct extension in FormData
4. **Updated main processing loop** - Destructures `{ blob, filename }` and passes filename to Whisper

## Result
- `.m4a` audio files now sent with correct extension
- Whisper correctly detects audio format
- Transcription should complete successfully

## Testing
Retry the transcription to verify the fix works.
