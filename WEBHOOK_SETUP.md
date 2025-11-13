# Client Portal - Webhook Setup Guide

This document provides instructions for setting up webhooks to receive real-time data updates.

## ActBlue Webhook Configuration

To receive real-time donation notifications from ActBlue:

### 1. Get Your Webhook URL

Your unique webhook endpoint is:
```
https://nuclmzoasgydubdshtab.supabase.co/functions/v1/actblue-webhook
```

### 2. Configure in ActBlue

1. Log in to your ActBlue account
2. Navigate to **Settings** → **Webhooks**
3. Click **Add New Webhook**
4. Enter the webhook URL above
5. Select the following events to monitor:
   - Contribution Created
   - Contribution Updated
   - Refund Issued
   - Recurring Contribution
6. Save the webhook configuration

### 3. Security

The webhook validates incoming requests using your webhook secret configured in the Admin panel under **API Credentials**.

Make sure your webhook secret matches the one configured in ActBlue.

## Testing Webhooks

To test your webhook integration:

1. Make a test donation through ActBlue
2. Check the Client Dashboard to see if the transaction appears
3. View edge function logs in Lovable Cloud for debugging

## Troubleshooting

**Donations not appearing?**
- Verify the webhook URL is correctly configured in ActBlue
- Check that your Entity ID in API Credentials matches your ActBlue entity
- Review edge function logs for any errors

**Need Help?**
Contact your admin for assistance with webhook configuration.
