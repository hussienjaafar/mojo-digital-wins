/**
 * Unit tests for HMAC signature validation
 * Run with: deno test --allow-env supabase/functions/actblue-webhook/hmac.test.ts
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { computeHmacSignature, validateHmacSignature } from "./index.ts";

Deno.test("computeHmacSignature generates consistent signatures", async () => {
  const body = '{"test": "data"}';
  const secret = "test-secret-key";
  
  const sig1 = await computeHmacSignature(body, secret);
  const sig2 = await computeHmacSignature(body, secret);
  
  assertEquals(sig1, sig2, "Same input should produce same signature");
  assertEquals(sig1.length, 64, "SHA-256 hex should be 64 chars");
});

Deno.test("computeHmacSignature produces different signatures for different secrets", async () => {
  const body = '{"test": "data"}';
  
  const sig1 = await computeHmacSignature(body, "secret-1");
  const sig2 = await computeHmacSignature(body, "secret-2");
  
  assertEquals(sig1 !== sig2, true, "Different secrets should produce different signatures");
});

Deno.test("validateHmacSignature accepts valid signature", async () => {
  const body = '{"lineitems": [], "contribution": {}}';
  const secret = "my-webhook-secret";
  
  const signature = await computeHmacSignature(body, secret);
  const header = `sha256=${signature}`;
  
  const isValid = await validateHmacSignature(header, body, secret);
  assertEquals(isValid, true, "Valid signature should be accepted");
});

Deno.test("validateHmacSignature rejects invalid signature", async () => {
  const body = '{"test": "data"}';
  const secret = "correct-secret";
  
  const header = "sha256=invalid_signature_here";
  
  const isValid = await validateHmacSignature(header, body, secret);
  assertEquals(isValid, false, "Invalid signature should be rejected");
});

Deno.test("validateHmacSignature rejects wrong secret", async () => {
  const body = '{"test": "data"}';
  const correctSecret = "correct-secret";
  const wrongSecret = "wrong-secret";
  
  const signature = await computeHmacSignature(body, wrongSecret);
  const header = `sha256=${signature}`;
  
  const isValid = await validateHmacSignature(header, body, correctSecret);
  assertEquals(isValid, false, "Signature with wrong secret should be rejected");
});

Deno.test("validateHmacSignature rejects null header", async () => {
  const body = '{"test": "data"}';
  const secret = "test-secret";
  
  const isValid = await validateHmacSignature(null, body, secret);
  assertEquals(isValid, false, "Null header should be rejected");
});

Deno.test("validateHmacSignature rejects malformed header", async () => {
  const body = '{"test": "data"}';
  const secret = "test-secret";
  
  // Missing sha256= prefix
  const isValid1 = await validateHmacSignature("just-a-signature", body, secret);
  assertEquals(isValid1, false, "Header without sha256= prefix should be rejected");
  
  // Wrong algorithm prefix
  const isValid2 = await validateHmacSignature("md5=somehash", body, secret);
  assertEquals(isValid2, false, "Header with wrong algorithm should be rejected");
});

Deno.test("validateHmacSignature rejects empty secret", async () => {
  const body = '{"test": "data"}';
  
  const isValid = await validateHmacSignature("sha256=somehash", body, "");
  assertEquals(isValid, false, "Empty secret should be rejected");
});

Deno.test("validateHmacSignature rejects modified body", async () => {
  const originalBody = '{"amount": 100}';
  const modifiedBody = '{"amount": 1000}';
  const secret = "test-secret";
  
  const signature = await computeHmacSignature(originalBody, secret);
  const header = `sha256=${signature}`;
  
  const isValid = await validateHmacSignature(header, modifiedBody, secret);
  assertEquals(isValid, false, "Modified body should be rejected");
});
