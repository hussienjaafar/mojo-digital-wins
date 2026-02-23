

# Manage Contact Form Notification Recipients from Admin UI

## Problem
Currently, contact form notification emails are sent to addresses stored in the `CONTACT_FORM_RECIPIENTS` environment variable -- which can only be changed by editing secrets. There's no way to manage recipients from the admin interface.

## Solution
Store notification recipients in a new database table and provide a settings section on the Contact Submissions page where admins can add/remove email addresses. The edge function will read from the database instead of (or in addition to) the environment variable.

## Database Changes

**New table: `contact_notification_recipients`**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | Default `gen_random_uuid()` |
| email | varchar NOT NULL | Recipient email address |
| added_by | uuid FK auth.users | Who added this recipient |
| is_active | boolean | Default `true`, allows disabling without deleting |
| created_at | timestamptz | Default `now()` |
| UNIQUE(email) | | Prevent duplicate emails |

**RLS**: Only system admins can SELECT/INSERT/UPDATE/DELETE (using the existing `is_system_admin()` function).

## UI Changes

**File: `src/pages/admin/ContactSubmissions.tsx`**

Add a "Notification Recipients" section (collapsible or as a settings icon/drawer) near the top of the page:
- Shows a list of current recipient emails with an active/inactive toggle and a remove button
- An input field + "Add" button to add new email addresses (with email format validation)
- Visual feedback via toast on add/remove

## Edge Function Changes

**File: `supabase/functions/send-contact-notification/index.ts`**

Update to query `contact_notification_recipients` (where `is_active = true`) for the recipient list. Falls back to `CONTACT_FORM_RECIPIENTS` env var if the table is empty, ensuring backward compatibility.

## Files to Create/Modify

| File | Action |
|------|--------|
| Database migration | Create `contact_notification_recipients` table with RLS |
| `src/pages/admin/ContactSubmissions.tsx` | Add notification recipients management UI section |
| `supabase/functions/send-contact-notification/index.ts` | Read recipients from database, fallback to env var |

## Implementation Sequence

1. Create the database table with RLS policies
2. Add the recipients management UI to the Contact Submissions page
3. Update the edge function to query recipients from the database
4. Deploy and test end-to-end

