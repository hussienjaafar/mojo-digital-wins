import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { parseJsonBody, uuidSchema, z } from "../_shared/validators.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

interface NotificationRequest {
  userId: string;
  type: 'bill_update' | 'new_article' | 'bill_alert' | 'bookmark_update';
  title: string;
  message: string;
  link?: string;
}

/**
 * Validate cron secret for scheduled jobs
 */
function validateCronSecret(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.warn('CRON_SECRET not configured - rejecting request');
    return false;
  }
  
  const providedSecret = req.headers.get('x-cron-secret');
  return providedSecret === cronSecret;
}

/**
 * Validate admin JWT
 */
async function validateAdmin(req: Request, supabase: any): Promise<{ valid: boolean; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { valid: false };

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return { valid: false };

  // Check if admin
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;

  return { valid: isAdmin, user };
}

/**
 * Validate that user can trigger notification for target user
 * Users can only trigger notifications for themselves unless they're admin
 */
async function validateUserAccess(
  req: Request, 
  supabase: any, 
  targetUserId: string
): Promise<{ valid: boolean; user?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { valid: false };

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );

  if (error || !user) return { valid: false };

  // Users can trigger notifications for themselves
  if (user.id === targetUserId) {
    return { valid: true, user };
  }

  // Or if they're admin
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  const isAdmin = roles?.some((r: any) => r.role === 'admin') || false;

  return { valid: isAdmin, user };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse + validate request body first to get userId for authorization checks
    const requestSchema = z.object({
      userId: uuidSchema,
      type: z.enum(['bill_update', 'new_article', 'bill_alert', 'bookmark_update']),
      title: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(5000),
      link: z.string().trim().max(2000).optional(),
    }).passthrough();

    const parsedBody = await parseJsonBody(req, requestSchema, { allowEmpty: false });
    if (!parsedBody.ok) {
      return new Response(
        JSON.stringify({ error: parsedBody.error, details: parsedBody.details }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, type, title, message, link } = parsedBody.data;


    // SECURITY: Validate authentication
    // Allow: cron secret, admin JWT, or user triggering for themselves
    const isCronValid = validateCronSecret(req);
    
    if (!isCronValid) {
      const userAccess = await validateUserAccess(req, supabaseClient, userId);
      
      if (!userAccess.valid) {
        console.warn('Unauthorized notification attempt for userId:', userId);
        return new Response(
          JSON.stringify({ error: 'Unauthorized - valid authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Notification triggered by user ${userAccess.user?.id} for target ${userId}`);
    } else {
      console.log('Notification triggered via cron secret');
    }

    // Get user email and preferences
    const { data: userData, error: userError } = await supabaseClient
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    const { data: prefs } = await supabaseClient
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const sentVia: string[] = [];

    // Send in-app notification
    await supabaseClient
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        message,
        link,
        sent_via: ['in_app']
      });

    sentVia.push('in_app');

    // Send email if enabled
    if (prefs?.email_notifications) {
      const shouldSendEmail = 
        (type === 'bill_update' && prefs.notify_bill_updates) ||
        (type === 'new_article' && prefs.notify_new_articles) ||
        (type === 'bill_alert' && prefs.notify_new_bills) ||
        (type === 'bookmark_update' && prefs.notify_bookmarked_articles);

      if (shouldSendEmail) {
        const emailHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
              .button { background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${title}</h1>
              </div>
              <div class="content">
                <p>${message}</p>
                ${link ? `<a href="${link}" class="button">View Details</a>` : ''}
              </div>
              <div class="footer">
                <p>You received this because you're subscribed to notifications.</p>
                <p><a href="https://nuclmzoasgydubdshtab.lovable.app/settings">Manage your notification preferences</a></p>
              </div>
            </div>
          </body>
          </html>
        `;

        await resend.emails.send({
          from: 'Mojo Digital <onboarding@resend.dev>',
          to: [userData.email],
          subject: title,
          html: emailHtml,
        });

        sentVia.push('email');
      }
    }

    // Get push subscriptions if enabled
    if (prefs?.push_notifications) {
      const { data: subscriptions } = await supabaseClient
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (subscriptions && subscriptions.length > 0) {
        // Send push notifications (web push)
        for (const sub of subscriptions) {
          try {
            // You would implement web push here using web-push library
            // For now, we'll log it
            console.log('Would send push notification to:', sub.endpoint);
            sentVia.push('push');
          } catch (error) {
            console.error('Error sending push notification:', error);
          }
        }
      }
    }

    // Update notification record with sent_via
    await supabaseClient
      .from('notifications')
      .update({ sent_via: sentVia })
      .eq('user_id', userId)
      .eq('title', title)
      .eq('created_at', new Date().toISOString());

    console.log(`Notification sent successfully via: ${sentVia.join(', ')}`);

    return new Response(
      JSON.stringify({ success: true, sent_via: sentVia }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-notification-email function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
