import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Fuse from "https://esm.sh/fuse.js@7.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Known canonical entities for fuzzy matching
const CANONICAL_ENTITIES = [
  { name: 'Donald Trump', type: 'person', aliases: ['trump', 'president trump', 'donald j trump'] },
  { name: 'Joe Biden', type: 'person', aliases: ['biden', 'president biden', 'joseph biden'] },
  { name: 'Elon Musk', type: 'person', aliases: ['musk'] },
  { name: 'Vladimir Putin', type: 'person', aliases: ['putin'] },
  { name: 'Pete Hegseth', type: 'person', aliases: ['hegseth'] },
  { name: 'Ron DeSantis', type: 'person', aliases: ['desantis'] },
  { name: 'Gavin Newsom', type: 'person', aliases: ['newsom'] },
  { name: 'Nancy Pelosi', type: 'person', aliases: ['pelosi'] },
  { name: 'Mitch McConnell', type: 'person', aliases: ['mcconnell'] },
  { name: 'Alexandria Ocasio-Cortez', type: 'person', aliases: ['aoc', 'ocasio-cortez'] },
  { name: 'Kamala Harris', type: 'person', aliases: ['harris', 'vp harris'] },
  { name: 'Mike Pence', type: 'person', aliases: ['pence'] },
  { name: 'Christopher Wray', type: 'person', aliases: ['wray', 'chris wray'] },
  { name: 'Merrick Garland', type: 'person', aliases: ['garland'] },
  { name: 'Supreme Court', type: 'organization', aliases: ['scotus'] },
  { name: 'FBI', type: 'organization', aliases: ['federal bureau of investigation'] },
  { name: 'CIA', type: 'organization', aliases: ['central intelligence agency'] },
  { name: 'Department of Justice', type: 'organization', aliases: ['doj', 'justice department'] },
  { name: 'ICE', type: 'organization', aliases: ['immigration and customs enforcement'] },
  { name: 'DHS', type: 'organization', aliases: ['department of homeland security', 'homeland security'] },
  { name: 'Republican Party', type: 'organization', aliases: ['gop', 'republicans', 'republican'] },
  { name: 'Democratic Party', type: 'organization', aliases: ['democrats', 'democrat', 'dems'] },
  { name: 'White House', type: 'organization', aliases: ['whitehouse'] },
  { name: 'Congress', type: 'organization', aliases: ['us congress'] },
  { name: 'Senate', type: 'organization', aliases: ['us senate'] },
  { name: 'House of Representatives', type: 'organization', aliases: ['house', 'us house'] },
  { name: 'Pentagon', type: 'organization', aliases: ['department of defense', 'dod'] },
  { name: 'State Department', type: 'organization', aliases: ['department of state'] },
  { name: 'Treasury Department', type: 'organization', aliases: ['department of treasury', 'treasury'] },
  { name: 'Federal Reserve', type: 'organization', aliases: ['fed', 'the fed'] },
  { name: 'NATO', type: 'organization', aliases: ['north atlantic treaty organization'] },
  { name: 'United Nations', type: 'organization', aliases: ['un'] },
  { name: 'European Union', type: 'organization', aliases: ['eu'] },
  { name: 'China', type: 'location', aliases: ['prc', 'peoples republic of china'] },
  { name: 'Russia', type: 'location', aliases: ['russian federation'] },
  { name: 'Ukraine', type: 'location', aliases: [] },
  { name: 'Israel', type: 'location', aliases: [] },
  { name: 'Gaza', type: 'location', aliases: ['gaza strip'] },
  { name: 'Iran', type: 'location', aliases: ['islamic republic of iran'] },
  { name: 'North Korea', type: 'location', aliases: ['dprk'] },
  { name: 'Taiwan', type: 'location', aliases: ['republic of china'] },
];

// Build searchable items for Fuse.js
const searchableItems = CANONICAL_ENTITIES.flatMap(entity => [
  { searchTerm: entity.name.toLowerCase(), canonical: entity.name, type: entity.type },
  ...entity.aliases.map(alias => ({ 
    searchTerm: alias.toLowerCase(), 
    canonical: entity.name, 
    type: entity.type 
  }))
]);

// Initialize Fuse.js for fuzzy matching
const fuse = new Fuse(searchableItems, {
  keys: ['searchTerm'],
  threshold: 0.3, // Lower = stricter matching
  includeScore: true,
  minMatchCharLength: 3,
});

interface ResolveRequest {
  entities: string[];
  useWikidata?: boolean;
  useAI?: boolean;
}

interface ResolvedEntity {
  original: string;
  canonical: string;
  type: string;
  method: string;
  confidence: number;
}

