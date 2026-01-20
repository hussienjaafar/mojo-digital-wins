/**
 * Transactional Email Templates
 *
 * Password reset, welcome, account deletion, contact form.
 * Minimal design, single CTA, no promotional content.
 */

import { transactionalTemplate } from '../base.ts';
import {
  heading,
  paragraph,
  button,
  infoBox,
  smallText,
  noticeBox,
  divider,
  escapeHtml,
} from '../components.ts';
import { colors, spacing } from '../tokens.ts';

interface PasswordResetOptions {
  resetUrl: string;
  email: string;
  expiresIn?: string;
  organizationName?: string;
}

/**
 * Password reset email
 */
export function passwordReset(options: PasswordResetOptions): string {
  const {
    resetUrl,
    email,
    expiresIn = '24 hours',
    organizationName,
  } = options;

  const titleText = organizationName
    ? `Reset Your Password`
    : 'Reset Your Password';

  const contextText = organizationName
    ? `A password reset was requested for your ${escapeHtml(organizationName)} account.`
    : 'A password reset was requested for your account.';

  const content = `
    ${heading(titleText)}
    ${paragraph(contextText)}
    ${infoBox('Email', email)}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Reset Password', resetUrl, 'primary')}
    </div>
    ${smallText(`This link expires in ${expiresIn}. If you didn't request this, you can safely ignore this email.`)}
  `;

  return transactionalTemplate(content, `Reset your password - link expires in ${expiresIn}`);
}

interface WelcomeOptions {
  fullName: string;
  email: string;
  organizationName: string;
  role: string;
  resetUrl: string;
  expiresIn?: string;
}

/**
 * Welcome email for new users
 */
export function welcome(options: WelcomeOptions): string {
  const {
    fullName,
    email,
    organizationName,
    role,
    resetUrl,
    expiresIn = '24 hours',
  } = options;

  const content = `
    ${heading(`Welcome to ${escapeHtml(organizationName)}`)}
    ${paragraph(`Hi ${escapeHtml(fullName)},`)}
    ${paragraph(`You've been added to <strong>${escapeHtml(organizationName)}</strong> as a <strong>${escapeHtml(role)}</strong>. Set your password to get started.`)}
    ${infoBox('Email', email)}
    ${infoBox('Role', role)}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Set Your Password', resetUrl, 'primary')}
    </div>
    ${smallText(`This link expires in ${expiresIn}.`)}
  `;

  return transactionalTemplate(content, `Welcome to ${organizationName} - set your password to get started`);
}

interface AccountDeletionOptions {
  scheduledDate: string;
  cancelUrl?: string;
}

/**
 * Account deletion confirmation email
 */
export function accountDeletion(options: AccountDeletionOptions): string {
  const { scheduledDate, cancelUrl } = options;

  const content = `
    ${heading('Account Deletion Request')}
    ${paragraph('We received a request to delete your account and all associated data.')}
    ${infoBox('Scheduled deletion date', scheduledDate)}
    ${paragraph('Per GDPR regulations, you have 30 days to cancel this request. After this period, your data will be permanently deleted.')}
    ${noticeBox(
      '<strong>Important:</strong> To cancel this deletion, log into your account before the scheduled date.',
      'warning'
    )}
    ${cancelUrl ? `
      <div style="text-align: center; margin: ${spacing.lg} 0;">
        ${button('Cancel Deletion', cancelUrl, 'secondary')}
      </div>
    ` : ''}
    ${smallText('If you did not make this request, please log in immediately to cancel it and secure your account.')}
  `;

  return transactionalTemplate(content, `Account deletion scheduled for ${scheduledDate}`);
}

interface ContactFormOptions {
  name: string;
  email: string;
  message: string;
  campaign?: string;
  organizationType?: string;
  submittedAt: string;
}

/**
 * Contact form submission notification (sent to admins)
 */
export function contactForm(options: ContactFormOptions): string {
  const {
    name,
    email,
    message,
    campaign,
    organizationType,
    submittedAt,
  } = options;

  const content = `
    ${heading('New Contact Form Submission')}
    ${paragraph(`Received on ${escapeHtml(submittedAt)}`)}
    ${divider()}
    ${infoBox('Name', name)}
    ${infoBox('Email', email)}
    ${campaign ? infoBox('Campaign', campaign) : ''}
    ${organizationType ? infoBox('Organization Type', organizationType) : ''}
    ${divider()}
    <div style="background-color: ${colors.background};
                border-left: 4px solid ${colors.primary};
                padding: ${spacing.md};
                margin: ${spacing.md} 0;
                border-radius: 4px;">
      <p style="color: ${colors.textMuted};
                font-size: 12px;
                margin: 0 0 8px 0;">
        Message:
      </p>
      <p style="color: ${colors.text};
                margin: 0;
                white-space: pre-wrap;">
        ${escapeHtml(message)}
      </p>
    </div>
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button(`Reply to ${name}`, `mailto:${email}`, 'primary')}
    </div>
  `;

  return transactionalTemplate(content, `New contact from ${name}`);
}

/**
 * Export request confirmation
 */
export function dataExportReady(downloadUrl: string, expiresIn: string = '7 days'): string {
  const content = `
    ${heading('Your Data Export is Ready')}
    ${paragraph('Your data export has been prepared and is ready for download.')}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Download Your Data', downloadUrl, 'primary')}
    </div>
    ${noticeBox(
      `This download link will expire in ${expiresIn}. Please download your data before then.`,
      'info'
    )}
    ${smallText('This export contains all personal data associated with your account in JSON format.')}
  `;

  return transactionalTemplate(content, 'Your data export is ready for download');
}
