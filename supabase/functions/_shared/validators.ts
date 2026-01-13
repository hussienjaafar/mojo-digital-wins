import { z, type ZodError } from "https://deno.land/x/zod@v3.22.4/mod.ts";

export { z };

export const uuidSchema = z.string().uuid();
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected date in YYYY-MM-DD format");

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
