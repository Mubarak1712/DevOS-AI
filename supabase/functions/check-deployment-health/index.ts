export {};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// @ts-ignore - Supabase client provided by Deno runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Authenticate caller via Supabase Auth
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearerToken) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Empty bearer token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(bearerToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or expired session' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Parse request payload
    let body: { url?: string; platform?: string; deploymentId?: string } = {};
    try {
      body = (await req.json()) as { url?: string; platform?: string; deploymentId?: string };
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let checkUrl = (body.url || '').trim();
    if (!checkUrl) {
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^https?:\/\//i.test(checkUrl)) {
      checkUrl = 'https://' + checkUrl;
    }

    const startTime = Date.now();
    let status: 'live' | 'offline' | 'error' | 'sleeping' = 'offline';
    let statusCode: number | undefined;
    let errorMessage: string | undefined;
    let sslValid = checkUrl.startsWith('https://');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const fetchResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'DevOS-AI Health Monitor/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
        },
        signal: controller.signal,
        redirect: 'follow',
      });

      clearTimeout(timeoutId);
      statusCode = fetchResponse.status;

      if (statusCode >= 200 && statusCode < 400) {
        status = 'live';
      } else if (statusCode === 503 || statusCode === 504) {
        status = 'sleeping';
        errorMessage = `Service unavailable or waking up (HTTP ${statusCode})`;
      } else if (statusCode >= 500) {
        status = 'error';
        errorMessage = `Server error (HTTP ${statusCode})`;
      } else if (statusCode >= 400) {
        status = 'error';
        errorMessage = `Client error (HTTP ${statusCode})`;
      }
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const err = fetchErr as { name?: string; message?: string };
      if (err.name === 'AbortError') {
        status = 'offline';
        errorMessage = 'Request timed out after 15s';
      } else {
        status = 'offline';
        errorMessage = err.message || 'Unable to connect to host';
        if (err.message?.includes('certificate') || err.message?.includes('SSL') || err.message?.includes('TLS')) {
          sslValid = false;
        }
      }
    }

    const responseTimeMs = Date.now() - startTime;

    // Detect sleeping service if latency is very high or status 503
    if (status === 'live' && responseTimeMs > 4000 && (body.platform === 'render' || body.platform === 'railway')) {
      status = 'sleeping';
    }

    const checkedAt = new Date().toISOString();

    // If deploymentId provided, update deployment record in DB
    if (body.deploymentId) {
      await supabase
        .from('deployments')
        .update({
          status: status,
          response_time_ms: responseTimeMs,
          ssl_status: sslValid ? 'valid' : 'invalid',
          error_message: errorMessage || null,
          updated_at: checkedAt,
        })
        .eq('id', body.deploymentId)
        .eq('user_id', user.id);
    }

    return new Response(
      JSON.stringify({
        url: checkUrl,
        status,
        statusCode,
        responseTimeMs,
        sslValid,
        errorMessage,
        checkedAt,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Check deployment health error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
