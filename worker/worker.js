/**
 * Ethan Expert — Cloudflare Worker v4
 *
 * Secrets: ANTHROPIC_API_KEY, ADMIN_PASSWORD
 * KV: CONFIG (system_prompt, tagline, subtitle, welcome_message, quick_questions)
 *
 * Routes:
 *   POST /          → proxy chat to Anthropic (public)
 *   GET  /config    → return KV config (public)
 *   POST /admin/chat → admin conversational agent (password-protected)
 *   GET  /health    → liveness
 *   OPTIONS *       → CORS preflight
 */

const ALLOWED_ORIGINS = [
  'https://ethan-expert.pages.dev',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Admin-Password',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data, status = 200, origin = '') {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

const CONFIG_KEYS = ['system_prompt', 'tagline', 'subtitle', 'welcome_message', 'quick_questions', 'ab_questions'];

async function getConfig(env) {
  const result = {};
  await Promise.all(CONFIG_KEYS.map(async (k) => {
    const val = await env.CONFIG.get(k);
    if (val !== null) result[k] = val;
  }));
  if (result.quick_questions) {
    try { result.quick_questions = JSON.parse(result.quick_questions); }
    catch { delete result.quick_questions; }
  }
  if (result.ab_questions) {
    try { result.ab_questions = JSON.parse(result.ab_questions); }
    catch { delete result.ab_questions; }
  }
  return result;
}

async function saveConfig(env, data) {
  const writes = [];
  for (const k of CONFIG_KEYS) {
    if (k in data) {
      const val = k === 'quick_questions' ? JSON.stringify(data[k]) : String(data[k]);
      writes.push(env.CONFIG.put(k, val));
    }
  }
  await Promise.all(writes);
}

// ── Tool definitions for the admin agent ─────────────────────────
const ADMIN_TOOLS = [
  {
    name: 'save_config',
    description: `Save one or more config fields to the live site. Only call this AFTER the user has explicitly confirmed the change. Fields you can save:
- system_prompt (string): the full AI persona and knowledge base
- tagline (string): small text above the site name
- subtitle (string): the one-liner description under the name  
- welcome_message (string): the first message shown in the chat
- quick_questions (object): { modeName: ["q1","q2","q3","q4"] } for each mode (curious, publisher, speaker, academic, collaborator, recruiter)
Only include fields you are actually changing.`,
    input_schema: {
      type: 'object',
      properties: {
        fields: {
          type: 'object',
          description: 'Object containing only the fields to update.',
        },
      },
      required: ['fields'],
    },
  },
  {
    name: 'get_current_config',
    description: 'Fetch the current live configuration from the database. Call this at the start of the conversation or whenever you need to refresh what the current values are.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

function buildAdminSystemPrompt(config) {
  return `You are the EthanExpert Site Editor — an intelligent admin assistant that helps Ethan Watters manage and improve his AI-powered expert page at ethan-expert.pages.dev.

You have access to two tools:
- get_current_config: fetch the current live site configuration
- save_config: save changes to the live site (always confirm with Ethan before calling this)

YOUR ROLE:
- Help Ethan tune how his AI representative speaks, what it knows, and how it presents itself
- Understand his intentions in plain English and translate them into config changes
- Always show Ethan a clear before/after or description of what you're about to change
- Never save anything without his explicit "yes", "looks good", "save it", or equivalent confirmation
- Be conversational, collaborative, and clear — this is a creative editorial partnership

WHAT YOU CAN CHANGE:
1. System prompt — the AI's full persona, knowledge base, and behavior rules
2. Tagline — the small text above the site name (e.g. "Powered by AI · Evidence-based")
3. Subtitle — the one-liner under "Ask EthanExpert"
4. Welcome message — the first thing the AI says when someone opens the chat
5. Quick questions — the suggestion buttons for each visitor mode (curious / publisher / speaker / academic / collaborator / recruiter)

CURRENT CONFIG (as of session start):
${JSON.stringify(config, null, 2)}

STYLE:
- Be direct and smart. Ethan is a journalist — he'll appreciate precision and will notice vague language.
- When proposing a change to the system prompt, quote the specific passage you're changing and show the replacement.
- For quick questions, show the full updated list for that mode.
- After saving, confirm what changed and invite the next edit.`;
}

// ── Admin conversational agent ────────────────────────────────────
async function handleAdminChat(request, env, origin) {
  const adminPassword = env.ADMIN_PASSWORD;
  const provided = request.headers.get('Admin-Password') || '';
  if (!adminPassword || provided !== adminPassword) {
    return json({ error: 'Unauthorized' }, 401, origin);
  }

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid JSON' }, 400, origin); }

  const { messages } = body; // array of {role, content} from the admin chat UI
  if (!messages || !Array.isArray(messages)) {
    return json({ error: 'messages array required' }, 400, origin);
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'API key not configured' }, 500, origin);

  // Load current config to inject into system prompt
  const currentConfig = await getConfig(env);
  const systemPrompt = buildAdminSystemPrompt(currentConfig);

  // Agentic loop — handle tool calls until we get a final text response
  let loopMessages = [...messages];
  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        system: systemPrompt,
        messages: loopMessages,
        tools: ADMIN_TOOLS,
        max_tokens: 4096,
      }),
    });

    const data = await anthropicResp.json();

    if (!anthropicResp.ok) {
      return json({ error: data.error?.message || 'Anthropic error' }, 502, origin);
    }

    // If stop_reason is end_turn or no tool use, return the text response
    if (data.stop_reason === 'end_turn') {
      const text = data.content.find(b => b.type === 'text')?.text || '';
      return json({ reply: text }, 200, origin);
    }

    // Handle tool use
    if (data.stop_reason === 'tool_use') {
      const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');

      // Add assistant message with tool_use content
      loopMessages.push({ role: 'assistant', content: data.content });

      // Process each tool call
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        let toolResult;

        if (toolUse.name === 'get_current_config') {
          const config = await getConfig(env);
          toolResult = JSON.stringify(config, null, 2);

        } else if (toolUse.name === 'save_config') {
          const fields = toolUse.input?.fields || {};
          try {
            await saveConfig(env, fields);
            toolResult = `Saved successfully. Fields updated: ${Object.keys(fields).join(', ')}`;
          } catch (e) {
            toolResult = `Error saving: ${e.message}`;
          }
        } else {
          toolResult = `Unknown tool: ${toolUse.name}`;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: toolResult,
        });
      }

      // Add tool results as user message and continue loop
      loopMessages.push({ role: 'user', content: toolResults });
      continue;
    }

    // Unexpected stop reason — return whatever text we have
    const text = data.content?.find(b => b.type === 'text')?.text || '';
    return json({ reply: text || 'No response.' }, 200, origin);
  }

  return json({ reply: 'Something went wrong — please try again.' }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/health') {
      return json({ ok: true, version: '4.0.0' }, 200, origin);
    }

    if (url.pathname === '/config' && request.method === 'GET') {
      const config = await getConfig(env);
      return json({ ok: true, config }, 200, origin);
    }

    if (url.pathname === '/admin/chat' && request.method === 'POST') {
      return handleAdminChat(request, env, origin);
    }

    // Legacy /admin GET/POST kept for backward compat
    if (url.pathname === '/admin') {
      const adminPassword = env.ADMIN_PASSWORD;
      const provided = request.headers.get('Admin-Password') || '';
      if (!adminPassword || provided !== adminPassword) {
        return json({ error: 'Unauthorized' }, 401, origin);
      }
      if (request.method === 'GET') {
        const config = await getConfig(env);
        return json({ ok: true, config }, 200, origin);
      }
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); }
        catch { return json({ error: 'Invalid JSON' }, 400, origin); }
        await saveConfig(env, body);
        return json({ ok: true, message: 'Config saved.' }, 200, origin);
      }
    }

    // Chat proxy (POST /)
    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405, origin);
    }

    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) return json({ error: 'API key not set' }, 500, origin);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON' }, 400, origin); }

    if (!body.system) {
      const kv_prompt = await env.CONFIG.get('system_prompt');
      if (kv_prompt) body.system = kv_prompt;
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await anthropicResp.json();
    return json(data, anthropicResp.status, origin);
  },
};
