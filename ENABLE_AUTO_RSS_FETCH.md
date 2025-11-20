# Enable Automatic RSS Fetching (Every 15 Minutes)

## 🚨 **Problem:**
RSS feeds are only fetched when you manually click "Refresh Feed".
The automatic 15-minute fetching isn't working because the scheduler isn't configured.

## ✅ **Solution:**
Run this **ONE command** in your Supabase SQL Editor to enable auto-fetching:

### **Step 1: Go to Supabase Dashboard**
1. Open https://supabase.com/dashboard/project/nuclmzoasgydubdshtab
2. Click on **SQL Editor** (left sidebar)
3. Click **"New Query"**

### **Step 2: Run This SQL Command**

```sql
-- Enable automatic RSS fetching every 15 minutes
UPDATE public.system_config
SET value = 'paste-your-service-role-key-here',
    updated_at = NOW()
WHERE key = 'supabase_service_role_key';
```

**⚠️ IMPORTANT:** Replace `paste-your-service-role-key-here` with your **actual service role key** (it should start with `eyJ...` and be ~300 characters long).

### **Step 3: Find Your Service Role Key**
1. In Supabase dashboard, go to **Settings** → **API**
2. Scroll down to **Project API keys**
3. Find **`service_role` key** (NOT the `anon` key!)
4. Copy the long JWT token
5. Replace `YOUR_ACTUAL_SERVICE_ROLE_KEY` in the SQL above

### **Step 4: Verify It's Working**

After running the command, check the configuration:

```sql
-- Check if configured correctly
SELECT key,
       CASE
         WHEN value LIKE '%your-%' THEN '❌ NOT CONFIGURED'
         ELSE '✅ CONFIGURED'
       END as status,
       LENGTH(value) as key_length
FROM public.system_config
WHERE key IN ('supabase_url', 'supabase_service_role_key');
```

You should see:
```
supabase_url              | ✅ CONFIGURED | 45
supabase_service_role_key | ✅ CONFIGURED | 200+
```

## 🎉 **What This Enables:**

Once configured, your system will automatically:
- ✅ **Fetch RSS feeds every 15 minutes** (at :00, :15, :30, :45)
- ✅ **Analyze sentiment every 15 minutes** (at :05, :20, :35, :50)
- ✅ **Show new articles in real-time** on your News Feed
- ✅ **Update trending topics automatically**

## 🧪 **Testing:**

After configuring:
1. Wait 15 minutes (or until the next :00, :15, :30, or :45 minute mark)
2. Check your News Feed - new articles should appear automatically
3. Check the `job_executions` table to see scheduler runs:

```sql
SELECT
  j.job_name,
  je.status,
  je.started_at,
  je.items_processed,
  je.items_created
FROM job_executions je
JOIN scheduled_jobs j ON j.id = je.job_id
WHERE je.started_at > NOW() - INTERVAL '1 hour'
ORDER BY je.started_at DESC;
```

## 📊 **Current Schedule:**

| Job | Runs At | Frequency |
|-----|---------|-----------|
| RSS Feed Sync | :00, :15, :30, :45 | Every 15 min |
| Sentiment Analysis | :05, :20, :35, :50 | Every 15 min |
| Smart Alerting | Daily 8 AM | Once daily |
| Daily Briefing | Daily 6 AM | Once daily |

## ❓ **Troubleshooting:**

If feeds still don't auto-fetch after 15 minutes:

1. **Check if pg_cron is enabled:**
```sql
SELECT * FROM cron.job;
```

2. **Check scheduler logs:**
```sql
SELECT * FROM job_executions
ORDER BY started_at DESC
LIMIT 10;
```

3. **Manually trigger to test:**
```sql
SELECT public.trigger_job_scheduler();
```
