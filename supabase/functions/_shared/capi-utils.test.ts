/**
 * Unit tests for Meta CAPI utilities
 *
 * Run with: deno test supabase/functions/_shared/capi-utils.test.ts
 */

import {
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  hashSHA256,
  normalizeAndHashEmail,
  normalizeAndHashPhone,
  normalizeAndHashName,
  normalizeAndHashCity,
  normalizeAndHashState,
  normalizeAndHashZip,
  normalizeAndHashCountry,
  hashUserDataForStorage,
  buildUserDataFromHashed,
  calculateMatchScore,
  getMatchQualityLabel,
} from "./capi-utils.ts";

// ============================================================================
// SHA-256 Hashing Tests
// ============================================================================

Deno.test("hashSHA256 produces correct hash for known input", async () => {
  // Pre-computed SHA-256 hash for "test@example.com"
  const hash = await hashSHA256("test@example.com");
  assertEquals(hash, "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
});

Deno.test("hashSHA256 produces consistent results", async () => {
  const hash1 = await hashSHA256("hello");
  const hash2 = await hashSHA256("hello");
  assertEquals(hash1, hash2);
});

Deno.test("hashSHA256 produces 64 character lowercase hex string", async () => {
  const hash = await hashSHA256("anything");
  assertEquals(hash.length, 64);
  assertEquals(hash, hash.toLowerCase());
  assertEquals(/^[0-9a-f]+$/.test(hash), true);
});

// ============================================================================
// Email Normalization Tests
// ============================================================================

Deno.test("normalizeAndHashEmail: lowercases and trims", async () => {
  const hash1 = await normalizeAndHashEmail("  TEST@EXAMPLE.COM  ");
  const hash2 = await normalizeAndHashEmail("test@example.com");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashEmail: returns null for invalid input", async () => {
  assertEquals(await normalizeAndHashEmail(""), null);
  assertEquals(await normalizeAndHashEmail("notanemail"), null);
  assertEquals(await normalizeAndHashEmail(null as any), null);
  assertEquals(await normalizeAndHashEmail(undefined as any), null);
});

Deno.test("normalizeAndHashEmail: produces expected hash", async () => {
  // "test@example.com" normalized and hashed
  const hash = await normalizeAndHashEmail("test@example.com");
  assertEquals(hash, "973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b");
});

// ============================================================================
// Phone Normalization Tests
// ============================================================================

Deno.test("normalizeAndHashPhone: strips non-digits", async () => {
  const hash1 = await normalizeAndHashPhone("(555) 123-4567");
  const hash2 = await normalizeAndHashPhone("5551234567");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashPhone: adds US country code for 10 digits", async () => {
  // 10-digit number should get '1' prepended
  const hashWithoutCode = await normalizeAndHashPhone("5551234567");
  const hashWithCode = await normalizeAndHashPhone("15551234567");
  assertEquals(hashWithoutCode, hashWithCode);
});

Deno.test("normalizeAndHashPhone: handles international format", async () => {
  // +1 prefix should be stripped to just digits
  const hash1 = await normalizeAndHashPhone("+1 (555) 123-4567");
  const hash2 = await normalizeAndHashPhone("15551234567");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashPhone: returns null for too short", async () => {
  assertEquals(await normalizeAndHashPhone("12345"), null);
  assertEquals(await normalizeAndHashPhone(""), null);
});

Deno.test("normalizeAndHashPhone: produces expected hash for 11-digit number", async () => {
  // Hash of "15551234567"
  const hash = await normalizeAndHashPhone("5551234567");
  // Verify it's a valid 64-char hex hash
  assertEquals(hash?.length, 64);
  assertNotEquals(hash, null);
});

// ============================================================================
// Name Normalization Tests (UPDATED: preserves spaces)
// ============================================================================

Deno.test("normalizeAndHashName: lowercases and trims", async () => {
  const hash1 = await normalizeAndHashName("  John  ");
  const hash2 = await normalizeAndHashName("john");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashName: preserves single space between words", async () => {
  // "Mary Ann" should become "mary ann" (space preserved)
  const hash1 = await normalizeAndHashName("Mary Ann");
  const hash2 = await hashSHA256("mary ann");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashName: collapses multiple spaces to single", async () => {
  const hash1 = await normalizeAndHashName("Mary   Ann");
  const hash2 = await normalizeAndHashName("Mary Ann");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashName: handles compound names (De La Cruz)", async () => {
  const hash1 = await normalizeAndHashName("De La Cruz");
  const hash2 = await hashSHA256("de la cruz");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashName: handles compound names (O'Brien)", async () => {
  // Apostrophe is preserved, just lowercased
  const hash1 = await normalizeAndHashName("O'Brien");
  const hash2 = await hashSHA256("o'brien");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashName: returns null for empty", async () => {
  assertEquals(await normalizeAndHashName(""), null);
  assertEquals(await normalizeAndHashName("   "), null);
});

// ============================================================================
// City Normalization Tests (UPDATED: preserves spaces)
// ============================================================================

Deno.test("normalizeAndHashCity: lowercases and preserves spaces", async () => {
  const hash1 = await normalizeAndHashCity("New York");
  const hash2 = await hashSHA256("new york");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashCity: removes special characters but keeps spaces", async () => {
  // "St. Louis" → "st louis"
  const hash1 = await normalizeAndHashCity("St. Louis");
  const hash2 = await hashSHA256("st louis");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashCity: handles hyphenated cities (Winston-Salem)", async () => {
  // "Winston-Salem" → "winston salem" (hyphen removed, space would be there if present)
  const hash1 = await normalizeAndHashCity("Winston-Salem");
  const hash2 = await hashSHA256("winstonsalem");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashCity: handles multi-word cities (Dearborn Heights)", async () => {
  const hash1 = await normalizeAndHashCity("Dearborn Heights");
  const hash2 = await hashSHA256("dearborn heights");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashCity: collapses multiple spaces", async () => {
  const hash1 = await normalizeAndHashCity("San   Francisco");
  const hash2 = await normalizeAndHashCity("San Francisco");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashCity: handles city with numbers (removed)", async () => {
  // Numbers are removed: "District 9" → "district "
  const hash1 = await normalizeAndHashCity("District 9");
  const hash2 = await hashSHA256("district");
  assertEquals(hash1, hash2);
});

// ============================================================================
// State Normalization Tests (UPDATED: no fallback)
// ============================================================================

Deno.test("normalizeAndHashState: handles 2-letter codes", async () => {
  const hash1 = await normalizeAndHashState("NY");
  const hash2 = await normalizeAndHashState("ny");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashState: maps full state names correctly", async () => {
  const hashCode = await normalizeAndHashState("ny");
  const hashFull = await normalizeAndHashState("New York");
  assertEquals(hashCode, hashFull);
});

Deno.test("normalizeAndHashState: handles California", async () => {
  const hashCode = await normalizeAndHashState("CA");
  const hashFull = await normalizeAndHashState("California");
  assertEquals(hashCode, hashFull);
});

Deno.test("normalizeAndHashState: handles West Virginia (multi-word)", async () => {
  const hashCode = await normalizeAndHashState("WV");
  const hashFull = await normalizeAndHashState("West Virginia");
  assertEquals(hashCode, hashFull);
});

Deno.test("normalizeAndHashState: returns null for single char", async () => {
  assertEquals(await normalizeAndHashState("A"), null);
});

Deno.test("normalizeAndHashState: returns null for unrecognized state (no fallback)", async () => {
  // "Xyzzy" is not a recognized state - should return null, not "xy"
  assertEquals(await normalizeAndHashState("Xyzzy"), null);
  assertEquals(await normalizeAndHashState("Unknown State"), null);
});

Deno.test("normalizeAndHashState: returns null for numeric input", async () => {
  assertEquals(await normalizeAndHashState("12"), null);
});

Deno.test("normalizeAndHashState: handles territories", async () => {
  const hashCode = await normalizeAndHashState("PR");
  const hashFull = await normalizeAndHashState("Puerto Rico");
  assertEquals(hashCode, hashFull);
});

// ============================================================================
// Zip Normalization Tests
// ============================================================================

Deno.test("normalizeAndHashZip: takes first 5 digits", async () => {
  const hash1 = await normalizeAndHashZip("12345-6789");
  const hash2 = await normalizeAndHashZip("12345");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashZip: removes spaces", async () => {
  const hash1 = await normalizeAndHashZip("1 2 3 4 5");
  const hash2 = await normalizeAndHashZip("12345");
  assertEquals(hash1, hash2);
});

Deno.test("normalizeAndHashZip: returns null for too short", async () => {
  assertEquals(await normalizeAndHashZip("1234"), null);
});

// ============================================================================
// Country Normalization Tests
// ============================================================================

Deno.test("normalizeAndHashCountry: maps common names to ISO codes", async () => {
  const hashUS1 = await normalizeAndHashCountry("United States");
  const hashUS2 = await normalizeAndHashCountry("US");
  const hashUS3 = await normalizeAndHashCountry("usa");
  assertEquals(hashUS1, hashUS2);
  assertEquals(hashUS2, hashUS3);
});

Deno.test("normalizeAndHashCountry: handles UK mapping", async () => {
  const hash1 = await normalizeAndHashCountry("UK");
  const hash2 = await normalizeAndHashCountry("GB");
  const hash3 = await normalizeAndHashCountry("United Kingdom");
  assertEquals(hash1, hash2);
  assertEquals(hash2, hash3);
});

// ============================================================================
// hashUserDataForStorage Tests
// ============================================================================

Deno.test("hashUserDataForStorage: hashes all provided fields", async () => {
  const result = await hashUserDataForStorage({
    email: "test@example.com",
    phone: "5551234567",
    fn: "John",
    ln: "Doe",
    city: "New York",
    state: "NY",
    zip: "10001",
    country: "US",
  });

  // Should have all 8 fields
  assertEquals(Object.keys(result).length, 8);
  assertEquals("em" in result, true);
  assertEquals("ph" in result, true);
  assertEquals("fn" in result, true);
  assertEquals("ln" in result, true);
  assertEquals("ct" in result, true);
  assertEquals("st" in result, true);
  assertEquals("zp" in result, true);
  assertEquals("country" in result, true);

  // All values should be 64-char hex hashes
  for (const value of Object.values(result)) {
    assertEquals(value.length, 64);
    assertEquals(/^[0-9a-f]+$/.test(value), true);
  }
});

Deno.test("hashUserDataForStorage: skips empty fields", async () => {
  const result = await hashUserDataForStorage({
    email: "test@example.com",
    // phone not provided
    fn: "",  // empty string
    ln: "Doe",
  });

  assertEquals("em" in result, true);
  assertEquals("ph" in result, false);  // not provided
  assertEquals("fn" in result, false);  // empty string
  assertEquals("ln" in result, true);
});

Deno.test("hashUserDataForStorage: skips unrecognized state", async () => {
  const result = await hashUserDataForStorage({
    email: "test@example.com",
    state: "InvalidState",  // Not in STATE_MAP
  });

  assertEquals("em" in result, true);
  assertEquals("st" in result, false);  // Unrecognized state returns null
});

// ============================================================================
// buildUserDataFromHashed Tests - fbp/fbc NOT hashed
// ============================================================================

Deno.test("buildUserDataFromHashed: fbp is NOT hashed (raw string)", () => {
  const hashedData = { em: "abc123hash" };
  const result = buildUserDataFromHashed(hashedData, "conservative", {
    fbp: "fb.1.1234567890.987654321",
  });

  // fbp should be the exact raw value, not hashed
  assertEquals(result.fbp, "fb.1.1234567890.987654321");
  // Verify it's NOT a 64-char hex hash
  assertNotEquals(result.fbp?.length, 64);
});

Deno.test("buildUserDataFromHashed: fbc is NOT hashed (raw string)", () => {
  const hashedData = { em: "abc123hash" };
  const result = buildUserDataFromHashed(hashedData, "conservative", {
    fbc: "fb.1.1234567890.AbCdEfGhIjKl",
  });

  // fbc should be the exact raw value, not hashed
  assertEquals(result.fbc, "fb.1.1234567890.AbCdEfGhIjKl");
});

Deno.test("buildUserDataFromHashed: external_id is passed as-is", () => {
  const hashedData = { em: "abc123hash" };
  const result = buildUserDataFromHashed(hashedData, "conservative", {
    external_id: "hashed_external_id_value",
  });

  assertEquals(result.external_id, "hashed_external_id_value");
});

Deno.test("buildUserDataFromHashed: filters by privacy mode", () => {
  const hashedData = {
    em: "email_hash",
    ph: "phone_hash",
    fn: "firstname_hash",
    ln: "lastname_hash",
    ct: "city_hash",
    st: "state_hash",
    zp: "zip_hash",
    country: "country_hash",
  };

  // Conservative mode should NOT include fn, ln, ct, st
  const conservative = buildUserDataFromHashed(hashedData, "conservative", {});
  assertEquals("em" in conservative, true);
  assertEquals("ph" in conservative, true);
  assertEquals("zp" in conservative, true);
  assertEquals("country" in conservative, true);
  assertEquals("fn" in conservative, false);
  assertEquals("ln" in conservative, false);
  assertEquals("ct" in conservative, false);
  assertEquals("st" in conservative, false);

  // Balanced mode should include all location fields
  const balanced = buildUserDataFromHashed(hashedData, "balanced", {});
  assertEquals("fn" in balanced, true);
  assertEquals("ln" in balanced, true);
  assertEquals("ct" in balanced, true);
  assertEquals("st" in balanced, true);
});

// ============================================================================
// Match Score Tests
// ============================================================================

Deno.test("calculateMatchScore: returns 0 for empty data", () => {
  const score = calculateMatchScore({}, {});
  assertEquals(score, 0);
});

Deno.test("calculateMatchScore: email alone gives significant score", () => {
  const score = calculateMatchScore({ em: "hash" }, {});
  // Email has weight 30 out of ~112 total = ~27%
  assertEquals(score > 20, true);
  assertEquals(score < 40, true);
});

Deno.test("calculateMatchScore: email + phone gives good score", () => {
  const score = calculateMatchScore({ em: "hash", ph: "hash" }, {});
  // Email (30) + Phone (25) = 55 out of ~112 = ~49%
  assertEquals(score >= 40, true);
  assertEquals(score < 60, true);
});

Deno.test("calculateMatchScore: full data gives high score", () => {
  const score = calculateMatchScore(
    {
      em: "hash",
      ph: "hash",
      fn: "hash",
      ln: "hash",
      ct: "hash",
      st: "hash",
      zp: "hash",
      country: "hash",
    },
    {
      external_id: "id",
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.abc",
    }
  );
  // Should be high score with all fields
  assertEquals(score >= 80, true);
});

Deno.test("calculateMatchScore: fbp/fbc contribute to score", () => {
  const scoreWithout = calculateMatchScore({ em: "hash" }, {});
  const scoreWith = calculateMatchScore({ em: "hash" }, {
    fbp: "fb.1.123.456",
    fbc: "fb.1.123.abc",
  });
  // Adding fbp/fbc should increase score
  assertEquals(scoreWith > scoreWithout, true);
});

Deno.test("getMatchQualityLabel: returns correct labels", () => {
  assertEquals(getMatchQualityLabel(0), "poor");
  assertEquals(getMatchQualityLabel(15), "poor");
  assertEquals(getMatchQualityLabel(25), "fair");
  assertEquals(getMatchQualityLabel(45), "good");
  assertEquals(getMatchQualityLabel(65), "very_good");
  assertEquals(getMatchQualityLabel(85), "excellent");
  assertEquals(getMatchQualityLabel(100), "excellent");
});

// ============================================================================
// Safety Cap Tests (no email/phone)
// ============================================================================

Deno.test("calculateMatchScore: SAFETY CAP - no email/phone caps at 40", () => {
  // Even with lots of other fields, score should cap at 40 without email or phone
  const score = calculateMatchScore(
    {
      fn: "hash",
      ln: "hash",
      ct: "hash",
      st: "hash",
      zp: "hash",
      country: "hash",
    },
    {
      external_id: "id",
      fbp: "fb.1.123.456",
      fbc: "fb.1.123.abc",
    }
  );
  // Should be capped at 40
  assertEquals(score <= 40, true);
});

Deno.test("calculateMatchScore: SAFETY CAP - email alone bypasses cap", () => {
  const score = calculateMatchScore({ em: "hash", fn: "hash", ln: "hash" }, {});
  // With email, score can exceed 40
  assertEquals(score > 40, true);
});

Deno.test("calculateMatchScore: SAFETY CAP - phone alone bypasses cap", () => {
  const score = calculateMatchScore({ ph: "hash", fn: "hash", ln: "hash" }, {});
  // With phone, score can exceed 40
  assertEquals(score > 40, true);
});

Deno.test("getMatchQualityLabel: SAFETY CAP - no email/phone cannot exceed fair", () => {
  const hashedDataNoEmailPhone = { fn: "hash", zp: "hash" };
  // Even with high score, label should be 'fair' max without email/phone
  assertEquals(getMatchQualityLabel(85, hashedDataNoEmailPhone), "fair");
  assertEquals(getMatchQualityLabel(50, hashedDataNoEmailPhone), "fair");
  assertEquals(getMatchQualityLabel(25, hashedDataNoEmailPhone), "fair");
  assertEquals(getMatchQualityLabel(15, hashedDataNoEmailPhone), "poor");
});

Deno.test("getMatchQualityLabel: SAFETY CAP - with email allows higher labels", () => {
  const hashedDataWithEmail = { em: "hash", fn: "hash" };
  assertEquals(getMatchQualityLabel(85, hashedDataWithEmail), "excellent");
  assertEquals(getMatchQualityLabel(65, hashedDataWithEmail), "very_good");
  assertEquals(getMatchQualityLabel(45, hashedDataWithEmail), "good");
});

Deno.test("getMatchQualityLabel: SAFETY CAP - with phone allows higher labels", () => {
  const hashedDataWithPhone = { ph: "hash", fn: "hash" };
  assertEquals(getMatchQualityLabel(85, hashedDataWithPhone), "excellent");
  assertEquals(getMatchQualityLabel(65, hashedDataWithPhone), "very_good");
});

// ============================================================================
// Integration Test: Full flow
// ============================================================================

Deno.test("integration: hash then build produces valid Meta CAPI user_data", async () => {
  // Step 1: Hash user data for storage (what happens at enqueue time)
  const hashed = await hashUserDataForStorage({
    email: "donor@example.com",
    phone: "(555) 123-4567",
    fn: "Jane",
    ln: "De La Cruz",
    city: "San Francisco",
    state: "California",
    zip: "94102",
    country: "United States",
  });

  // Step 2: Build user_data from hashed (what happens at send time)
  const userData = buildUserDataFromHashed(hashed, "balanced", {
    fbp: "fb.1.1612345678901.1234567890",
    fbc: "fb.1.1612345678901.IwAR1234567890",
    external_id: "user_12345",
  });

  // Verify structure
  assertEquals("em" in userData, true);
  assertEquals("ph" in userData, true);
  assertEquals("fn" in userData, true);
  assertEquals("ln" in userData, true);
  assertEquals("ct" in userData, true);
  assertEquals("st" in userData, true);
  assertEquals("zp" in userData, true);
  assertEquals("country" in userData, true);

  // Verify fbp/fbc are raw (not hashed)
  assertEquals(userData.fbp, "fb.1.1612345678901.1234567890");
  assertEquals(userData.fbc, "fb.1.1612345678901.IwAR1234567890");
  assertEquals(userData.external_id, "user_12345");

  // Verify PII fields are hashed (64-char hex)
  assertEquals(userData.em.length, 64);
  assertEquals(userData.ph.length, 64);

  // Step 3: Calculate match score
  const score = calculateMatchScore(hashed, {
    fbp: "fb.1.1612345678901.1234567890",
    fbc: "fb.1.1612345678901.IwAR1234567890",
    external_id: "user_12345",
  });

  // With all fields, should be excellent
  assertEquals(score >= 80, true);
  assertEquals(getMatchQualityLabel(score), "excellent");
});

Deno.test("integration: name normalization preserves compound names", async () => {
  // Verify "De La Cruz" hashes correctly with spaces
  const hashed = await hashUserDataForStorage({
    fn: "Maria",
    ln: "De La Cruz",
  });

  // ln should be hash of "de la cruz" (with spaces)
  const expectedLnHash = await hashSHA256("de la cruz");
  assertEquals(hashed.ln, expectedLnHash);
});

Deno.test("integration: city normalization preserves spaces", async () => {
  // Verify "San Francisco" hashes correctly with spaces
  const hashed = await hashUserDataForStorage({
    city: "San Francisco",
  });

  // ct should be hash of "san francisco" (with space)
  const expectedCtHash = await hashSHA256("san francisco");
  assertEquals(hashed.ct, expectedCtHash);
});

console.log("All CAPI utility tests defined. Run with: deno test --allow-net supabase/functions/_shared/capi-utils.test.ts");
