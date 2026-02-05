
Goal
- Make “Cancel transcription” work reliably for an already-running transcription (even after refresh), and ensure the UI stops showing “Transcribing” when the backend record has been cancelled/errored.
- Keep your approved product behavior:
  - Cancel behavior: Cancel + mark cancelled
  - Retry logic: Manual retry only
  - Stuck threshold: 1 minute

What’s actually happening (root causes found in code)
1) The UI can render videos from saved wizard session data (stepData.videos), not from the database table that stores transcription status.
- AdCopyWizard uses: currentVideos = videos.length > 0 ? videos : (stepData.videos || [])
- After a refresh, useVideoUpload’s internal “videos” state is empty (it does not load existing videos), so AdCopyWizard falls back to stepData.videos.
- stepData.videos contains the old status (e.g. “transcribing”) and is not automatically synced with the backend status changes you made.

2) Cancel/Retry actions currently depend on useVideoUpload’s internal “videos” state.
- cancelVideo(id) and retryTranscription(id) look up the video by local id inside the hook’s videos array.
- When the page is refreshed and the UI is showing stepData.videos, the hook’s videos array is empty → cancelVideo can’t find the record to cancel in the database.
- Result: cancel does nothing (or only removes from hook state), and the UI still shows “Transcribing”.

3) The “stuck after 1 minute” logic only works when extractionStartTime exists.
- VideoUploadStep considers a video “stuck” only if:
  - status === 'transcribing'
  - video.extractionStartTime exists
- For many uploads (no audio extraction needed), extractionStartTime is never set, so “stuck UI” and the Cancel button never appear.

4) Lowercase 'error' status is not treated as a failure by the polling hook.
- useVideoTranscriptionFlow includes 'error' in TERMINAL_STATUSES, but only triggers onError for 'ERROR'/'FAILED'/'TRANSCRIPT_FAILED' (not 'error').
- That means a backend row set to status='error' can return as terminal without invoking onError → local status never flips to “error”, and the wizard can keep re-queueing processing depending on state source.

Plan (implementation changes)
A) Make backend cancellation explicit and durable (“CANCELLED” status)
Why: “error” is overloaded and can be overwritten by the running backend job; a dedicated CANCELLED status is clearer and lets the backend function stop early.

1) Database migration
- Update the meta_ad_videos status constraint (meta_ad_videos_status_check) to allow 'CANCELLED'.
- Ensure existing statuses remain valid.
- Optionally standardize case (prefer all-caps statuses) but we can keep compatibility.

2) Backend function respects cancellation
- In supabase/functions/transcribe-meta-ad-video/index.ts:
  - Before each expensive stage and before each status update, re-check the current row status from meta_ad_videos by primary key (video.id).
  - If status === 'CANCELLED', stop processing immediately and do not overwrite status.
  - This makes “cancel existing transcription” effective even if the job is mid-run.

3) Frontend cancel writes CANCELLED
- Update cancel flow to:
  - Update meta_ad_videos.status = 'CANCELLED'
  - Set error_message = 'Cancelled by user' (optional)
  - Optionally set error_code = 'CANCELLED_BY_USER' (helps debugging)

B) Hydrate useVideoUpload state from saved wizard session videos
Why: After refresh, the UI currently runs off stepData.videos; actions and status updates then don’t work because the upload hook has no knowledge of these videos.

1) Extend useVideoUpload options
- Add: initialVideos?: VideoUpload[]
- Add a “hydrate once” effect:
  - If hook videos[] is empty and initialVideos has items:
    - setVideos(initialVideos), forcing file = null (since you can’t restore File objects anyway).
  - This ensures the wizard always uses the hook’s videos state (so cancel/retry/updateVideoStatus works).

2) Update AdCopyWizard to pass initialVideos
- Pass stepData.videos as initialVideos into useVideoUpload.
- Once hydrated, AdCopyWizard will prefer hook videos and won’t display stale stepData-only state.

C) Sync UI status with backend status on load (and after cancel/retry)
Why: stepData can still be stale, and the backend status is the true source of truth for “in progress vs cancelled vs failed”.

1) Add a status sync effect in AdCopyWizard
- When session/stepData.videos are available (and/or after hydration):
  - Collect all videoDbIds (VideoUpload.video_id field, which is meta_ad_videos.id).
  - Query meta_ad_videos for those ids: select id, status, error_message, updated_at
  - Map backend status → UI status:
    - CANCELLED => 'error' (UI) with message “Cancelled by user” (or display Cancelled label if you want a separate UI status later)
    - ERROR / FAILED / TRANSCRIPT_FAILED => 'error'
    - TRANSCRIBED / ANALYZED / COMPLETED => 'ready' (or 'analyzing' if you want a two-stage UI; but since analysis is produced in the same function, 'ready' is usually correct)
    - PENDING / URL_FETCHED / DOWNLOADED => 'transcribing'
  - Update hook videos state accordingly (via updateVideoStatus + a new helper if needed to also update error_message/progress)
  - Persist a corrected videos array into stepData via updateStepData({ videos: correctedVideos }) but only when there are actual differences (to avoid extra writes).

