import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, checkRateLimit } from "../_shared/security.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const corsHeaders = getCorsHeaders();

interface ContactNotificationRequest {
  name: string;
  email: string;
  campaign?: string;
  organization_type?: string;
  message: string;
  created_at?: string;
}

function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

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

    const name = escapeHtml(data.name.trim());
    const email = data.email.trim().toLowerCase();
    const campaign = data.campaign ? escapeHtml(data.campaign.trim()) : null;
    const organization_type = data.organization_type ? escapeHtml(data.organization_type.trim()) : null;
    const message = escapeHtml(data.message.trim());
    const timestamp = data.created_at ? new Date(data.created_at).toLocaleString() : new Date().toLocaleString();

    console.log("Contact notification:", { name, email, messageLength: message.length });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
            .container { background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .header { border-bottom: 3px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }
            h1 { color: #667eea; margin: 0; font-size: 24px; }
            .field { margin-bottom: 20px; }
            .field-label { font-weight: 600; color: #555; margin-bottom: 5px; font-size: 14px; text-transform: uppercase; }
            .field-value { color: #333; font-size: 16px; padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
            .message-box { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin-top: 20px; white-space: pre-wrap; }
            .timestamp { color: #999; font-size: 13px; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Contact Form Submission</h1>
              <div class="timestamp">Received: ${timestamp}</div>
            </div>
            <div class="field"><div class="field-label">Name</div><div class="field-value">${name}</div></div>
            <div class="field"><div class="field-label">Email</div><div class="field-value"><a href="mailto:${email}">${email}</a></div></div>
            ${campaign ? `<div class="field"><div class="field-label">Campaign</div><div class="field-value">${campaign}</div></div>` : ''}
            ${organization_type ? `<div class="field"><div class="field-label">Organization Type</div><div class="field-value">${organization_type}</div></div>` : ''}
            <div class="field"><div class="field-label">Message</div><div class="message-box">${message}</div></div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Contact Form <${Deno.env.get('SENDER_EMAIL') || 'noreply@example.com'}>`,
        to: (Deno.env.get('CONTACT_FORM_RECIPIENTS') || '').split(',').filter(Boolean),
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
