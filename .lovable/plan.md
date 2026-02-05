

## Fix: Add `audio/mp4` MIME Type to Storage Bucket

### Problem
The FFmpeg audio extraction is now working correctly. The extracted `.m4a` audio file has MIME type `audio/mp4`, but the `meta-ad-audio` storage bucket only allows: `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/webm`, `audio/ogg`.

This causes the upload to fail with:
```
StorageApiError: mime type audio/mp4 is not supported
```

### Solution
Add `audio/mp4` (and `audio/aac` for compatibility) to the allowed MIME types for the `meta-ad-audio` bucket.

### Database Migration Required

```sql
-- Update the meta-ad-audio bucket to allow audio/mp4 (M4A) and audio/aac formats
UPDATE storage.buckets 
SET allowed_mime_types = ARRAY[
  'audio/mpeg',    -- MP3
  'audio/mp3',     -- MP3 (alternative)
  'audio/wav',     -- WAV
  'audio/webm',    -- WebM
  'audio/ogg',     -- OGG
  'audio/mp4',     -- M4A (AAC in MP4 container) - NEW
  'audio/aac',     -- Raw AAC - NEW
  'audio/x-m4a'    -- M4A (alternative MIME) - NEW
]
WHERE id = 'meta-ad-audio';
```

### Why This Approach

| Approach | Pros | Cons |
|----------|------|------|
| **Add MIME types (chosen)** | Fast extraction via copy mode, no re-encoding needed | Minor bucket config change |
| Force re-encode to MP3 | No bucket changes | Slower (10x), larger files, unnecessary quality loss |

The copy mode extraction completed in under 1 second for a 154MB video - forcing re-encode would take 30+ seconds.

### Files to Change
- **Database migration** - Update `meta-ad-audio` bucket allowed MIME types

No code changes needed - the extraction logic is already correct.

### Expected Result After Fix
1. User uploads video (154MB)
2. FFmpeg extracts audio in copy mode (~1 second)
3. Outputs `.m4a` file with `audio/mp4` MIME type
4. Upload to storage succeeds
5. Transcription process continues

