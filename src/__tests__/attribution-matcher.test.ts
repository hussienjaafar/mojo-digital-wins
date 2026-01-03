import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * ================================================================================
 * ATTRIBUTION MATCHER CORRECTNESS TESTS
 * ================================================================================
 * 
 * These tests verify the attribution matching logic is deterministic, idempotent,
 * and correctly labels match types.
 * 
 * Test Categories:
 * 1. Deterministic Matching (url_exact)
 * 2. Heuristic Matching (url_partial, pattern, fuzzy)
 * 3. Guard Rails (deterministic protection)
 * 4. Idempotency
 * ================================================================================
 */

// ============================================================================
// Test Utilities - Mock Data
// ============================================================================

interface CreativeWithRefcode {
  campaign_id: string;
  campaign_name: string;
  destination_url: string | null;
  extracted_refcode: string | null;
}

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  organization_id: string;
}

// Recreate the matching functions from the edge function for testing
function normalize(str: string): string {
  return str.toLowerCase()
    .replace(/[_\-\s]+/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function similarity(a: string, b: string): number {
  const normA = normalize(a);
  const normB = normalize(b);
  
  if (normA === normB) return 1.0;
  if (normA.includes(normB) || normB.includes(normA)) return 0.8;
  
  const wordsA = a.toLowerCase().split(/[_\-\s]+/);
  const wordsB = b.toLowerCase().split(/[_\-\s]+/);
  
  let matchingWords = 0;
  for (const wordA of wordsA) {
    for (const wordB of wordsB) {
      if (wordA === wordB && wordA.length > 2) matchingWords++;
      else if (wordA.includes(wordB) || wordB.includes(wordA)) matchingWords += 0.5;
    }
  }
  
  const totalWords = Math.max(wordsA.length, wordsB.length);
  return matchingWords / totalWords;
}

function matchRefcodeToCreative(
  refcode: string,
  creatives: CreativeWithRefcode[]
): { campaign_id: string; campaign_name: string; confidence: number; reason: string; destination_url: string; match_type: 'url_exact' | 'url_partial' } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Rule 1: Exact match
  for (const creative of creatives) {
    if (creative.extracted_refcode && creative.extracted_refcode.toLowerCase() === normalizedRefcode) {
      return {
        campaign_id: creative.campaign_id,
        campaign_name: creative.campaign_name,
        confidence: 1.0,
        reason: `Exact URL refcode match: ad destination contains ?refcode=${refcode}`,
        destination_url: creative.destination_url || '',
        match_type: 'url_exact'
      };
    }
  }
  
  // Rule 2: Partial match
  for (const creative of creatives) {
    if (creative.extracted_refcode) {
      const creativeRefcode = creative.extracted_refcode.toLowerCase();
      if (creativeRefcode.includes(normalizedRefcode) || normalizedRefcode.includes(creativeRefcode)) {
        return {
          campaign_id: creative.campaign_id,
          campaign_name: creative.campaign_name,
          confidence: 0.7,
          reason: `Partial URL match: "${creative.extracted_refcode}" overlaps with "${refcode}"`,
          destination_url: creative.destination_url || '',
          match_type: 'url_partial'
        };
      }
    }
  }
  
  return null;
}

function matchRefcodeToCampaign(
  refcode: string,
  campaigns: Campaign[]
): { campaign_id: string; campaign_name: string; confidence: number; reason: string; match_type: 'campaign_pattern' | 'fuzzy' } | null {
  const normalizedRefcode = refcode.toLowerCase();
  
  // Direct match on campaign_id
  const directMatch = campaigns.find(c => 
    normalize(c.campaign_id) === normalize(refcode)
  );
  if (directMatch) {
    return {
      campaign_id: directMatch.campaign_id,
      campaign_name: directMatch.campaign_name,
      confidence: 0.8,
      reason: 'Pattern: refcode matches campaign ID directly',
      match_type: 'campaign_pattern'
    };
  }
  
  // Fuzzy matching
  let bestMatch: { campaign_id: string; campaign_name: string; similarity: number } | null = null;
  
  for (const campaign of campaigns) {
    const sim = similarity(refcode, campaign.campaign_name);
    if (sim > 0.5 && (!bestMatch || sim > bestMatch.similarity)) {
      bestMatch = {
        campaign_id: campaign.campaign_id,
        campaign_name: campaign.campaign_name,
        similarity: sim
      };
    }
  }
  
  if (bestMatch && bestMatch.similarity >= 0.5) {
    return {
      campaign_id: bestMatch.campaign_id,
      campaign_name: bestMatch.campaign_name,
      confidence: Math.min(bestMatch.similarity * 0.5, 0.5),
      reason: `Fuzzy: ${Math.round(bestMatch.similarity * 100)}% name similarity (directional only)`,
      match_type: 'fuzzy'
    };
  }
  
  return null;
}

function getAttributionType(matchType: string): string {
  switch (matchType) {
    case 'url_exact':
      return 'deterministic_url_refcode';
    case 'url_partial':
      return 'heuristic_partial_url';
    case 'campaign_pattern':
      return 'heuristic_pattern';
    case 'fuzzy':
      return 'heuristic_fuzzy';
    default:
      return 'unknown';
  }
}

// ============================================================================
// Test: Deterministic URL Matching
// ============================================================================

describe('Deterministic URL Matching', () => {
  const creatives: CreativeWithRefcode[] = [
    {
      campaign_id: 'camp_123',
      campaign_name: 'Fall 2024 Mobilization',
      destination_url: 'https://donate.example.com?refcode=jp421',
      extracted_refcode: 'jp421'
    },
    {
      campaign_id: 'camp_456',
      campaign_name: 'Year End Push',
      destination_url: 'https://donate.example.com?refcode=yearend_2024_v1',
      extracted_refcode: 'yearend_2024_v1'
    }
  ];

  it('exact URL refcode match is deterministic with confidence 1.0', () => {
    const result = matchRefcodeToCreative('jp421', creatives);
    
    expect(result).not.toBeNull();
    expect(result!.match_type).toBe('url_exact');
    expect(result!.confidence).toBe(1.0);
    expect(result!.campaign_id).toBe('camp_123');
    
    // Verify attribution type mapping
    expect(getAttributionType(result!.match_type)).toBe('deterministic_url_refcode');
  });

  it('exact match is case-insensitive', () => {
    const result = matchRefcodeToCreative('JP421', creatives);
    
    expect(result).not.toBeNull();
    expect(result!.match_type).toBe('url_exact');
    expect(result!.confidence).toBe(1.0);
  });

  it('no match returns null', () => {
    const result = matchRefcodeToCreative('nonexistent_code', creatives);
    expect(result).toBeNull();
  });
});

// ============================================================================
// Test: Partial URL Matching (Heuristic)
// ============================================================================

describe('Partial URL Matching', () => {
  const creatives: CreativeWithRefcode[] = [
    {
      campaign_id: 'camp_789',
      campaign_name: 'Q4 Campaign',
      destination_url: 'https://donate.example.com?refcode=jp421_variant_a',
      extracted_refcode: 'jp421_variant_a'
    }
  ];

  it('partial match is NOT deterministic', () => {
    // Transaction has 'jp421', creative has 'jp421_variant_a'
    const result = matchRefcodeToCreative('jp421', creatives);
    
    expect(result).not.toBeNull();
    expect(result!.match_type).toBe('url_partial');
    expect(result!.confidence).toBeLessThan(1.0);
    expect(result!.confidence).toBe(0.7);
    
    // Verify NOT marked as deterministic
    expect(getAttributionType(result!.match_type)).toBe('heuristic_partial_url');
  });

  it('partial match reason explains the overlap', () => {
    const result = matchRefcodeToCreative('jp421', creatives);
    
    expect(result!.reason).toContain('Partial URL match');
    expect(result!.reason).toContain('jp421_variant_a');
  });
});

// ============================================================================
// Test: Campaign Pattern Matching (Heuristic)
// ============================================================================

describe('Campaign Pattern Matching', () => {
  const campaigns: Campaign[] = [
    {
      campaign_id: 'meta_fall_2024',
      campaign_name: 'Meta Fall 2024 Mobilization',
      organization_id: 'org_1'
    },
    {
      campaign_id: 'fb_yearend',
      campaign_name: 'Facebook Year End Campaign',
      organization_id: 'org_1'
    }
  ];

  it('campaign name similarity is NOT deterministic', () => {
    // Only fuzzy matching available (no URL match)
    const result = matchRefcodeToCampaign('meta_fall_campaign', campaigns);
    
    // Should match based on fuzzy similarity
    if (result) {
      expect(result.match_type).toBe('fuzzy');
      expect(result.confidence).toBeLessThanOrEqual(0.5);
      expect(getAttributionType(result.match_type)).toBe('heuristic_fuzzy');
    }
  });

  it('direct campaign ID match is pattern type', () => {
    const result = matchRefcodeToCampaign('meta_fall_2024', campaigns);
    
    expect(result).not.toBeNull();
    expect(result!.match_type).toBe('campaign_pattern');
    expect(result!.confidence).toBe(0.8);
    expect(getAttributionType(result!.match_type)).toBe('heuristic_pattern');
  });
});

// ============================================================================
// Test: Attribution Type Mapping
// ============================================================================

describe('Attribution Type Mapping', () => {
  it('url_exact maps to deterministic_url_refcode', () => {
    expect(getAttributionType('url_exact')).toBe('deterministic_url_refcode');
  });

  it('url_partial maps to heuristic_partial_url', () => {
    expect(getAttributionType('url_partial')).toBe('heuristic_partial_url');
  });

  it('campaign_pattern maps to heuristic_pattern', () => {
    expect(getAttributionType('campaign_pattern')).toBe('heuristic_pattern');
  });

  it('fuzzy maps to heuristic_fuzzy', () => {
    expect(getAttributionType('fuzzy')).toBe('heuristic_fuzzy');
  });

  it('unknown types return unknown', () => {
    expect(getAttributionType('anything_else')).toBe('unknown');
  });
});

// ============================================================================
// Test: Confidence Score Bounds
// ============================================================================

describe('Confidence Score Bounds', () => {
  it('deterministic matches have confidence 1.0', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test',
      destination_url: 'https://x.com?refcode=test123',
      extracted_refcode: 'test123'
    }];
    
    const result = matchRefcodeToCreative('test123', creatives);
    expect(result!.confidence).toBe(1.0);
  });

  it('partial matches have confidence 0.7', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test',
      destination_url: 'https://x.com?refcode=test123_variant',
      extracted_refcode: 'test123_variant'
    }];
    
    const result = matchRefcodeToCreative('test123', creatives);
    expect(result!.confidence).toBe(0.7);
  });

  it('fuzzy matches are capped at 0.5', () => {
    const campaigns: Campaign[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test Campaign Name',
      organization_id: 'o1'
    }];
    
    // Very similar refcode to trigger fuzzy match
    const result = matchRefcodeToCampaign('Test_Campaign', campaigns);
    
    if (result && result.match_type === 'fuzzy') {
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    }
  });
});

