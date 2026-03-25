import { z, type ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export { z };

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

// ============================================
// Auth-related validation schemas
// ============================================

/**
 * Email validation with sanitization
 * - Validates format
 * - Normalizes to lowercase
 * - Removes dangerous characters
 */
export const emailSchema = z.string()
  .min(1, "Email is required")
  .max(255, "Email must be less than 255 characters")
  .email("Invalid email format")
  .transform(s => s.toLowerCase().trim().replace(/[\r\n\x00]/g, ''));

/**
 * Organization role validation
 */
export const orgRoleSchema = z.enum(['admin', 'manager', 'viewer'], {
  errorMap: () => ({ message: "Role must be 'admin', 'manager', or 'viewer'" })
});

/**
 * Invitation type validation
 */
export const invitationTypeSchema = z.enum(['platform_admin', 'organization_member'], {
  errorMap: () => ({ message: "Type must be 'platform_admin' or 'organization_member'" })
});

/**
 * Password validation (basic - actual strength check done in DB function)
 */
export const passwordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be less than 128 characters");

/**
 * Strong password validation matching database validate_password_strength function
 * Used for invitation signup and password reset flows
 */
export const strongPasswordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be less than 128 characters")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[!@#$%^&*(),.?":{}|<>\-_=+[\]\\;'`~/]/, "Password must contain at least one special character");

/**
 * Schema for reset password requests
 */
export const resetPasswordRequestSchema = z.object({
  user_id: uuidSchema,
});

/**
 * Invitation action validation
 */
export const invitationActionSchema = z.enum(['send', 'resend'], {
  errorMap: () => ({ message: "Action must be 'send' or 'resend'" })
}).default('send');

/**
 * Schema for user invitation requests
 */
export const userInvitationSchema = z.object({
  email: emailSchema,
  type: invitationTypeSchema,
  organization_id: uuidSchema.nullish().transform(val => val ?? undefined),
  role: orgRoleSchema.nullish().transform(val => val ?? undefined),
  action: invitationActionSchema,
}).refine(
  (data) => {
    // If type is organization_member, organization_id and role are required (only for new invitations)
    if (data.action === 'send' && data.type === 'organization_member') {
      return data.organization_id && data.role;
    }
    return true;
  },
  { message: "Organization ID and role are required for organization invitations" }
);

/**
 * Schema for admin invite requests
 */
export const adminInviteSchema = z.object({
  email: emailSchema,
  inviteCode: z.string().min(1, "Invite code is required"),
  inviterName: z.string().max(255).optional(),
  templateId: uuidSchema.optional(),
});

/**
 * Schema for unlock account requests
 */
export const unlockAccountSchema = z.object({
  email: emailSchema,
});

/**
 * Schema for terminate sessions requests
 */
export const terminateSessionsSchema = z.object({
  user_id: uuidSchema,
  reason: z.string().max(255).optional(),
});

export function zodErrorDetails(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

type ParseOptions = {
  allowEmpty?: boolean;
  allowInvalidJson?: boolean;
};

/**
 * Parse JSON request bodies safely and validate with a Zod schema.
 * - allowEmpty: if body is missing/empty, treat as `{}`
 * - allowInvalidJson: if body is present but invalid JSON, treat as `{}`
 */
export async function parseJsonBody<TSchema extends z.ZodTypeAny>(
  req: Request,
  schema: TSchema,
  options: ParseOptions = {}
): Promise<
  | { ok: true; data: z.infer<TSchema> }
  | { ok: false; error: string; details?: Array<{ path: string; message: string }> }
> {
  const allowEmpty = options.allowEmpty ?? true;
  const allowInvalidJson = options.allowInvalidJson ?? false;

  let raw: unknown = {};

  try {
    // Most edge functions are POST/PUT. If there's no body, req.json() throws.
    raw = await req.json();
  } catch (_e) {
    // If empty or invalid JSON is allowed, fall back to {} and let schema decide.
    if (allowEmpty || allowInvalidJson) {
      raw = {};
    } else {
      return { ok: false, error: "Invalid JSON body" };
    }
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Invalid input parameters",
      details: zodErrorDetails(parsed.error),
    };
  }

  return { ok: true, data: parsed.data };
}
