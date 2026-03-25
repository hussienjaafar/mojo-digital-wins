/**
 * Transactional Email Templates
 *
 * Password reset, welcome, account deletion, contact form.
 * Minimal design, single CTA, no promotional content.
 * V3 Design System aligned.
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
  timeline,
  escapeHtml,
} from '../components.ts';
import { colors, spacing, fonts, fontSizes, fontWeights } from '../tokens.ts';

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

  const contextText = organizationName
    ? `We received a request to reset the password for your <strong>${escapeHtml(organizationName)}</strong> account.`
    : 'We received a request to reset your account password.';

  const content = `
    ${heading('Reset Your Password')}
    ${paragraph(contextText)}
    ${infoBox('Account', email)}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Reset Password', resetUrl, 'primary')}
    </div>
    ${noticeBox(
      `<strong>🔒 Security tip:</strong> This link expires in ${expiresIn}. If you didn't request this reset, you can safely ignore this email—your password will remain unchanged.`,
      'info'
    )}
    ${smallText(`For your security, this password reset link can only be used once.`)}
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

  const firstName = fullName.split(' ')[0];

  const content = `
    ${heading(`Welcome to ${escapeHtml(organizationName)}!`)}
    <p style="color: ${colors.textSecondary};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.base};
              line-height: 1.6;
              margin: 0 0 ${spacing.md} 0;">
      Hi ${escapeHtml(firstName)}, you've been added to <strong>${escapeHtml(organizationName)}</strong> as a <strong>${escapeHtml(role)}</strong>. Let's get you set up!
    </p>
    ${timeline([
      { title: 'Set your password', description: 'Create a secure password for your account', complete: false },
      { title: 'Complete your profile', description: 'Add your details and preferences', complete: false },
      { title: 'Explore the dashboard', description: 'Discover insights and take action', complete: false },
    ])}
    ${infoBox('Your email', email)}
    ${infoBox('Your role', role)}
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Set Your Password & Get Started', resetUrl, 'primary')}
    </div>
    ${smallText(`This link expires in ${expiresIn}. Need help? Contact your organization admin.`)}
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
    ${paragraph('We received a request to permanently delete your account and all associated data.')}
    ${infoBox('Scheduled deletion', scheduledDate)}
    <div style="background-color: ${colors.background};
                border-radius: 8px;
                padding: ${spacing.md};
                margin: ${spacing.md} 0;">
      <p style="color: ${colors.text};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                font-weight: ${fontWeights.semibold};
                margin: 0 0 ${spacing.sm} 0;">
        What happens next:
      </p>
      <ul style="color: ${colors.textSecondary};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes.sm};
                 margin: 0;
                 padding-left: 20px;">
        <li style="margin-bottom: 4px;">Your account will remain active until the scheduled date</li>
        <li style="margin-bottom: 4px;">You can cancel this request anytime before deletion</li>
        <li style="margin-bottom: 4px;">After deletion, your data cannot be recovered</li>
        <li style="margin-bottom: 0;">Per GDPR, you have 30 days to change your mind</li>
      </ul>
    </div>
    ${noticeBox(
      '<strong>Changed your mind?</strong> Log into your account before the scheduled date to cancel this deletion request.',
      'warning'
    )}
    ${cancelUrl ? `
      <div style="text-align: center; margin: ${spacing.lg} 0;">
        ${button('Cancel Deletion Request', cancelUrl, 'secondary')}
      </div>
    ` : ''}
    ${smallText('If you did not request this deletion, please log in immediately to secure your account.')}
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
    <p style="color: ${colors.textMuted};
              font-family: ${fonts.primary};
              font-size: ${fontSizes.sm};
              margin: 0 0 ${spacing.md} 0;">
      Received on ${escapeHtml(submittedAt)}
    </p>
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
                border-radius: 0 8px 8px 0;">
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.xs};
                font-weight: ${fontWeights.semibold};
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin: 0 0 8px 0;">
        Message
      </p>
      <p style="color: ${colors.text};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.6;
                margin: 0;
                white-space: pre-wrap;">
        ${escapeHtml(message)}
      </p>
    </div>
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button(`Reply to ${escapeHtml(name)}`, `mailto:${encodeURIComponent(email)}`, 'primary')}
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
    ${paragraph('Your personal data export has been prepared and is ready for download.')}
    <div style="background-color: ${colors.background};
                border-radius: 8px;
                padding: ${spacing.md};
                margin: ${spacing.md} 0;">
      <p style="color: ${colors.text};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                font-weight: ${fontWeights.semibold};
                margin: 0 0 ${spacing.sm} 0;">
        What's included:
      </p>
      <ul style="color: ${colors.textSecondary};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes.sm};
                 margin: 0;
                 padding-left: 20px;">
        <li style="margin-bottom: 4px;">Your profile information</li>
        <li style="margin-bottom: 4px;">Activity history and preferences</li>
        <li style="margin-bottom: 4px;">All associated data in JSON format</li>
      </ul>
    </div>
    <div style="text-align: center; margin: ${spacing.lg} 0;">
      ${button('Download Your Data', downloadUrl, 'primary')}
    </div>
    ${noticeBox(
      `<strong>⏰ Time-sensitive:</strong> This download link expires in ${expiresIn}. Please save your data before then.`,
      'info'
    )}
    ${smallText('This export was generated per your GDPR data portability request.')}
  `;

  return transactionalTemplate(content, 'Your data export is ready for download');
}