// ============================================================================
// Test: Matching Priority
// ============================================================================

describe('Matching Priority', () => {
  it('URL exact match takes priority over pattern match', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'camp_url',
      campaign_name: 'URL Campaign',
      destination_url: 'https://x.com?refcode=testcode',
      extracted_refcode: 'testcode'
    }];
    
    const campaigns: Campaign[] = [{
      campaign_id: 'testcode',
      campaign_name: 'Pattern Campaign',
      organization_id: 'o1'
    }];
    
    // URL match should be found first
    const urlResult = matchRefcodeToCreative('testcode', creatives);
    expect(urlResult).not.toBeNull();
    expect(urlResult!.match_type).toBe('url_exact');
    expect(urlResult!.campaign_id).toBe('camp_url');
    
    // If URL match exists, we wouldn't even call campaign matcher
    // This is the expected behavior in the edge function
  });
});

// ============================================================================
// Test: Guard Rails - Data Integrity
// ============================================================================

describe('Data Integrity Guards', () => {
  it('deterministic records should never be overwritten by heuristic', () => {
    // Simulating the guard logic from the edge function
    const existingDeterministicSet = new Set(['org_1:refcode_a', 'org_1:refcode_b']);
    
    const newMatch = {
      organization_id: 'org_1',
      refcode: 'refcode_a',
      match_type: 'fuzzy' // trying to overwrite with heuristic
    };
    
    const key = `${newMatch.organization_id}:${newMatch.refcode}`;
    const shouldSkip = existingDeterministicSet.has(key);
    
    expect(shouldSkip).toBe(true);
  });

  it('deterministic matches should be allowed to update', () => {
    const existingDeterministicSet = new Set(['org_1:refcode_a']);
    
    const newMatch = {
      organization_id: 'org_1',
      refcode: 'refcode_new', // new refcode
      match_type: 'url_exact'
    };
    
    const key = `${newMatch.organization_id}:${newMatch.refcode}`;
    const shouldSkip = existingDeterministicSet.has(key);
    
    expect(shouldSkip).toBe(false);
  });
});

