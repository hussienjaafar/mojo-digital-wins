/**
 * Email Templates - Main Export
 *
 * Unified email design system for Molitico.
 */

// Design tokens
export * from './tokens.ts';

// Components
export * from './components.ts';

// Base templates
export {
  baseTemplate,
  transactionalTemplate,
  invitationTemplate,
  alertTemplate,
  reportTemplate,
} from './base.ts';

// Template categories
export * as transactional from './templates/transactional.ts';
export * as invitation from './templates/invitation.ts';
export * as alert from './templates/alert.ts';
export * as report from './templates/report.ts';
