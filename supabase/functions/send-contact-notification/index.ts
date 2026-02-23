import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, checkRateLimit } from "../_shared/security.ts";
import { contactForm } from "../_shared/email-templates/templates/transactional.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const corsHeaders = getCorsHeaders();

interface ContactNotificationRequest {
  name: string;
  email: string;
  campaign?: string;
  organization_type?: string;
  message: string;
  created_at?: string;
}

// escapeHtml is now provided by the email template system

function validateInput(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  } else if (data.name.length > 100) {
    errors.push('Name must be less than 100 characters');
  }

  if (!data.email || typeof data.email !== 'string') {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email) || data.email.length > 255) {
      errors.push('Invalid email format');
    }
  }

  if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
    errors.push('Message is required');
  } else if (data.message.length > 5000) {
    errors.push('Message must be less than 5000 characters');
  }

  if (data.campaign && typeof data.campaign === 'string' && data.campaign.length > 200) {
    errors.push('Campaign must be less than 200 characters');
  }

  if (data.organization_type && typeof data.organization_type === 'string' && data.organization_type.length > 100) {
    errors.push('Organization type must be less than 100 characters');
  }

  return { valid: errors.length === 0, errors };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Rate limiting for public endpoint
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkRateLimit(`contact-notification:${clientIP}`, 5, 60000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', success: false }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const data: ContactNotificationRequest = await req.json();

    const validation = validateInput(data);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', details: validation.errors, success: false }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const campaign = data.campaign ? data.campaign.trim() : undefined;
    const organization_type = data.organization_type ? data.organization_type.trim() : undefined;
    const message = data.message.trim();
    const timestamp = data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString();

    console.log("Contact notification:", { name, email, messageLength: message.length });

    const htmlContent = contactForm({
      name,
      email,
      message,
      campaign,
      organizationType: organization_type,
      submittedAt: timestamp,
    });

    // Get recipients from database, fallback to env var
    let recipients: string[] = [];
    try {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: dbRecipients } = await supabaseAdmin
        .from("contact_notification_recipients")
        .select("email")
        .eq("is_active", true);
      if (dbRecipients && dbRecipients.length > 0) {
        recipients = dbRecipients.map((r: any) => r.email);
      }
    } catch (e) {
      console.warn("Failed to fetch DB recipients, falling back to env var:", e);
    }

    // Fallback to env var if no DB recipients
    if (recipients.length === 0) {
      recipients = (Deno.env.get('CONTACT_FORM_RECIPIENTS') || '').split(',').filter(Boolean);
    }

    if (recipients.length === 0) {
      throw new Error("No notification recipients configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Contact Form <${Deno.env.get('SENDER_EMAIL') || 'noreply@example.com'}>`,
        to: recipients,
        subject: `New Contact Form Submission from ${name}`,
        html: htmlContent,
        reply_to: email,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.text();
      throw new Error(`Resend API error: ${errorData}`);
    }

    const emailData = await emailResponse.json();
    console.log("Email sent:", emailData.id);

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
