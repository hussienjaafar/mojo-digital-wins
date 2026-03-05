

# Rename VA-6 Download File

Rename the physical file and update the reference so the downloaded file is named `VA6_Poll_Results.docx` instead of `VA-6_Memo-2.docx`.

## Changes

| File | Change |
|------|--------|
| `public/downloads/VA-6_Memo-2.docx` | Rename to `public/downloads/VA6_Poll_Results.docx` |
| `src/data/polls/va6-2026.ts` (line 14) | Update `downloadUrl` from `"/downloads/VA-6_Memo-2.docx"` to `"/downloads/VA6_Poll_Results.docx"` |

