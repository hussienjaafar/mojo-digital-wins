import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createLogger } from "../_shared/logger.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash function for PII (matches actblue-webhook)
async function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone number
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits.length >= 10 ? digits : null;
}

/**
 * Validates if a refcode2 value is a valid Facebook Click ID
 * Valid formats:
 * - fb_IwY... or fb_IwZXh0bg... (legacy prefixed fbc from old redirect flow)
 * - fb_tvMPYAxP2Ya... (new format: unique _aem_ suffix extracted)
 * - IwY... or IwZXh0bg... (raw fbc format)
 * 
 * Invalid formats (ActBlue internal tracking):
 * - ab_thanks_social_facebook, ab_mobile_*, etc.
 */
function isValidFacebookClickId(refcode2: string | null): boolean {
  if (!refcode2) return false;
  
  // Must start with 'fb_' (our redirect flow) or look like a raw fbc
  if (refcode2.startsWith('fb_')) {
    const fbc = refcode2.substring(3);
    // Valid formats:
    // 1. Legacy: fb.{version}.{timestamp}.{fbclid} or raw fbclid starting with IwY, IwZ, PAZ
    // 2. New: unique _aem_ suffix (typically 20-30 alphanumeric chars)
    if (fbc.startsWith('fb.') || fbc.startsWith('IwY') || fbc.startsWith('IwZ') || fbc.startsWith('PAZ')) {
      return true;
    }
    // New format: _aem_ suffix is typically base64-like (alphanumeric with - and _)
    // Must be at least 15 chars to be a valid unique identifier
    if (fbc.length >= 15 && /^[A-Za-z0-9_-]+$/.test(fbc)) {
      return true;
    }
    return false;
  }
  
  // Skip ActBlue internal tracking codes
  if (refcode2.startsWith('ab_')) return false;
  
  return false;
}

// Extract fbc from refcode2 (strip 'fb_' prefix if present)
function extractFbc(refcode2: string | null): string | null {
  if (!refcode2 || !isValidFacebookClickId(refcode2)) return null;
  if (refcode2.startsWith('fb_')) {
    return refcode2.substring(3);
  }
  return refcode2;
}

