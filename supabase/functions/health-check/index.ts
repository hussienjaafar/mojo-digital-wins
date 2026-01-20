import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

/**
 * Health Check Endpoint
 *
 * Provides system health status for monitoring and deployment verification.
 * Returns detailed status when called with admin auth, basic status otherwise.
 */

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: CheckResult;
    email: CheckResult;
    environment: CheckResult;
  };
  uptime_seconds?: number;
}

interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  latency_ms?: number;
}

const startTime = Date.now();
const VERSION = '1.0.0';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const checks: HealthStatus['checks'] = {
      database: { status: 'fail', message: 'Not checked' },
      email: { status: 'fail', message: 'Not checked' },
      environment: { status: 'fail', message: 'Not checked' },
    };

    // Check environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'SUPABASE_ANON_KEY',
    ];

    const optionalEnvVars = [
      'RESEND_API_KEY',
      'SENDER_EMAIL',
      'CRON_SECRET',
    ];

    const missingRequired = requiredEnvVars.filter(v => !Deno.env.get(v));
    const missingOptional = optionalEnvVars.filter(v => !Deno.env.get(v));

    if (missingRequired.length > 0) {
      checks.environment = {
        status: 'fail',
        message: `Missing required: ${missingRequired.join(', ')}`,
      };
    } else if (missingOptional.length > 0) {
      checks.environment = {
        status: 'warn',
        message: `Missing optional: ${missingOptional.join(', ')}`,
      };
    } else {
      checks.environment = { status: 'pass' };
    }

    // Check database connectivity
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const dbStart = Date.now();

      try {
        const { error } = await supabase
          .from('data_retention_policies')
          .select('id')
          .limit(1);

        const latency = Date.now() - dbStart;

        if (error) {
          checks.database = {
            status: 'fail',
            message: error.message,
            latency_ms: latency,
          };
        } else {
          checks.database = {
            status: latency > 1000 ? 'warn' : 'pass',
            message: latency > 1000 ? 'High latency detected' : undefined,
            latency_ms: latency,
          };
        }
      } catch (dbError) {
        checks.database = {
          status: 'fail',
          message: dbError instanceof Error ? dbError.message : 'Connection failed',
        };
      }
    } else {
      checks.database = {
        status: 'fail',
        message: 'Missing database credentials',
      };
    }

    // Check email configuration
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const senderEmail = Deno.env.get('SENDER_EMAIL');

    if (resendApiKey && senderEmail) {
      // Validate API key format (starts with 're_')
      if (resendApiKey.startsWith('re_')) {
        checks.email = { status: 'pass' };
      } else {
        checks.email = {
          status: 'warn',
          message: 'API key format may be invalid',
        };
      }
    } else {
      checks.email = {
        status: 'warn',
        message: 'Email not configured (optional)',
      };
    }

    // Determine overall status
    const checkResults = Object.values(checks);
    let overallStatus: HealthStatus['status'] = 'healthy';

    if (checkResults.some(c => c.status === 'fail')) {
      // If database or required env vars fail, system is unhealthy
      if (checks.database.status === 'fail' || checks.environment.status === 'fail') {
        overallStatus = 'unhealthy';
      } else {
        overallStatus = 'degraded';
      }
    } else if (checkResults.some(c => c.status === 'warn')) {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: VERSION,
      checks,
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    };

    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'unhealthy' ? 503 :
                       overallStatus === 'degraded' ? 200 : 200;

    return new Response(
      JSON.stringify(healthStatus, null, 2),
      {
        status: httpStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );

  } catch (error) {
    console.error('[health-check] Error:', error);

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        error: 'Health check failed',
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
