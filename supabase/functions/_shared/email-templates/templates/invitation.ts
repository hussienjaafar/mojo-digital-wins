/**
 * Invitation Email Templates
 *
 * User invitations, admin invitations.
 * Stronger brand presence, welcoming tone, conversion-focused.
 * V3 Design System aligned.
 */

import { invitationTemplate } from '../base.ts';
import {
  heading,
  paragraph,
  button,
  infoBox,
  smallText,
  noticeBox,
  escapeHtml,
} from '../components.ts';
import { colors, spacing, fonts, fontSizes, fontWeights } from '../tokens.ts';

interface UserInviteOptions {
  email: string;
  inviteUrl: string;
  invitationType: 'platform_admin' | 'organization_member';
  organizationName?: string;
  role?: string;
  inviterName?: string;
  expiresIn?: string;
  isReminder?: boolean;
}

/**
 * User invitation email (platform admin or organization member)
 */
export function userInvite(options: UserInviteOptions): string {
  const {
    email,
    inviteUrl,
    invitationType,
    organizationName,
    role,
    inviterName,
    expiresIn = '7 days',
    isReminder = false,
  } = options;

  const isPlatformAdmin = invitationType === 'platform_admin';

  // More personalized greeting based on context
  const greetingText = inviterName
    ? `${escapeHtml(inviterName)} has invited you to join`
    : "You've been invited to join";

  const titleText = isReminder ? "Friendly Reminder: You're Invited!" : "You're Invited!";

  const roleDescription = isPlatformAdmin
    ? `the <strong>MOLITICO.</strong> platform as a <strong>Platform Administrator</strong>. You'll have full access to manage users, organizations, and system settings.`
    : `<strong>${escapeHtml(organizationName || 'the team')}</strong> as a <strong>${escapeHtml(role || 'team member')}</strong>.`;

  const whatToExpect = isPlatformAdmin
    ? `
      <div style="background-color: ${colors.background};
                  border-radius: 8px;
                  padding: ${spacing.md};
                  margin: ${spacing.lg} 0;
                  text-align: left;">
        <p style="color: ${colors.text};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  font-weight: ${fontWeights.semibold};
                  margin: 0 0 ${spacing.sm} 0;">
          What you'll get access to:
        </p>
        <ul style="color: ${colors.textSecondary};
                   font-family: ${fonts.primary};
                   font-size: ${fontSizes.sm};
                   margin: 0;
                   padding-left: 20px;">
          <li style="margin-bottom: 4px;">User and organization management</li>
          <li style="margin-bottom: 4px;">System-wide analytics and reporting</li>
          <li style="margin-bottom: 4px;">Security and compliance settings</li>
          <li style="margin-bottom: 0;">Platform configuration and integrations</li>
        </ul>
      </div>
    `
    : '';

  const content = `
    <div style="text-align: center; padding: ${spacing.md} 0;">
      <h1 style="color: ${colors.text};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes['2xl']};
                 font-weight: ${fontWeights.bold};
                 margin: 0 0 ${spacing.sm} 0;">
        ${titleText}
      </h1>
      <p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.6;
                margin: 0 0 ${spacing.md} 0;">
        ${greetingText} ${roleDescription}
      </p>
      ${whatToExpect}
      <div style="margin: ${spacing.lg} 0;">
        ${button('Accept Invitation', inviteUrl, 'primary')}
      </div>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: ${spacing.lg} 0 0 0;">
        This invitation expires in <strong>${expiresIn}</strong>.
      </p>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.xs};
                margin: ${spacing.sm} 0 0 0;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="word-break: break-all; color: ${colors.primary};">${escapeHtml(inviteUrl)}</span>
      </p>
    </div>
  `;

  const previewText = isPlatformAdmin
    ? `${inviterName ? `${inviterName} invited you` : "You've been invited"} to join MOLITICO. as a Platform Admin`
    : `${inviterName ? `${inviterName} invited you` : "You've been invited"} to join ${organizationName || 'the team'}`;

  return invitationTemplate(content, previewText);
}

interface AdminInviteOptions {
  email: string;
  inviteUrl: string;
  inviteCode: string;
  inviterName?: string;
  customMessage?: string;
  expiresIn?: string;
}

/**
 * Admin invitation with invite code
 */
export function adminInvite(options: AdminInviteOptions): string {
  const {
    email,
    inviteUrl,
    inviteCode,
    inviterName,
    customMessage,
    expiresIn = '7 days',
  } = options;

  const messageSection = customMessage
    ? `
      <div style="background-color: ${colors.background};
                  border-left: 4px solid ${colors.primary};
                  border-radius: 0 8px 8px 0;
                  padding: ${spacing.md};
                  margin: 0 0 ${spacing.lg} 0;
                  text-align: left;">
        <p style="color: ${colors.textSecondary};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.base};
                  line-height: 1.6;
                  margin: 0;
                  font-style: italic;">
          "${escapeHtml(customMessage)}"
        </p>
        ${inviterName ? `
          <p style="color: ${colors.textMuted};
                    font-family: ${fonts.primary};
                    font-size: ${fontSizes.sm};
                    margin: ${spacing.sm} 0 0 0;">
            — ${escapeHtml(inviterName)}
          </p>
        ` : ''}
      </div>
    `
    : '';

  const inviterText = !customMessage && inviterName
    ? `<p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: ${spacing.md} 0;">
         Invited by ${escapeHtml(inviterName)}
       </p>`
    : '';

  const content = `
    <div style="text-align: center; padding: ${spacing.md} 0;">
      <h1 style="color: ${colors.text};
                 font-family: ${fonts.primary};
                 font-size: ${fontSizes['2xl']};
                 font-weight: ${fontWeights.bold};
                 margin: 0 0 ${spacing.md} 0;">
        Welcome to the Admin Team
      </h1>
      <p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.6;
                margin: 0 0 ${spacing.lg} 0;">
        You've been selected to join as an <strong>Administrator</strong> with elevated access and responsibilities.
      </p>
      ${messageSection}
      ${inviterText}
      <div style="background-color: ${colors.background};
                  border-radius: 12px;
                  padding: ${spacing.lg};
                  margin: ${spacing.lg} 0;">
        <p style="color: ${colors.textMuted};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  margin: 0 0 8px 0;">
          Your secure invitation code:
        </p>
        <p style="color: ${colors.text};
                  font-family: ${fonts.mono};
                  font-size: 28px;
                  font-weight: ${fontWeights.bold};
                  letter-spacing: 4px;
                  margin: 0;
                  padding: ${spacing.sm} 0;">
          ${escapeHtml(inviteCode)}
        </p>
      </div>
      <div style="margin: ${spacing.lg} 0;">
        ${button('Accept & Get Started', inviteUrl, 'primary')}
      </div>
      ${noticeBox(
        '<strong>🔒 Security Notice:</strong> This is a single-use invitation code. Do not share it with anyone. If you did not expect this invitation, please ignore this email.',
        'warning'
      )}
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: ${spacing.lg} 0 0 0;">
        This invitation expires in <strong>${expiresIn}</strong>.
      </p>
    </div>
  `;

  const previewText = inviterName
    ? `${inviterName} invited you to join MOLITICO. as an Administrator`
    : "You've been invited to join MOLITICO. as an Administrator";

  return invitationTemplate(content, previewText);
}

/**
 * Reminder version of user invite
 */
export function userInviteReminder(options: Omit<UserInviteOptions, 'isReminder'>): string {
  return userInvite({ ...options, isReminder: true });
}
