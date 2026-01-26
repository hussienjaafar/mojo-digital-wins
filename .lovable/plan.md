
# Enhanced User Management System

## Overview

Transform the Organization Members section into a comprehensive user management hub with full visibility into user activity, security status, and geographic patterns, plus powerful bulk management capabilities.

---

## Architecture

```text
+----------------------------------+     +---------------------------+
|     Enhanced Member Table        |     |    User Detail Sidebar    |
+----------------------------------+     +---------------------------+
| - Email (visible)                |     | - Full Profile Info       |
| - Last Session (from sessions)   | --> | - Session History         |
| - MFA Badge                      |     | - Login History           |
| - Status Badge                   |     | - Activity Audit          |
| - Quick Actions                  |     | - Location Map            |
+----------------------------------+     +---------------------------+
              |
              v
+----------------------------------+
|       Bulk Action Bar            |
+----------------------------------+
| - Terminate All Sessions         |
| - Change Status (Multi-select)   |
| - Export to CSV                  |
| - Send Notifications             |
+----------------------------------+
```

---

## Phase 1: Database Enhancements

### 1.1 Populate Session Data
Currently, the `user_sessions` table exists but isn't being populated. We need to create a trigger to track sessions on login:

- Create a trigger function that records session data when users authenticate
- Include device info parsing from user agent (browser, OS, device type)
- Store IP address and derive approximate location using a geolocation service

### 1.2 New Tables

**user_activity_logs** - Track in-app actions:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| organization_id | uuid | FK to client_organizations |
| action_type | text | e.g., 'viewed_report', 'exported_data' |
| resource_type | text | e.g., 'dashboard', 'donor_list' |
| resource_id | text | Specific resource identifier |
| metadata | jsonb | Additional context |
| ip_address | inet | Request origin |
| created_at | timestamptz | Timestamp |

**user_locations** - Cache geolocation lookups:
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| ip_address | inet | Unique IP |
| city | text | City name |
| region | text | State/province |
| country | text | Country code |
| country_name | text | Full country name |
| latitude | decimal | For map plotting |
| longitude | decimal | For map plotting |
| created_at | timestamptz | Cache timestamp |

---

## Phase 2: Enhanced List View

### 2.1 New Table Columns

Update `ClientUserManager.tsx` to display:

| Column | Source | Description |
|--------|--------|-------------|
| **Name** | client_users.full_name | User's display name |
| **Email** | profiles.email | User's email address |
| **Organization** | client_organizations.name | Organization membership |
| **Role** | client_users.role | Permission level badge |
| **Status** | client_users.status | Active/Pending/Suspended badge |
| **MFA** | profiles.mfa_enabled_at | Shield icon if enabled |
| **Last Session** | user_sessions.last_active_at | Relative time + device icon |
| **Actions** | - | Quick action menu |

### 2.2 Visual Indicators

- **MFA Status**: Green shield icon if enabled, yellow warning if disabled
- **Session Activity**: Green dot for active in last 15 min, gray for inactive
- **Security Alerts**: Red badge if account locked or suspicious activity detected

---

## Phase 3: Quick-View Sidebar

### 3.1 Sidebar Component: `UserDetailSidebar.tsx`

A slide-out panel that appears when clicking a user row, showing:

**Header Section:**
- User avatar (generated from initials)
- Full name and email
- Status badge with quick toggle
- Role badge

**Tabs:**

1. **Overview Tab**
   - Account created date
   - Last login time and location
   - MFA status with enable/disable action
   - Total sessions in last 30 days
   - Organizations with role in each

2. **Sessions Tab**
   - Active sessions list with:
     - Device type icon (desktop/mobile/tablet)
     - Browser and OS
     - IP address with location
     - Session start time
     - "Terminate" button per session
   - Session history (last 30 days)

3. **Login History Tab**
   - Recent login attempts (success/failure)
   - Failed attempt reasons
   - IP addresses with location
   - Time of attempt
   - Flag suspicious patterns (multiple failures, unusual locations)

4. **Activity Tab**
   - In-app actions audit trail
   - Action type with icon
   - Resource accessed
   - Timestamp
   - Filter by action type

5. **Location Tab**
   - Interactive map showing login locations
   - Cluster markers for frequent locations
   - Timeline of location changes
   - Flag unusual geographic patterns
   - Country/city breakdown

---

## Phase 4: Location Map Integration

### 4.1 Geolocation Edge Function: `geolocate-ip`

```typescript
// Lookup IP address and cache results
// Uses free IP geolocation API (ip-api.com or ipinfo.io)
// Returns: city, region, country, lat/lng
```

