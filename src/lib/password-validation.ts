/**
 * Centralized password validation logic
 * Matches the database validate_password_strength function requirements
 */

export const PASSWORD_REQUIREMENTS = {
  minLength: 12,
  maxLength: 128,
  patterns: {
    lowercase: /[a-z]/,
    uppercase: /[A-Z]/,
    number: /[0-9]/,
    special: /[!@#$%^&*(),.?":{}|<>\-_=+[\]\\;'`~/]/,
  },
} as const;

export interface PasswordRequirements {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  special: boolean;
}

export interface PasswordStrength {
  score: number;
  label: 'Weak' | 'Medium' | 'Strong';
  color: string;
  percentage: number;
}

/**
 * Get individual password requirement statuses
 */
export function getPasswordRequirements(password: string): PasswordRequirements {
  return {
    length: password.length >= PASSWORD_REQUIREMENTS.minLength,
    lowercase: PASSWORD_REQUIREMENTS.patterns.lowercase.test(password),
    uppercase: PASSWORD_REQUIREMENTS.patterns.uppercase.test(password),
    number: PASSWORD_REQUIREMENTS.patterns.number.test(password),
    special: PASSWORD_REQUIREMENTS.patterns.special.test(password),
  };
}

/**
 * Calculate password strength score and metadata
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  const requirements = getPasswordRequirements(password);
  
  let score = 0;
  if (requirements.length) score++;
  if (requirements.lowercase) score++;
  if (requirements.uppercase) score++;
  if (requirements.number) score++;
  if (requirements.special) score++;

  // Bonus for longer passwords
  if (password.length >= 16) score += 0.5;
  if (password.length >= 20) score += 0.5;

  const percentage = Math.min((score / 5) * 100, 100);

  if (score <= 2) {
    return { score, label: 'Weak', color: 'hsl(var(--destructive))', percentage };
  }
  if (score <= 3.5) {
    return { score, label: 'Medium', color: 'hsl(45 93% 47%)', percentage };
  }
  return { score, label: 'Strong', color: 'hsl(142 76% 36%)', percentage };
}

/**
 * Validate password and return validation result with detailed errors
 */
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < PASSWORD_REQUIREMENTS.minLength) {
    errors.push(`Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters`);
  }

  if (password.length > PASSWORD_REQUIREMENTS.maxLength) {
    errors.push(`Password must be less than ${PASSWORD_REQUIREMENTS.maxLength} characters`);
  }

  if (!PASSWORD_REQUIREMENTS.patterns.lowercase.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!PASSWORD_REQUIREMENTS.patterns.uppercase.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!PASSWORD_REQUIREMENTS.patterns.number.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!PASSWORD_REQUIREMENTS.patterns.special.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if all password requirements are met
 */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).valid;
}

/**
 * Get human-readable requirement labels
 */
export const REQUIREMENT_LABELS: Record<keyof PasswordRequirements, string> = {
  length: `At least ${PASSWORD_REQUIREMENTS.minLength} characters`,
  lowercase: 'One lowercase letter',
  uppercase: 'One uppercase letter',
  number: 'One number',
  special: 'One special character (!@#$%...)',
};
