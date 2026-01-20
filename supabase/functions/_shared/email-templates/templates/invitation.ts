/**
 * Invitation Email Templates
 *
 * User invitations, admin invitations.
 * Stronger brand presence, welcoming tone, conversion-focused.
 */

import { invitationTemplate } from '../base.ts';
import {
  heading,
  paragraph,
  button,
  infoBox,
  smallText,
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

  const titleText = isReminder ? 'Invitation Reminder' : "You're Invited!";

  const roleText = isPlatformAdmin
    ? `You've been invited to become a <strong>Platform Admin</strong> with full system access.`
    : `You've been invited to join <strong>${escapeHtml(organizationName || 'the organization')}</strong> as a <strong>${escapeHtml(role || 'member')}</strong>.`;

  const inviterText = inviterName
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
        ${titleText}
      </h1>
      <p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.5;
                margin: 0 0 ${spacing.lg} 0;">
        ${roleText}
      </p>
      ${inviterText}
      <div style="margin: ${spacing.lg} 0;">
        ${button('Accept Invitation', inviteUrl, 'primary')}
      </div>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: ${spacing.lg} 0 0 0;">
        This invitation expires in ${expiresIn}.
      </p>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.xs};
                margin: ${spacing.sm} 0 0 0;">
        If the button doesn't work, copy this link:<br>
        <span style="word-break: break-all;">${escapeHtml(inviteUrl)}</span>
      </p>
    </div>
  `;

  const previewText = isPlatformAdmin
    ? "You've been invited as a Platform Admin"
    : `You've been invited to join ${organizationName || 'an organization'}`;

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
    ? `<p style="color: ${colors.textSecondary};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.base};
                line-height: 1.5;
                margin: 0 0 ${spacing.lg} 0;
                font-style: italic;">
         "${escapeHtml(customMessage)}"
       </p>`
    : '';

  const inviterText = inviterName
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
        You're Invited to Join as an Administrator
      </h1>
      ${messageSection}
      ${inviterText}
      <div style="background-color: ${colors.background};
                  border-radius: 8px;
                  padding: ${spacing.md};
                  margin: ${spacing.lg} 0;">
        <p style="color: ${colors.textMuted};
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  margin: 0 0 8px 0;">
          Your invitation code:
        </p>
        <p style="color: ${colors.text};
                  font-family: ${fonts.mono};
                  font-size: ${fontSizes.xl};
                  font-weight: ${fontWeights.bold};
                  letter-spacing: 2px;
                  margin: 0;">
          ${escapeHtml(inviteCode)}
        </p>
      </div>
      <div style="margin: ${spacing.lg} 0;">
        ${button('Accept Invitation', inviteUrl, 'primary')}
      </div>
      <div style="background-color: #fef3cd;
                  border-left: 4px solid ${colors.warning};
                  border-radius: 4px;
                  padding: ${spacing.md};
                  margin: ${spacing.lg} 0;
                  text-align: left;">
        <p style="color: #856404;
                  font-family: ${fonts.primary};
                  font-size: ${fontSizes.sm};
                  margin: 0;">
          <strong>Security notice:</strong> This is a single-use code. Do not share it with anyone.
        </p>
      </div>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.sm};
                margin: ${spacing.lg} 0 0 0;">
        This invitation expires in ${expiresIn}.
      </p>
    </div>
  `;

  return invitationTemplate(content, "You've been invited as an Administrator");
}

/**
 * Reminder version of user invite
 */
export function userInviteReminder(options: Omit<UserInviteOptions, 'isReminder'>): string {
  return userInvite({ ...options, isReminder: true });
}