// Clean and normalize input
function normalizeInput(text: string): string {
  return text.toLowerCase().trim().replace(/^#/, '').replace(/[_-]/g, ' ');
}

// Check if input looks like a proper entity (not generic word)
function isValidEntity(text: string): boolean {
  const normalized = text.toLowerCase().trim();
  const GENERIC_WORDS = new Set([
    'the', 'a', 'an', 'this', 'that', 'these', 'those',
    'news', 'breaking', 'update', 'alert', 'report',
    'today', 'yesterday', 'tomorrow', 'now', 'just',
    'says', 'said', 'according', 'sources', 'reports',
    'people', 'man', 'woman', 'person', 'group',
    'new', 'old', 'big', 'small', 'good', 'bad',
    'first', 'last', 'next', 'previous',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]);
  
  if (normalized.length < 2) return false;
  if (GENERIC_WORDS.has(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  
  return true;
}

// Query Wikidata for entity resolution
async function resolveWithWikidata(entity: string): Promise<ResolvedEntity | null> {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(entity)}&language=en&format=json&limit=3&type=item`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'EntityResolver/1.0 (political-monitoring)' }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.search && data.search.length > 0) {
      const result = data.search[0];
      
      // Filter for relevant entity types (people, orgs, locations)
      const description = (result.description || '').toLowerCase();
      let entityType = 'unknown';
      
      if (description.includes('politician') || description.includes('president') || 
          description.includes('senator') || description.includes('person')) {
        entityType = 'person';
      } else if (description.includes('organization') || description.includes('agency') ||
                 description.includes('party') || description.includes('company')) {
        entityType = 'organization';
      } else if (description.includes('country') || description.includes('city') ||
                 description.includes('state') || description.includes('region')) {
        entityType = 'location';
      }
      
      return {
        original: entity,
        canonical: result.label,
        type: entityType,
        method: 'wikidata',
        confidence: 0.85
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Wikidata lookup failed for "${entity}":`, error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { entities, useWikidata = false, useAI = false }: ResolveRequest = await req.json();
    
    if (!entities || !Array.isArray(entities) || entities.length === 0) {
      return new Response(JSON.stringify({ error: 'entities array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Resolving ${entities.length} entities, useWikidata=${useWikidata}`);
    
    const results: ResolvedEntity[] = [];
    const uncachedEntities: string[] = [];
    
    // Step 1: Check database cache for all entities
    const normalizedInputs = entities.map(e => normalizeInput(e));
    const { data: cachedAliases } = await supabase
      .from('entity_aliases')
      .select('raw_name, canonical_name, entity_type, confidence_score')
      .in('raw_name', normalizedInputs);
    
    const cacheMap = new Map(
      (cachedAliases || []).map(a => [a.raw_name, a])
    );
    
    for (let i = 0; i < entities.length; i++) {
      const original = entities[i];
      const normalized = normalizedInputs[i];
      
      // Skip invalid entities
      if (!isValidEntity(original)) {
        results.push({
          original,
          canonical: original,
          type: 'invalid',
          method: 'skipped',
          confidence: 0
        });
        continue;
      }
      
      // Check cache first
      const cached = cacheMap.get(normalized);
      if (cached) {
        results.push({
          original,
          canonical: cached.canonical_name,
          type: cached.entity_type,
          method: 'cache',
          confidence: cached.confidence_score
        });
        
        // Increment usage count async (fire and forget)
        supabase
          .from('entity_aliases')
          .update({ usage_count: (cached as any).usage_count + 1 || 1 })
          .eq('raw_name', normalized)
          .then(() => {});
        
        continue;
      }
      
      // Step 2: Try fuzzy matching
      const fuseResults = fuse.search(normalized);
      if (fuseResults.length > 0 && fuseResults[0].score !== undefined && fuseResults[0].score < 0.3) {
        const match = fuseResults[0].item;
        const confidence = 1 - (fuseResults[0].score || 0);
        
        results.push({
          original,
          canonical: match.canonical,
          type: match.type,
          method: 'fuzzy',
          confidence
        });
        
        // Cache this resolution
        supabase.from('entity_aliases').upsert({
          raw_name: normalized,
          canonical_name: match.canonical,
          entity_type: match.type,
          resolution_method: 'fuzzy',
          confidence_score: confidence
        }, { onConflict: 'raw_name' }).then(() => {});
        
        continue;
      }
      
      // Mark for external resolution
      uncachedEntities.push(original);
      results.push({
        original,
        canonical: original, // Will be updated if external resolution succeeds
        type: 'unknown',
        method: 'passthrough',
        confidence: 0.5
      });
    }
    
    // Step 3: Optional Wikidata resolution for uncached entities
    if (useWikidata && uncachedEntities.length > 0) {
      console.log(`Attempting Wikidata resolution for ${uncachedEntities.length} entities`);
      
      for (const entity of uncachedEntities.slice(0, 10)) { // Limit to 10 to avoid rate limits
        const wikidataResult = await resolveWithWikidata(entity);
        
        if (wikidataResult) {
          // Find and update the result
          const idx = results.findIndex(r => r.original === entity && r.method === 'passthrough');
          if (idx !== -1) {
            results[idx] = wikidataResult;
            
            // Cache Wikidata result
            supabase.from('entity_aliases').upsert({
              raw_name: normalizeInput(entity),
              canonical_name: wikidataResult.canonical,
              entity_type: wikidataResult.type,
              resolution_method: 'wikidata',
              confidence_score: wikidataResult.confidence,
              source: 'wikidata'
            }, { onConflict: 'raw_name' }).then(() => {});
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    // Build response with statistics
    const stats = {
      total: entities.length,
      cached: results.filter(r => r.method === 'cache').length,
      fuzzy: results.filter(r => r.method === 'fuzzy').length,
      wikidata: results.filter(r => r.method === 'wikidata').length,
      passthrough: results.filter(r => r.method === 'passthrough').length,
      skipped: results.filter(r => r.method === 'skipped').length
    };
    
    console.log(`Resolution complete:`, stats);

    return new Response(JSON.stringify({ 
      results,
      stats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Entity resolver error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
