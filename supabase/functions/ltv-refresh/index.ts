import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";
import { parseJsonBody, uuidSchema, z } from "../_shared/validators.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const bodySchema = z.object({
      organization_id: uuidSchema,
      lookback_days: z.coerce.number().int().min(1).max(3650).optional().default(365),
    }).passthrough();

    const parsedBody = await parseJsonBody(req, bodySchema, { allowEmpty: false });
    if (!parsedBody.ok) {
      return new Response(
        JSON.stringify({ error: parsedBody.error, details: parsedBody.details }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { organization_id, lookback_days } = parsedBody.data;


    const { data, error } = await supabase.rpc("refresh_donor_ltv_predictions", {
      p_org: organization_id,
      p_lookback_days: lookback_days,
    });

    if (error) {
      console.error("[LTV REFRESH] Error refreshing predictions", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, inserted: data }), { headers: corsHeaders });
  } catch (err: any) {
    console.error("[LTV REFRESH] Unexpected error", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
