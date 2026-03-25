/**
 * Unit tests for validation schemas
 * Run with: deno test --allow-env supabase/functions/_shared/validators.test.ts
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  emailSchema,
  orgRoleSchema,
  invitationTypeSchema,
  passwordSchema,
  userInvitationSchema,
  adminInviteSchema,
  uuidSchema,
} from "./validators.ts";

// ============================================
// Email Schema Tests
// ============================================

Deno.test("emailSchema accepts valid email", () => {
  const result = emailSchema.safeParse("user@example.com");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data, "user@example.com");
  }
});

Deno.test("emailSchema normalizes email to lowercase", () => {
  const result = emailSchema.safeParse("USER@EXAMPLE.COM");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data, "user@example.com");
  }
});

Deno.test("emailSchema trims whitespace", () => {
  const result = emailSchema.safeParse("  user@example.com  ");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data, "user@example.com");
  }
});

Deno.test("emailSchema removes dangerous characters", () => {
  const result = emailSchema.safeParse("user@example.com\r\n");
  assertEquals(result.success, true);
  if (result.success) {
    assertEquals(result.data, "user@example.com");
  }
});

Deno.test("emailSchema rejects empty string", () => {
  const result = emailSchema.safeParse("");
  assertEquals(result.success, false);
});

Deno.test("emailSchema rejects invalid format", () => {
  const invalidEmails = [
    "notanemail",
    "@example.com",
    "user@",
    "user@.com",
    "user@@example.com",
  ];

  for (const email of invalidEmails) {
    const result = emailSchema.safeParse(email);
    assertEquals(result.success, false, `Expected "${email}" to be invalid`);
  }
});

Deno.test("emailSchema rejects emails over 255 characters", () => {
  const longEmail = "a".repeat(250) + "@example.com";
  const result = emailSchema.safeParse(longEmail);
  assertEquals(result.success, false);
});

// ============================================
// Organization Role Schema Tests
// ============================================

Deno.test("orgRoleSchema accepts valid roles", () => {
  const validRoles = ['admin', 'manager', 'viewer'];

  for (const role of validRoles) {
    const result = orgRoleSchema.safeParse(role);
    assertEquals(result.success, true, `Expected "${role}" to be valid`);
  }
});

Deno.test("orgRoleSchema rejects invalid roles", () => {
  const invalidRoles = ['owner', 'superadmin', 'guest', 'ADMIN', ''];

  for (const role of invalidRoles) {
    const result = orgRoleSchema.safeParse(role);
    assertEquals(result.success, false, `Expected "${role}" to be invalid`);
  }
});

// ============================================
// Invitation Type Schema Tests
// ============================================

Deno.test("invitationTypeSchema accepts valid types", () => {
  const validTypes = ['platform_admin', 'organization_member'];

  for (const type of validTypes) {
    const result = invitationTypeSchema.safeParse(type);
    assertEquals(result.success, true, `Expected "${type}" to be valid`);
  }
});

Deno.test("invitationTypeSchema rejects invalid types", () => {
  const invalidTypes = ['admin', 'member', 'org_admin', ''];

  for (const type of invalidTypes) {
    const result = invitationTypeSchema.safeParse(type);
    assertEquals(result.success, false, `Expected "${type}" to be invalid`);
  }
});

// ============================================
// Password Schema Tests
// ============================================

Deno.test("passwordSchema accepts valid passwords", () => {
  const validPasswords = [
    "123456789012", // exactly 12 chars
    "a".repeat(128), // exactly 128 chars
    "SecurePassword123!",
    "my-very-secure-password",
  ];

  for (const password of validPasswords) {
    const result = passwordSchema.safeParse(password);
    assertEquals(result.success, true, `Expected password of length ${password.length} to be valid`);
  }
});

Deno.test("passwordSchema rejects passwords under 12 characters", () => {
  const shortPasswords = ["", "short", "12345678901"]; // 0, 5, 11 chars

  for (const password of shortPasswords) {
    const result = passwordSchema.safeParse(password);
    assertEquals(result.success, false, `Expected password of length ${password.length} to be invalid`);
  }
});

Deno.test("passwordSchema rejects passwords over 128 characters", () => {
  const longPassword = "a".repeat(129);
  const result = passwordSchema.safeParse(longPassword);
  assertEquals(result.success, false);
});

// ============================================
// User Invitation Schema Tests
// ============================================

Deno.test("userInvitationSchema accepts platform_admin invitation", () => {
  const result = userInvitationSchema.safeParse({
    email: "admin@example.com",
    type: "platform_admin",
  });
  assertEquals(result.success, true);
});

Deno.test("userInvitationSchema accepts organization_member invitation", () => {
  const result = userInvitationSchema.safeParse({
    email: "user@example.com",
    type: "organization_member",
    organization_id: "550e8400-e29b-41d4-a716-446655440000",
    role: "viewer",
  });
  assertEquals(result.success, true);
});

Deno.test("userInvitationSchema requires organization_id for org invites", () => {
  const result = userInvitationSchema.safeParse({
    email: "user@example.com",
    type: "organization_member",
    role: "viewer",
  });
  assertEquals(result.success, false);
});

Deno.test("userInvitationSchema requires role for org invites", () => {
  const result = userInvitationSchema.safeParse({
    email: "user@example.com",
    type: "organization_member",
    organization_id: "550e8400-e29b-41d4-a716-446655440000",
  });
  assertEquals(result.success, false);
});

Deno.test("userInvitationSchema rejects invalid email", () => {
  const result = userInvitationSchema.safeParse({
    email: "not-an-email",
    type: "platform_admin",
  });
  assertEquals(result.success, false);
});

Deno.test("userInvitationSchema rejects invalid organization_id format", () => {
  const result = userInvitationSchema.safeParse({
    email: "user@example.com",
    type: "organization_member",
    organization_id: "not-a-uuid",
    role: "viewer",
  });
  assertEquals(result.success, false);
});

// ============================================
// Admin Invite Schema Tests
// ============================================

Deno.test("adminInviteSchema accepts valid input", () => {
  const result = adminInviteSchema.safeParse({
    email: "admin@example.com",
    inviteCode: "ABC123",
  });
  assertEquals(result.success, true);
});

Deno.test("adminInviteSchema accepts optional fields", () => {
  const result = adminInviteSchema.safeParse({
    email: "admin@example.com",
    inviteCode: "ABC123",
    inviterName: "John Doe",
    templateId: "550e8400-e29b-41d4-a716-446655440000",
  });
  assertEquals(result.success, true);
});

Deno.test("adminInviteSchema requires inviteCode", () => {
  const result = adminInviteSchema.safeParse({
    email: "admin@example.com",
  });
  assertEquals(result.success, false);
});

Deno.test("adminInviteSchema rejects empty inviteCode", () => {
  const result = adminInviteSchema.safeParse({
    email: "admin@example.com",
    inviteCode: "",
  });
  assertEquals(result.success, false);
});

// ============================================
// UUID Schema Tests
// ============================================

Deno.test("uuidSchema accepts valid UUIDs", () => {
  const validUuids = [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "00000000-0000-0000-0000-000000000000",
  ];

  for (const uuid of validUuids) {
    const result = uuidSchema.safeParse(uuid);
    assertEquals(result.success, true, `Expected "${uuid}" to be valid`);
  }
});

Deno.test("uuidSchema rejects invalid UUIDs", () => {
  const invalidUuids = [
    "",
    "not-a-uuid",
    "550e8400-e29b-41d4-a716", // too short
    "550e8400-e29b-41d4-a716-446655440000-extra", // too long
    "550e8400-e29b-41d4-a716-44665544000g", // invalid character
  ];

  for (const uuid of invalidUuids) {
    const result = uuidSchema.safeParse(uuid);
    assertEquals(result.success, false, `Expected "${uuid}" to be invalid`);
  }
});
