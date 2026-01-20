/**
 * Shared email utilities for Edge Functions
 * Standardizes email sending with proper error handling
 *
 * USAGE:
 * import { sendEmail, getEmailConfig, EmailError } from '../_shared/email.ts';
 */

/**
 * Email configuration - validates required environment variables
 * Throws if not properly configured (fail-fast)
 */
export interface EmailConfig {
  SENDER_EMAIL: string;
  RESEND_API_KEY: string;
}

/**
 * Email send options
 */
export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * Email send result
 */
export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Custom error class for email failures
 */
export class EmailError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string, statusCode: number = 502) {
    super(message);
    this.name = 'EmailError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Get and validate email configuration
 * FAILS FAST if not properly configured - prevents silent failures
 */
export function getEmailConfig(): EmailConfig {
  const SENDER_EMAIL = Deno.env.get('SENDER_EMAIL');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (!SENDER_EMAIL) {
    throw new EmailError(
      'SENDER_EMAIL environment variable not configured. Set it in Supabase Edge Function secrets.',
      'EMAIL_NOT_CONFIGURED',
      500
    );
  }

  if (!RESEND_API_KEY) {
    throw new EmailError(
      'RESEND_API_KEY environment variable not configured. Set it in Supabase Edge Function secrets.',
      'EMAIL_NOT_CONFIGURED',
      500
    );
  }

  // Warn if using Resend test domain (these often fail in production)
  if (SENDER_EMAIL.endsWith('@resend.dev')) {
    console.warn('[email] WARNING: Using Resend test domain. Verify a custom domain for production use.');
  }

  return { SENDER_EMAIL, RESEND_API_KEY };
}

/**
 * Check if email is configured (without throwing)
 */
export function isEmailConfigured(): boolean {
  try {
    getEmailConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Send email via Resend API with proper error handling
 * THROWS EmailError on failure - does NOT silently fail
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  const { SENDER_EMAIL, RESEND_API_KEY } = getEmailConfig();

  const toAddresses = Array.isArray(options.to) ? options.to : [options.to];
  const fromAddress = options.fromName
    ? `${options.fromName} <${SENDER_EMAIL}>`
    : SENDER_EMAIL;

  console.log(`[email] Sending email to ${toAddresses.length} recipient(s) from ${fromAddress}`);
  console.log(`[email] Subject: ${options.subject}`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: toAddresses,
        subject: options.subject,
        html: options.html,
        ...(options.replyTo && { reply_to: options.replyTo })
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[email] Resend API error: ${response.status} - ${errorText}`);

      // Parse error for better messages
      let errorMessage = 'Email delivery failed';
      let errorCode = 'EMAIL_SEND_FAILED';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;

        // Common Resend error codes
        if (errorText.includes('domain is not verified')) {
          errorCode = 'DOMAIN_NOT_VERIFIED';
          errorMessage = 'Email domain not verified in Resend. Please verify your domain at resend.com/domains';
        } else if (errorText.includes('rate limit')) {
          errorCode = 'RATE_LIMITED';
          errorMessage = 'Email rate limit exceeded. Please try again later.';
        } else if (response.status === 401) {
          errorCode = 'INVALID_API_KEY';
          errorMessage = 'Invalid Resend API key. Check your RESEND_API_KEY configuration.';
        }
      } catch {
        // Keep default error message
      }

      throw new EmailError(errorMessage, errorCode, response.status >= 500 ? 502 : 400);
    }

    const result = await response.json();
    console.log(`[email] Email sent successfully. Message ID: ${result.id}`);

    return {
      success: true,
      messageId: result.id
    };
  } catch (error) {
    if (error instanceof EmailError) {
      throw error;
    }

    // Network or unexpected errors
    console.error('[email] Unexpected error sending email:', error);
    throw new EmailError(
      error instanceof Error ? error.message : 'Failed to send email',
      'EMAIL_NETWORK_ERROR',
      502
    );
  }
}

/**
 * Send email with graceful degradation (returns result instead of throwing)
 * Use this when email failure shouldn't fail the entire operation
 * but you still want proper error information
 */
export async function sendEmailSafe(options: SendEmailOptions): Promise<EmailResult> {
  try {
    return await sendEmail(options);
  } catch (error) {
    if (error instanceof EmailError) {
      return {
        success: false,
        error: error.message,
        errorCode: error.code
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'UNKNOWN_ERROR'
    };
  }
}

/**
 * Escape HTML to prevent XSS in email templates
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
