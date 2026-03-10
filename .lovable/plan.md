

# Add "Download Full Results" Button to Poll Detail Pages

## Overview

Copy the uploaded documents (DOCX for VA-6, PPTX for IL-09) into the `public/` directory and add a `downloadUrl` field to the poll data model. Then add a prominent "Download Full Results" button at the top of the poll detail page, right below the header metadata.

## Changes

### 1. Copy uploaded files to `public/downloads/`
- `user-uploads://VA-6_Memo-2.docx` → `public/downloads/VA-6_Memo-2.docx`
- `user-uploads://IL09_Poll_Presentation-2.pptx` → `public/downloads/IL09_Poll_Presentation-2.pptx`

Using `public/` so they're served as static files at known URLs.

### 2. Add `downloadUrl` to `PollData` type (`src/data/polls/index.ts`)
Add an optional `downloadUrl?: string` field to the `PollData` interface.

### 3. Set download URLs in poll data files
- `src/data/polls/va6-2026.ts`: Add `downloadUrl: "/downloads/VA-6_Memo-2.docx"`
- `src/data/polls/il9-2026.ts`: Add `downloadUrl: "/downloads/IL09_Poll_Presentation-2.pptx"`

### 4. Add download button to `src/pages/PollDetail.tsx`
Insert a "Download Full Results" button inside the header section, after the sponsor line (~line 301). It will be an `<a>` tag styled as a button with `download` attribute, using the `Download` icon from lucide-react. Only rendered when `poll.downloadUrl` exists.

```text
[← All Polls]
[Date | Sample | MOE]
VA-6 Congressional District Poll.
Sponsored by Unity & Justice Fund

[⬇ Download Full Results]     ← new button here
```

| File | Change |
|------|--------|
| `public/downloads/VA-6_Memo-2.docx` | New file (copied from upload) |
| `public/downloads/IL09_Poll_Presentation-2.pptx` | New file (copied from upload) |
| `src/data/polls/index.ts` | Add `downloadUrl?` to `PollData` interface |
| `src/data/polls/va6-2026.ts` | Add `downloadUrl` field |
| `src/data/polls/il9-2026.ts` | Add `downloadUrl` field |
| `src/pages/PollDetail.tsx` | Add download button in header section |

