// Secret Oxfordshire — Anthropic API proxy
// Keeps the API key server-side; streams responses back to the browser.

const ANTHROPIC_API  = 'https://api.anthropic.com/v1/messages';
const ALLOWED_ORIGIN = 'https://secretoxfordshire.com';
const DAILY_LIMIT    = 25;  // max AI messages per visitor per day

export default {
  async fetch(request, env, ctx) {

    const corsHeaders = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Rate limiting (requires KV binding named RATE_LIMIT)
    if (env.RATE_LIMIT) {
      const ip    = request.headers.get('CF-Connecting-IP') || 'unknown';
      const today = new Date().toISOString().slice(0, 10);
      const key   = `rate:${ip}:${today}`;
      const count = parseInt(await env.RATE_LIMIT.get(key) || '0');

      if (count >= DAILY_LIMIT) {
        return new Response(
          JSON.stringify({ error: { message: `Daily limit of ${DAILY_LIMIT} messages reached. Come back tomorrow!` } }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      ctx.waitUntil(env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: 86400 }));
    }

    // Forward request to Anthropic, streaming the response back
    const body     = await request.text();
    const upstream = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'x-api-key':          env.ANTHROPIC_API_KEY,
        'anthropic-version':  '2023-06-01',
        'content-type':       'application/json',
      },
      body,
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        'Content-Type':  upstream.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  },
};
