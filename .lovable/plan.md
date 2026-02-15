

# Google Calendar Booking Integration

## What You Need To Set Up

To show your team's real-time availability and auto-create meetings with lead summaries, you'll need to create a **Google Cloud Service Account** with Calendar API access. Here's what to do:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use an existing one)
3. Enable the **Google Calendar API** (APIs & Services -> Enable APIs -> search "Google Calendar API")
4. Create a **Service Account** (APIs & Services -> Credentials -> Create Credentials -> Service Account)
5. Download the **JSON key file** for the service account
6. In your team's Google Calendar settings, **share the calendar** with the service account's email address (it looks like `something@project-id.iam.gserviceaccount.com`) and give it "Make changes to events" permission
7. Note the **Calendar ID** you want to use (usually your team email like `team@molitico.com`, or find it in Calendar Settings -> "Integrate calendar")

I'll need two pieces of information stored as secrets:
- **GOOGLE_CALENDAR_SERVICE_ACCOUNT**: The full JSON key file contents
- **GOOGLE_CALENDAR_ID**: The calendar ID to book meetings on (e.g. `team@molitico.com`)

---

## How It Will Work

Instead of redirecting high-scoring leads away from the site, the ThankYou step will show an inline booking widget:

1. Lead submits the qualification form
2. If `redirect_to_calendar` is true (score >= 50), ThankYou shows a **date picker + time slot grid** instead of the redirect
3. The time slots come from querying the Google Calendar API for free/busy data
4. Lead picks a slot, and a 30-minute event is created on your calendar with:
   - Title: "Intro Call - [Lead Name] ([Organization])"
   - Attendees: Lead's email + your team calendar
   - Description: A summary of all their funnel answers (segment, channels, KPIs, budget, role)
5. Lead sees a confirmation with the meeting date/time

---

## Architecture

### New Edge Function: `google-calendar-booking`

**GET** `/google-calendar-booking?date=2026-02-20`
- Authenticates with Google using the service account
- Queries `freeBusy` for the given date on your calendar
- Returns available 30-minute slots (e.g. 9:00 AM - 5:00 PM, excluding busy times)

**POST** `/google-calendar-booking`
- Body: `{ date, time, name, email, organization, summary }`
- Creates a Google Calendar event with the lead as an attendee
- Returns confirmation details

### Updated ThankYou Step

When `redirectToCalendar` is true:
- Instead of redirecting, show a 3-step inline booking flow:
  1. **Date picker**: Next 14 business days
  2. **Time slot grid**: Available 30-min slots for selected date
  3. **Confirmation**: Meeting booked message with details

When `redirectToCalendar` is false:
- Keep existing "What Happens Next" cards (no change)

---

## Technical Details

### Edge Function: `supabase/functions/google-calendar-booking/index.ts`

- Uses Google's REST API directly (no SDK needed -- just JWT auth via service account)
- Generates a JWT signed with the service account private key to get an access token
- Calls `calendar.googleapis.com/v3/freeBusy` for availability
- Calls `calendar.googleapis.com/v3/calendars/{id}/events` to create events
- Meeting description template:

```text
Strategy Session - Booked via Molitico Funnel

Lead: [Name]
Email: [Email]
Organization: [Organization]
Role: [Role]
Segment: [Commercial/Political]
Channels: [CTV, Digital Ads, ...]
Budget: [$10k-$50k]
KPIs: [ROAS, Brand Awareness, ...]
Decision Maker: Yes/No
Lead Score: [Score]
```

### New Component: `src/components/funnel/CalendarBooking.tsx`

- Date selector showing next 14 business days (Mon-Fri)
- Time slot grid (9 AM - 5 PM in 30-min increments)
- Loading states while fetching availability
- Confirmation view after booking
- Styled to match the dark funnel theme

### ThankYou Step Changes

- Accept new props: `qualificationData` (the full form submission) and `segment`
- When `redirectToCalendar` is true, render `CalendarBooking` instead of the redirect timer
- Pass lead details to CalendarBooking for the meeting description

### Experience.tsx Changes

- Pass qualification data and segment to ThankYouStep
- Remove the Calendly redirect logic

### Config Changes

- Register `google-calendar-booking` in `supabase/config.toml` with `verify_jwt = false`

### Files Modified/Created

| File | Action |
|------|--------|
| `supabase/functions/google-calendar-booking/index.ts` | Create -- handles availability + booking |
| `src/components/funnel/CalendarBooking.tsx` | Create -- inline booking UI component |
| `src/components/funnel/steps/ThankYouStep.tsx` | Modify -- show CalendarBooking for high-score leads |
| `src/pages/Experience.tsx` | Modify -- pass qualification data to ThankYou |
| `supabase/config.toml` | Modify -- register new edge function |

### Business Hours Configuration

Default: Monday-Friday, 9:00 AM - 5:00 PM Eastern Time. The edge function will filter out weekends and slots outside business hours. This can be adjusted by changing constants in the edge function.