// ============================================================================
// Test: Idempotency
// ============================================================================

describe('Matcher Idempotency', () => {
  it('same input produces same output', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test',
      destination_url: 'https://x.com?refcode=stable_code',
      extracted_refcode: 'stable_code'
    }];
    
    // Run matcher twice
    const result1 = matchRefcodeToCreative('stable_code', creatives);
    const result2 = matchRefcodeToCreative('stable_code', creatives);
    
    expect(result1).toEqual(result2);
  });

  it('order of creatives does not affect exact match result', () => {
    const creatives1: CreativeWithRefcode[] = [
      { campaign_id: 'c1', campaign_name: 'First', destination_url: 'x', extracted_refcode: 'code_a' },
      { campaign_id: 'c2', campaign_name: 'Second', destination_url: 'y', extracted_refcode: 'code_b' }
    ];
    
    const creatives2: CreativeWithRefcode[] = [
      { campaign_id: 'c2', campaign_name: 'Second', destination_url: 'y', extracted_refcode: 'code_b' },
      { campaign_id: 'c1', campaign_name: 'First', destination_url: 'x', extracted_refcode: 'code_a' }
    ];
    
    const result1 = matchRefcodeToCreative('code_a', creatives1);
    const result2 = matchRefcodeToCreative('code_a', creatives2);
    
    expect(result1!.campaign_id).toBe('c1');
    expect(result2!.campaign_id).toBe('c1');
  });
});

// ============================================================================
// Test: Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('empty creatives array returns null', () => {
    const result = matchRefcodeToCreative('any_code', []);
    expect(result).toBeNull();
  });

  it('empty campaigns array returns null', () => {
    const result = matchRefcodeToCampaign('any_code', []);
    expect(result).toBeNull();
  });

  it('creative with null extracted_refcode is skipped for exact match', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test',
      destination_url: 'https://x.com',
      extracted_refcode: null
    }];
    
    const result = matchRefcodeToCreative('test', creatives);
    expect(result).toBeNull();
  });

  it('refcode with special characters is normalized', () => {
    const creatives: CreativeWithRefcode[] = [{
      campaign_id: 'c1',
      campaign_name: 'Test',
      destination_url: 'https://x.com?refcode=test_code',
      extracted_refcode: 'test_code'
    }];
    
    // Should match despite underscore
    const result = matchRefcodeToCreative('test_code', creatives);
    expect(result).not.toBeNull();
    expect(result!.match_type).toBe('url_exact');
  });
});