serve(async (req) => {
  const logger = createLogger('backfill-recent-capi');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const hoursBack = body.hours_back || 24;
    const limit = body.limit || 10;
    const organizationId = body.organization_id;

    logger.info('Starting backfill', { hoursBack, limit, organizationId });

    // Get CAPI config for the organization
    let configQuery = supabase
      .from('meta_capi_config')
      .select('*')
      .eq('is_enabled', true);
    
    if (organizationId) {
      configQuery = configQuery.eq('organization_id', organizationId);
    }

    const { data: configs, error: configError } = await configQuery;
    
    if (configError || !configs?.length) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No CAPI config found',
        details: configError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let totalQueued = 0;
    const results: any[] = [];

    for (const config of configs) {
      // ============= ENRICHMENT-ONLY MODE =============
      // When actblue_owns_donation_complete = true, ActBlue's browser pixel handles conversion tracking.
      // We must NOT send Purchase events via CAPI to avoid duplicate conversions.
      if (config.actblue_owns_donation_complete === true) {
        logger.info('Skipping enrichment-only org (ActBlue owns conversion tracking)', { 
          orgId: config.organization_id 
        });
        results.push({ 
          org: config.organization_id, 
          queued: 0, 
          message: 'Enrichment-only mode - ActBlue handles conversion tracking'
        });
        continue; // Skip to next organization
      }

    // Find recent transactions with refcode2 that aren't yet in meta_conversion_events
    // Note: We fetch all with refcode2, then filter in code to validate Click ID format
    const { data: transactions, error: txError } = await supabase
      .from('actblue_transactions')
      .select('*')
      .eq('organization_id', config.organization_id)
      .gte('transaction_date', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
      .not('refcode2', 'is', null)
      .order('transaction_date', { ascending: false })
      .limit(limit * 2); // Fetch extra to account for filtering

    if (txError) {
      logger.error('Failed to query transactions', { error: txError.message, org: config.organization_id });
      results.push({ org: config.organization_id, error: txError.message, queued: 0 });
      continue;
    }

    // Filter to only valid Facebook Click IDs (skip ActBlue internal codes like ab_thanks_social_*)
    const validClickIdTransactions = transactions?.filter(t => isValidFacebookClickId(t.refcode2)) || [];
    
    if (!validClickIdTransactions.length) {
      logger.info('No transactions with valid Facebook Click IDs to backfill', { 
        org: config.organization_id,
        totalWithRefcode2: transactions?.length || 0,
        filteredOut: (transactions?.length || 0) - validClickIdTransactions.length
      });
      results.push({ org: config.organization_id, queued: 0, message: 'No transactions with valid Facebook Click ID found' });
      continue;
    }

    // Check which are already in meta_conversion_events
    const transactionIds = validClickIdTransactions.map(t => t.transaction_id);
    const { data: existingEvents } = await supabase
      .from('meta_conversion_events')
      .select('source_id')
      .eq('organization_id', config.organization_id)
      .in('source_id', transactionIds);

    const existingSourceIds = new Set(existingEvents?.map(e => e.source_id) || []);
    const newTransactions = validClickIdTransactions.filter(t => !existingSourceIds.has(t.transaction_id)).slice(0, limit);

    if (!newTransactions.length) {
      logger.info('All transactions with valid Click IDs already queued', { org: config.organization_id });
      results.push({ org: config.organization_id, queued: 0, message: 'All transactions already in queue' });
      continue;
    }

      // Queue each new transaction
      let orgQueued = 0;
      for (const tx of newTransactions) {
        try {
          // PRIORITY: Use full fbclid from transaction if available (from backfill)
          // Otherwise, extract from refcode2 and try touchpoint lookup
          let fbc: string | null = null;
          let fbp: string | null = null;
          
          // Check if transaction already has full fbclid (from previous backfill)
          if (tx.fbclid && tx.fbclid.length > 50) {
            const txFbclid = tx.fbclid;
            fbc = txFbclid;
            logger.info('Using full fbclid from transaction', { 
              transactionId: tx.transaction_id,
              fbcLength: txFbclid.length 
            });
          } else {
            // Extract truncated fbc from refcode2
            const truncatedFbc = extractFbc(tx.refcode2);
            const txDonorEmail = tx.donor_email?.toLowerCase();
            
            // Try to recover full fbclid from attribution_touchpoints WITH VALIDATION
            if (truncatedFbc) {
              const { data: touchpoints } = await supabase
                .from('attribution_touchpoints')
                .select('id, metadata, donor_email, occurred_at')
                .eq('organization_id', config.organization_id)
                .not('metadata', 'is', null)
                .order('occurred_at', { ascending: false })
                .limit(50);
              
              let matchMethod = 'none';
              
              // PRIORITY 1: Email-verified match (deterministic - most reliable)
              if (txDonorEmail) {
                for (const tp of touchpoints || []) {
                  const meta = tp.metadata as any;
                  const fullFbclid = meta?.fbclid as string;
                  const tpDonorEmail = tp.donor_email?.toLowerCase();
                  
                  if (!fullFbclid || fullFbclid.length <= 50) continue;
                  
                  // Only accept if emails match
                  if (tpDonorEmail && tpDonorEmail === txDonorEmail) {
                    const isMatch = 
                      fullFbclid.endsWith(truncatedFbc) ||
                      fullFbclid.startsWith(truncatedFbc);
                    
                    if (isMatch) {
                      fbc = fullFbclid;
                      fbp = meta.fbp || null;
                      matchMethod = 'email_verified';
                      logger.info('Recovered full fbclid (EMAIL VERIFIED)', {
                        transactionId: tx.transaction_id,
                        donorEmail: txDonorEmail.substring(0, 5) + '...',
                        fullLength: fbc.length
                      });
                      break;
                    }
                  }
                }
              }
              
              // PRIORITY 2: Unique suffix match (new redirect flow - suffix is unique _aem_)
              if (!fbc) {
                const suffixMatches = (touchpoints || []).filter(tp => {
                  const meta = tp.metadata as any;
                  const fullFbclid = meta?.fbclid as string;
                  return fullFbclid && fullFbclid.length > 50 && fullFbclid.endsWith(truncatedFbc);
                });
                
                // Only use suffix match if it's UNIQUE (1 match = deterministic)
                if (suffixMatches.length === 1) {
                  const meta = suffixMatches[0].metadata as any;
                  const recoveredFbc = meta.fbclid as string;
                  fbc = recoveredFbc;
                  fbp = meta.fbp || null;
                  matchMethod = 'suffix_unique';
                  logger.info('Recovered full fbclid (UNIQUE SUFFIX)', {
                    transactionId: tx.transaction_id,
                    fullLength: recoveredFbc.length
                  });
                } else if (suffixMatches.length > 1) {
                  // AMBIGUOUS: Multiple touchpoints with same suffix - don't guess!
                  logger.warn('Skipping fbclid recovery - AMBIGUOUS suffix match', {
                    transactionId: tx.transaction_id,
                    possibleMatches: suffixMatches.length,
                    suffix: truncatedFbc.substring(0, 10) + '...'
                  });
                }
              }
              
              // PRIORITY 3: Skip ambiguous prefix matches (don't guess)
              // Legacy prefix matches are NOT reliable without email verification
              if (!fbc) {
                logger.info('No verified fbclid match found - using truncated', {
                  transactionId: tx.transaction_id,
                  hasDonorEmail: !!txDonorEmail,
                  truncatedFbc: truncatedFbc.substring(0, 10) + '...'
                });
                fbc = truncatedFbc; // Fall back to truncated (better than wrong full)
              }
            }
          }
          
          const eventTime = Math.floor(new Date(tx.transaction_date).getTime() / 1000);
          // CRITICAL: When actblue_owns_donation_complete = true, use raw lineitem_id
          // to match ActBlue's pixel event_id for proper Meta deduplication
          const isEnrichmentMode = config.actblue_owns_donation_complete || false;
          const eventId = isEnrichmentMode 
            ? String(tx.transaction_id)  // Raw ID for enrichment mode - matches ActBlue pixel
            : `actblue_${tx.transaction_id}_${eventTime}`;  // Prefixed for primary mode
          
          // Warn if format looks wrong (defensive check)
          if (isEnrichmentMode && eventId.includes('_')) {
            logger.warn('Enrichment event_id should be raw lineitem_id', { eventId, transactionId: tx.transaction_id });
          }
          
          const dedupeKey = `purchase_${tx.transaction_id}`;

          // Build user data with proper hashing
          const userData: any = {};
          
          if (tx.donor_email) {
            userData.em = [await hashValue(tx.donor_email)];
          }
          if (tx.phone) {
            const normalizedPhone = normalizePhone(tx.phone);
            if (normalizedPhone) {
              userData.ph = [await hashValue(normalizedPhone)];
            }
          }
          if (tx.first_name) {
            userData.fn = [await hashValue(tx.first_name)];
          }
          if (tx.last_name) {
            userData.ln = [await hashValue(tx.last_name)];
          }
          if (tx.city) {
            userData.ct = [await hashValue(tx.city)];
          }
          if (tx.state) {
            userData.st = [await hashValue(tx.state)];
          }
          if (tx.zip) {
            const zip5 = tx.zip.substring(0, 5);
            userData.zp = [await hashValue(zip5)];
          }
          if (tx.country) {
            userData.country = [await hashValue(tx.country.toLowerCase())];
          }
          if (fbc) {
            userData.fbc = fbc;
          }
          if (fbp) {
            userData.fbp = fbp;
          }

          // Calculate match quality
          let matchScore = 0;
          if (userData.em) matchScore += 40;
          if (userData.ph) matchScore += 30;
          if (userData.fn && userData.ln) matchScore += 15;
          if (userData.ct && userData.st && userData.zp) matchScore += 15;
          if (userData.fbc) matchScore += 50;

          const matchQuality = matchScore >= 70 ? 'excellent' : matchScore >= 50 ? 'good' : matchScore >= 30 ? 'fair' : 'poor';

          // Insert into outbox using direct insert (not upsert) to avoid ON CONFLICT issues
          const { error: insertError } = await supabase
            .from('meta_conversion_events')
            .insert({
              organization_id: config.organization_id,
              pixel_id: config.pixel_id,
              event_id: eventId,
              event_name: 'Purchase',
              event_time: eventTime,
              event_source_url: 'https://secure.actblue.com',
              action_source: 'website',
              user_data_hashed: userData,
              custom_data: {
                currency: 'USD',
                value: tx.amount,
                content_name: 'Donation',
                content_category: tx.is_recurring ? 'recurring_donation' : 'one_time_donation'
              },
              status: 'pending',
              source_type: 'actblue_backfill',
              source_id: tx.transaction_id,
              dedupe_key: dedupeKey,
              fbc: fbc,
              match_score: matchScore,
              match_quality: matchQuality,
              is_enrichment_only: config.actblue_owns_donation_complete || false
            });

          if (insertError) {
            // Check if it's a duplicate key error (already exists)
            if (insertError.code === '23505') {
              logger.info('Transaction already queued (duplicate)', { transactionId: tx.transaction_id });
            } else {
              logger.error('Failed to insert event', { 
                error: insertError.message, 
                code: insertError.code,
                transactionId: tx.transaction_id 
              });
            }
          } else {
            orgQueued++;
            logger.info('Queued event for CAPI', { 
              transactionId: tx.transaction_id, 
              eventId, 
              matchQuality,
              hasFbc: !!fbc
            });
          }
        } catch (err: unknown) {
          logger.error('Error processing transaction', { 
            transactionId: tx.transaction_id, 
            error: err instanceof Error ? err.message : String(err) 
          });
        }
      }

      totalQueued += orgQueued;
      results.push({ 
        org: config.organization_id, 
        queued: orgQueued, 
        found: transactions.length,
        alreadyQueued: existingSourceIds.size
      });
    }

    logger.info('Backfill complete', { totalQueued, results });

    return new Response(JSON.stringify({ 
      success: true, 
      total_queued: totalQueued,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Backfill failed', { error: errorMessage });
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