### 4.2 Map Component: `UserLocationMap.tsx`

- Use `react-simple-maps` (already installed) for world map
- Cluster nearby login locations
- Color-code by recency (recent = brighter)
- Hover tooltips showing date, device, success/failure
- Highlight anomalies (new countries, rapid location changes)

---

## Phase 5: Bulk Actions

### 5.1 Selection System

- Checkbox column for multi-select
- "Select All" toggle (current page / all pages)
- Selection count indicator
- Floating action bar when items selected

### 5.2 Bulk Action Bar Component

| Action | Description | Implementation |
|--------|-------------|----------------|
| **Terminate Sessions** | Force logout selected users | Call `terminate-user-sessions` for each |
| **Change Status** | Bulk activate/suspend/deactivate | Update client_users.status |
| **Export Data** | Download CSV of selected users | Generate CSV with all visible fields |
| **Send Notification** | Email selected users | Create notification edge function |

### 5.3 New Edge Functions

**bulk-user-operations:**
- Handle bulk status changes with audit logging
- Rate-limited to prevent abuse
- Requires admin role verification

**send-user-notification:**
- Send custom email notifications to selected users
- Template options: welcome, reminder, security alert
- Track delivery status

---

## Phase 6: Activity Tracking Implementation

### 6.1 Client-Side Tracking Hook: `useActivityTracker.ts`

```typescript
// Automatically log significant user actions
// - Page views (dashboard, reports)
// - Data exports
// - Settings changes
// - Search queries (anonymized)
```

### 6.2 Activity Logging Edge Function: `log-user-activity`

- Receives activity events from frontend
- Validates user session
- Stores in user_activity_logs table
- Respects rate limits

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/admin/UserDetailSidebar.tsx` | Slide-out panel for user details |
| `src/components/admin/UserSessionsList.tsx` | Sessions list component |
| `src/components/admin/UserLoginHistory.tsx` | Login attempts list |
| `src/components/admin/UserActivityLog.tsx` | Activity audit trail |
| `src/components/admin/UserLocationMap.tsx` | Geographic visualization |
| `src/components/admin/BulkActionBar.tsx` | Floating bulk actions bar |
| `src/hooks/useActivityTracker.ts` | Client-side activity logging |
| `supabase/functions/geolocate-ip/index.ts` | IP geolocation service |
| `supabase/functions/bulk-user-operations/index.ts` | Bulk action handler |
| `supabase/functions/send-user-notification/index.ts` | Email notification sender |
| `supabase/functions/log-user-activity/index.ts` | Activity logging endpoint |

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/ClientUserManager.tsx` | Add email column, MFA indicator, session info, bulk selection |
| `src/pages/admin/UserDetail.tsx` | Integrate with sidebar, add location tab |
| `supabase/functions/db-proxy/index.ts` | Add new tables to whitelist for portal |

---

## Database Migrations

1. Create `user_activity_logs` table with RLS
2. Create `user_locations` table (cache, no RLS needed)
3. Add trigger to populate `user_sessions` on auth events
4. Create indexes for efficient querying:
   - `user_sessions(user_id, last_active_at)`
   - `login_attempts(email, attempted_at)`
   - `user_activity_logs(user_id, created_at)`

---

## Technical Considerations

### Performance
- Virtual scrolling for large user lists (existing `V3VirtualizedDataTable`)
- Paginated session and activity loading
- Cached geolocation lookups (24-hour TTL)
- Debounced search input

### Security
- All new tables have RLS policies
- Bulk operations require admin role verification
- Activity logging excludes sensitive data (no passwords, no PII in search)
- IP geolocation uses rate-limited external API

### Privacy
- Location data shown only to platform admins
- Option to disable location tracking per organization
- Activity logs auto-purge after 90 days

---

## Implementation Order

1. **Week 1**: Database migrations + session tracking trigger
2. **Week 2**: Enhanced table columns + email/MFA/session display
3. **Week 3**: User detail sidebar with tabs
4. **Week 4**: Location tracking + map visualization
5. **Week 5**: Bulk actions + notification system
6. **Week 6**: Activity tracking + audit trail

---

## Expected Outcome

After implementation, platform admins will have:

- **At-a-glance visibility**: Email, MFA status, last session, and status visible directly in the member list
- **Deep user insights**: Click any user to see full session history, login attempts, and in-app activity
- **Geographic awareness**: Visual map of where users access the platform from, with anomaly detection
- **Efficient bulk management**: Select multiple users and terminate sessions, change status, export data, or send notifications
- **Complete audit trail**: Full history of user actions for compliance and security review
