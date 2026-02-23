

# View Full Message in Contact Submissions

## Problem
The message column in the Contact Submissions table truncates long messages with `truncate max-w-[200px]`, making it impossible to read the full content (e.g., "We are running a progressiv..." gets cut off).

## Solution
Add a click-to-view dialog that shows the full message along with submission details when clicking on a row in the table.

## Changes

**File: `src/pages/admin/ContactSubmissions.tsx`**

1. Add a new state variable `showMessageDialog` (boolean) to control a "Submission Details" dialog
2. Add an `onRowClick` handler to the V3DataTable that sets `selectedSubmission` and opens the dialog
3. Add a new Dialog component that displays:
   - Contact name and email
   - Full message text (no truncation, with proper word wrapping)
   - Status and priority badges
   - Submission date
   - A "View Notes" button to jump to the notes dialog

This is a single-file change -- no new files or database changes needed.

