import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface SMSReplyEvent {
  id: string;
  reply_text: string;
  organization_id: string;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  intent: 'support' | 'question' | 'complaint' | 'opt-out-request' | 'thank-you' | 'general';
  confidence: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { organization_id, batch_size = 50 } = body;

    // Verify authorization
    const cronSecret = Deno.env.get('CRON_SECRET');
    const providedCronSecret = req.headers.get('x-cron-secret');
    const scheduledJob = req.headers.get('x-scheduled-job');
    
    let isAuthorized = false;
    
    if (cronSecret && providedCronSecret === cronSecret) {
      isAuthorized = true;
    } else if (scheduledJob === 'true') {
      isAuthorized = true;
    } else {
      // Check JWT auth
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (user) {
          const { data: isAdmin } = await supabase.rpc('has_role', {
            _user_id: user.id,
            _role: 'admin'
          });
          isAuthorized = !!isAdmin;
        }
      }
    }
    
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SMS SENTIMENT] Starting sentiment analysis batch');

    // Fetch unanalyzed replies
    let query = supabase
      .from('sms_events')
      .select('id, reply_text, organization_id')
      .not('reply_text', 'is', null)
      .eq('sentiment_analyzed', false)
      .limit(batch_size);
    
    if (organization_id) {
      query = query.eq('organization_id', organization_id);
    }
    
    const { data: replies, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch replies: ${fetchError.message}`);
    }

    if (!replies || replies.length === 0) {
      console.log('[SMS SENTIMENT] No unanalyzed replies found');
      return new Response(
        JSON.stringify({ success: true, analyzed: 0, message: 'No unanalyzed replies found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SMS SENTIMENT] Found ${replies.length} replies to analyze`);

    // Analyze sentiment using Lovable AI
    const analyzedResults: Array<{ id: string; sentiment: string; intent: string }> = [];
    
    if (!lovableApiKey) {
      console.warn('[SMS SENTIMENT] LOVABLE_API_KEY not configured, using fallback analysis');
      // Fallback: simple keyword-based analysis
      for (const reply of replies) {
        const result = analyzeWithKeywords(reply.reply_text);
        analyzedResults.push({
          id: reply.id,
          sentiment: result.sentiment,
          intent: result.intent,
        });
      }
    } else {
      // Use Lovable AI for analysis
      const batchPrompt = replies.map((r, i) => `[${i}] "${r.reply_text}"`).join('\n');
      
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are analyzing SMS replies from donors to a political campaign. For each message, determine:
1. Sentiment: positive, negative, or neutral
2. Intent: support (expressing support), question (asking something), complaint (expressing dissatisfaction), opt-out-request (wanting to unsubscribe), thank-you (expressing gratitude), general (other)

Respond in JSON format as an array of objects with "index", "sentiment", and "intent" fields.`
              },
              {
                role: 'user',
                content: `Analyze these SMS replies:\n${batchPrompt}`
              }
            ],
          }),
        });

        if (aiResponse.status === 429) {
          console.warn('[SMS SENTIMENT] Rate limited, falling back to keyword analysis');
          for (const reply of replies) {
            const result = analyzeWithKeywords(reply.reply_text);
            analyzedResults.push({ id: reply.id, ...result });
          }
        } else if (aiResponse.status === 402) {
          console.warn('[SMS SENTIMENT] Payment required, falling back to keyword analysis');
          for (const reply of replies) {
            const result = analyzeWithKeywords(reply.reply_text);
            analyzedResults.push({ id: reply.id, ...result });
          }
        } else if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          
          // Parse AI response
          try {
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              for (const item of parsed) {
                const reply = replies[item.index];
                if (reply) {
                  analyzedResults.push({
                    id: reply.id,
                    sentiment: item.sentiment || 'neutral',
                    intent: item.intent || 'general',
                  });
                }
              }
            }
          } catch (parseErr) {
            console.error('[SMS SENTIMENT] Failed to parse AI response, using fallback');
            for (const reply of replies) {
              const result = analyzeWithKeywords(reply.reply_text);
              analyzedResults.push({ id: reply.id, ...result });
            }
          }
        } else {
          console.error('[SMS SENTIMENT] AI API error:', aiResponse.status);
          for (const reply of replies) {
            const result = analyzeWithKeywords(reply.reply_text);
            analyzedResults.push({ id: reply.id, ...result });
          }
        }
      } catch (aiErr) {
        console.error('[SMS SENTIMENT] AI request failed:', aiErr);
        for (const reply of replies) {
          const result = analyzeWithKeywords(reply.reply_text);
          analyzedResults.push({ id: reply.id, ...result });
        }
      }
    }

    // Update database with results
    let updated = 0;
    for (const result of analyzedResults) {
      const { error: updateError } = await supabase
        .from('sms_events')
        .update({
          reply_sentiment: result.sentiment,
          reply_intent: result.intent,
          sentiment_analyzed: true,
        })
        .eq('id', result.id);
      
      if (updateError) {
        console.error(`[SMS SENTIMENT] Failed to update event ${result.id}:`, updateError);
      } else {
        updated++;
      }
    }

    console.log(`[SMS SENTIMENT] Successfully analyzed ${updated} replies`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analyzed: updated,
        total_found: replies.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SMS SENTIMENT] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Fallback keyword-based sentiment analysis
function analyzeWithKeywords(text: string): { sentiment: string; intent: string } {
  const lowerText = text.toLowerCase();
  
  // Intent detection
  let intent = 'general';
  if (/stop|unsubscribe|remove|opt.?out|quit/i.test(lowerText)) {
    intent = 'opt-out-request';
  } else if (/thank|thanks|thx|appreciate/i.test(lowerText)) {
    intent = 'thank-you';
  } else if (/\?|how|what|when|where|why|who/i.test(lowerText)) {
    intent = 'question';
  } else if (/hate|terrible|awful|worst|angry|mad|upset|disappointed/i.test(lowerText)) {
    intent = 'complaint';
  } else if (/love|great|amazing|support|vote|yes|absolutely/i.test(lowerText)) {
    intent = 'support';
  }
  
  // Sentiment detection
  let sentiment = 'neutral';
  const positiveWords = /thank|love|great|good|awesome|amazing|wonderful|excellent|support|yes|absolutely|happy|glad/i;
  const negativeWords = /hate|terrible|awful|worst|angry|mad|upset|disappointed|bad|horrible|never|stop|unsubscribe/i;
  
  const positiveMatches = (lowerText.match(positiveWords) || []).length;
  const negativeMatches = (lowerText.match(negativeWords) || []).length;
  
  if (positiveMatches > negativeMatches) {
    sentiment = 'positive';
  } else if (negativeMatches > positiveMatches) {
    sentiment = 'negative';
  }
  
  return { sentiment, intent };
}
