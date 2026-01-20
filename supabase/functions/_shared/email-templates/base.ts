/**
 * Base Email Template
 *
 * Wraps all emails with consistent structure, header, and footer.
 */

import {
  colors,
  fonts,
  fontSizes,
  fontWeights,
  spacing,
  layout,
  brand,
} from './tokens.ts';

export type HeaderVariant = 'minimal' | 'branded' | 'alert';

interface BaseTemplateOptions {
  /** Header variant */
  header?: HeaderVariant;
  /** Custom header color (for alert variant) */
  headerColor?: string;
  /** Show preferences link in footer */
  showPreferences?: boolean;
  /** Preferences URL */
  preferencesUrl?: string;
  /** Preview text (shows in email client list view) */
  previewText?: string;
}

/**
 * Generate the MOLITICO. wordmark
 */
function wordmark(inverted = false): string {
  const textColor = inverted ? '#ffffff' : colors.text;
  const dotColor = inverted ? '#ffffff' : colors.primary;

  return `
    <span style="font-family: ${fonts.primary};
                 font-size: ${fontSizes.xl};
                 font-weight: ${fontWeights.bold};
                 color: ${textColor};
                 letter-spacing: 1px;">
      ${brand.name}<span style="color: ${dotColor};">.</span>
    </span>
  `;
}

/**
 * Minimal header - wordmark with thin accent line
 */
function minimalHeader(): string {
  return `
    <div style="border-top: 4px solid ${colors.primary};
                padding: ${spacing.lg} 0 ${spacing.md} 0;
                text-align: center;">
      ${wordmark()}
    </div>
  `;
}

/**
 * Branded header - blue background with white wordmark
 */
function brandedHeader(): string {
  return `
    <div style="background-color: ${colors.primary};
                padding: ${spacing.lg};
                text-align: center;
                border-radius: ${layout.borderRadius} ${layout.borderRadius} 0 0;">
      ${wordmark(true)}
    </div>
  `;
}

/**
 * Alert header - colored top bar with wordmark
 */
function alertHeader(color: string): string {
  return `
    <div style="border-top: 6px solid ${color};
                padding: ${spacing.lg} 0 ${spacing.md} 0;
                text-align: center;">
      ${wordmark()}
    </div>
  `;
}

/**
 * Get header based on variant
 */
function getHeader(variant: HeaderVariant, color?: string): string {
  switch (variant) {
    case 'branded':
      return brandedHeader();
    case 'alert':
      return alertHeader(color || colors.primary);
    case 'minimal':
    default:
      return minimalHeader();
  }
}

/**
 * Footer component
 */
function footer(showPreferences: boolean, preferencesUrl?: string): string {
  const year = brand.copyrightYear;

  const preferencesLink = showPreferences && preferencesUrl
    ? `<a href="${preferencesUrl}"
          style="color: ${colors.textMuted};
                 text-decoration: underline;">
         Manage preferences
       </a>
       <span style="color: ${colors.textMuted};"> • </span>`
    : '';

  return `
    <div style="border-top: 1px solid ${colors.border};
                margin-top: ${spacing.xl};
                padding-top: ${spacing.lg};
                text-align: center;">
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.xs};
                margin: 0;">
        © ${year} ${brand.name}. All rights reserved.
      </p>
      <p style="color: ${colors.textMuted};
                font-family: ${fonts.primary};
                font-size: ${fontSizes.xs};
                margin: ${spacing.xs} 0 0 0;">
        ${preferencesLink}
        <a href="mailto:support@molitico.com"
           style="color: ${colors.textMuted};
                  text-decoration: underline;">
          Contact support
        </a>
      </p>
    </div>
  `;
}

/**
 * Base email template wrapper
 *
 * @param content - The email body content (HTML string)
 * @param options - Template options
 * @returns Complete HTML email string
 */
export function baseTemplate(
  content: string,
  options: BaseTemplateOptions = {}
): string {
  const {
    header = 'minimal',
    headerColor,
    showPreferences = false,
    preferencesUrl,
    previewText,
  } = options;

  // Hidden preview text for email clients
  const previewTextHtml = previewText
    ? `<div style="display: none; max-height: 0; overflow: hidden;">
         ${previewText}
         ${'&nbsp;'.repeat(100)}
       </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="x-apple-disable-message-reformatting">
  <title>${brand.name}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Reset styles */
    body, table, td, p, a, li { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }

    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      .email-body { background-color: #1a1a1a !important; }
      .email-container { background-color: #2d2d2d !important; }
    }

    /* Responsive */
    @media only screen and (max-width: 620px) {
      .email-container { width: 100% !important; padding: 16px !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0;
             padding: 0;
             background-color: ${colors.background};
             font-family: ${fonts.primary};">
  ${previewTextHtml}

  <!-- Email wrapper -->
  <table role="presentation"
         cellpadding="0"
         cellspacing="0"
         border="0"
         width="100%"
         class="email-body"
         style="background-color: ${colors.background};">
    <tr>
      <td align="center" style="padding: ${spacing.lg};">

        <!-- Email container -->
        <table role="presentation"
               cellpadding="0"
               cellspacing="0"
               border="0"
               width="${layout.maxWidth}"
               class="email-container"
               style="max-width: ${layout.maxWidth};
                      width: 100%;
                      background-color: ${colors.surface};
                      border-radius: ${layout.borderRadius};
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 0;">

              <!-- Header -->
              ${getHeader(header, headerColor)}

              <!-- Content -->
              <div style="padding: ${spacing.lg};">
                ${content}
              </div>

              <!-- Footer -->
              <div style="padding: 0 ${spacing.lg} ${spacing.lg} ${spacing.lg};">
                ${footer(showPreferences, preferencesUrl)}
              </div>

            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Convenience function for transactional emails
 */
export function transactionalTemplate(content: string, previewText?: string): string {
  return baseTemplate(content, {
    header: 'minimal',
    previewText,
  });
}

/**
 * Convenience function for invitation emails
 */
export function invitationTemplate(content: string, previewText?: string): string {
  return baseTemplate(content, {
    header: 'branded',
    previewText,
  });
}

/**
 * Convenience function for alert emails
 */
export function alertTemplate(
  content: string,
  severityColor: string,
  previewText?: string
): string {
  return baseTemplate(content, {
    header: 'alert',
    headerColor: severityColor,
    showPreferences: true,
    preferencesUrl: '{{PREFERENCES_URL}}', // To be replaced by caller
    previewText,
  });
}

/**
 * Convenience function for report emails
 */
export function reportTemplate(
  content: string,
  previewText?: string,
  preferencesUrl?: string
): string {
  return baseTemplate(content, {
    header: 'minimal',
    showPreferences: true,
    preferencesUrl,
    previewText,
  });
}