D) Fix “stuck after 1 minute” detection so Cancel actually appears
Why: today it depends on extractionStartTime which is missing for typical uploads.

1) Introduce a dedicated start timestamp for transcription
Option 1 (minimal churn): reuse extractionStartTime as a generic “processingStartTime”
- When status transitions to 'transcribing' (both normal uploads and retry):
  - set extractionStartTime = Date.now()
- Update VideoUploadStep stuck logic to use this timestamp for transcribing even if extraction wasn’t used.

Option 2 (cleaner): add transcriptionStartTime to VideoUpload type
- Add transcriptionStartTime?: number
- Use that for stuck detection and elapsed time display.
- Keep extractionStartTime strictly for extraction stage.

We’ll prefer Option 2 if you want clarity, but Option 1 is faster to ship.

2) Ensure stuck UI triggers on refreshed sessions too
- When hydrating from stepData:
  - If a video is in 'transcribing' and has no start timestamp, set a reasonable start timestamp:
    - Use backend updated_at if available (parse to ms) or set to Date.now() so Cancel can appear after 1 minute.

E) Make Cancel accessible even while processing (not only after stuck threshold)
You approved “show stuck UI after 1 minute”, but you also need a way to cancel an already-running transcription immediately.
- Adjust the right-side trash button behavior while isProcessing:
  - Instead of disabling it, swap it into a “Cancel” (XCircle) action when status is transcribing/analyzing/extracting.
  - This triggers onCancelVideo(video.id) and performs the durable CANCELLED update.
- Keep the “Taking longer than expected” message gated at 1 minute as requested.

F) Polling hook correctness for terminal statuses
- Update useVideoTranscriptionFlow:
  - Add 'CANCELLED' to TERMINAL_STATUSES
  - Treat CANCELLED as a failure terminal state and call onError with a cancel-specific message (or a dedicated onCancel callback if you want)
  - Also treat lowercase 'error' as failure if it can still appear (backward compat), so UI doesn’t get stuck in an “in progress” loop.

G) Make cancel/retry persist to session stepData
- When cancel or retry is performed:
  - Update the corresponding VideoUpload entry in stepData.videos (status + error_message + start timestamp).
  - This ensures refresh shows the correct state even before the status sync effect runs.

Files to change (frontend)
- src/hooks/useVideoUpload.ts
  - Add initialVideos option + hydration effect
  - Ensure cancel/retry work on hydrated videos
  - Update cancel to write status=CANCELLED (after DB migration)
  - Set transcription start timestamp when entering transcribing
- src/components/ad-copy-studio/AdCopyWizard.tsx
  - Pass initialVideos
  - Add “sync statuses from backend” effect
  - Ensure cancel/retry updates stepData.videos too
- src/components/ad-copy-studio/steps/VideoUploadStep.tsx
  - Fix stuck detection to not depend on extraction-only timestamps
  - Replace disabled trash during processing with Cancel action (immediate)
  - Keep stuck warning at 1 minute

Files to change (backend)
- supabase/functions/transcribe-meta-ad-video/index.ts
  - Add “cancellation check” before each step and before writing status updates

Database migration
- Update meta_ad_videos_status_check constraint to include 'CANCELLED'

Testing checklist (end-to-end)
1) Upload a video (no audio extraction) → confirm:
- Cancel is available immediately while “Transcribing”
- “Taking longer than expected” appears after 1 minute
2) Click Cancel while it’s running → confirm:
- UI changes to cancelled/error state immediately
- Backend record status becomes CANCELLED
- Transcription function does not overwrite CANCELLED later
3) Refresh after cancelling → confirm:
- UI still shows cancelled/error (not “Transcribing”)
4) Click Retry → confirm:
- Backend status resets appropriately
- UI returns to Transcribing and polling resumes
5) Force a failure (or use a known failing file) → confirm:
- UI transitions to error, no infinite re-polling loop, Retry appears

Expected outcome
- “Cancel existing transcription” works even after refresh because the wizard hydrates its local state from the saved session and then syncs the authoritative backend status.
- The backend respects cancellation and won’t continue to update the row after you cancel.
- The UI always has an actionable cancel path (immediate cancel), and it still surfaces “stuck” messaging after 1 minute as requested.
