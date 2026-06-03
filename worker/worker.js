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

const CONFIG_KEYS = ['system_prompt', 'tagline', 'subtitle', 'welcome_message', 'quick_questions', 'ab_questions', 'knowledge_base', 'knowledge_base_pending', 'negative_prompt'];

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
      const val = (k === 'quick_questions' || k === 'ab_questions')
        ? JSON.stringify(data[k])
        : String(data[k]);
      writes.push(env.CONFIG.put(k, val));
    }
  }
  await Promise.all(writes);
}

// ── Tool definitions for the admin agent ─────────────────────────
const ADMIN_TOOLS = [
  {
    name: 'get_current_config',
    description: `Fetch the current live config from KV. Returns all fields: system_prompt, knowledge_base (full text), knowledge_base_pending, negative_prompt, tagline, subtitle, welcome_message, quick_questions, ab_questions. Use this when Ethan asks to view, read, or check current content. Do NOT call this unless specifically needed — it loads the full KB which is large.`,
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'save_config',
    description: `Save one or more config fields to the live site. Only call this AFTER the user has explicitly confirmed the change. Fields you can save:
- system_prompt (string): HOW the agent behaves — tone, persona, reasoning style, follow-up logic. Does NOT contain facts about Ethan.
- knowledge_base (string): WHAT the agent knows — verified facts about Ethan Watters: his biography, books, articles, career, quotes, speaking history, etc. This is a separate document from system_prompt.
- tagline (string): small text above the site name
- subtitle (string): the one-liner description under the name
- welcome_message (string): the first message shown in the chat
- quick_questions (object): { modeName: ["q1","q2","q3","q4"] } for each mode
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
    name: 'append_knowledge',
    description: `Append new facts to the knowledge base pending queue WITHOUT reading the existing KB. Use this for "add", "include", "note that" requests. The text is appended to a small pending document that gets read into every session. Fast — does not require loading the full KB. Confirm with Ethan before appending.`,
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to append. Be concise and factual.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'promote_knowledge',
    description: `Merge the pending knowledge additions into the main knowledge base document, then clear the pending queue. Call this when Ethan clicks "Promote" or asks to commit/finalize pending changes. This reconciles the two documents into one.`,
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'append_negative',
    description: `Append a debunked false claim to the Negative Prompt document. Use this whenever Ethan corrects a false fact — e.g. a wrong affiliation, wrong school, wrong degree. The entry should be a short declarative sentence of what is FALSE, e.g. "Ethan Watters does NOT have a master's degree from UC Berkeley." Always pair this with append_knowledge to queue the removal of that false claim from the KB as well (if it appears there). Confirm with Ethan before calling.`,
    input_schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The false claim to record, written as a clear denial. E.g. "Ethan Watters is NOT affiliated with Lucid Minds."' },
      },
      required: ['text'],
    },
  },
];

function buildAdminSystemPrompt(config) {
  return `You are the EthanExpert Site Editor — an intelligent admin assistant that helps Ethan Watters manage and improve his AI-powered expert page at ethan-expert.pages.dev.

You have access to tools:
- get_current_config: fetch current config (KB shown as summary only — fast)
- save_config: save behavior prompt, tagline, subtitle, welcome message, quick questions
- append_knowledge: add new facts to the pending KB queue WITHOUT reading the full KB (fast)
- promote_knowledge: merge pending KB additions into the main KB document and clear the queue
- append_negative: add a debunked false claim to the Negative Prompt document

YOUR ROLE:
- Help Ethan tune how his AI representative speaks, what it knows, and how it presents itself
- Understand his intentions in plain English and translate them into config changes
- Always show Ethan a clear before/after or description of what you're about to change
- Never save anything without his explicit "yes", "looks good", "save it", or equivalent confirmation
- Be conversational, collaborative, and clear — this is a creative editorial partnership

THREE SEPARATE DOCUMENTS — keep them distinct, with a strict priority hierarchy:

1. BEHAVIOR PROMPT (system_prompt) — HOW the agent thinks and speaks.
   Tone, persona, reasoning style, follow-up logic, rules of engagement.
   Does NOT contain facts about Ethan. Think of it as the agent's personality and operating instructions.

2. KNOWLEDGE BASE (knowledge_base) — WHAT the agent knows.
   Verified facts: Ethan's biography, books, articles, career history, quotes, academic reception, speaking history, etc.
   Ethan can add new facts, correct errors, or expand sections here.
   Does NOT contain behavioral instructions.

3. RECENT UPDATES / PENDING (knowledge_base_pending) — NEW facts not yet reconciled into the KB.
   OVERRIDE RULE: Any fact here takes precedence over conflicting information in the Knowledge Base.
   Use this for fast corrections without a full KB edit. Promote to KB when stable.

4. NEGATIVE PROMPT (negative_prompt) — WHAT IS FALSE.
   ABSOLUTE OVERRIDE: Overrides ALL other sources — KB, pending, everything.
   A list of debunked claims the agent must actively deny if they come up.
   Populated by Ethan whenever he corrects a misinformation the AI has repeated.

PRIORITY ORDER (highest wins): Negative Prompt > Pending Updates > Knowledge Base > Behavior Prompt

DEBUNK WORKFLOW — when Ethan says something like "that's wrong" or "I never went there":
  Step 1: append_negative — record the false claim as a clear denial
  Step 2: append_knowledge — queue a correction or removal note for the KB
  Step 3: Confirm with Ethan what was recorded

When someone asks to change "how the agent responds" → edit system_prompt.
When someone asks to add or correct facts about Ethan → edit knowledge_base (via pending queue).
When someone debunks a false claim → append_negative + append_knowledge together.

OTHER EDITABLE FIELDS:
- tagline — small text above the site name
- subtitle — the one-liner under the title
- welcome_message — first message in the chat
- quick_questions — suggestion buttons per visitor mode

CURRENT CONFIG (as of session start):
BEHAVIOR PROMPT (system_prompt):
${config.system_prompt || '(not set)'}

---

KNOWLEDGE BASE (knowledge_base):
[${config.knowledge_base ? Math.round(config.knowledge_base.length / 1000) + 'K chars — use get_current_config to read or edit it. Do NOT load it unless Ethan specifically asks to view or change it.' : '(not set)'}]

---

NEGATIVE PROMPT (negative_prompt):
${config.negative_prompt || '(empty — no false claims recorded yet)'}

---

OTHER CONFIG:
${JSON.stringify({ tagline: config.tagline, subtitle: config.subtitle, welcome_message: config.welcome_message }, null, 2)}

STYLE:
- Be direct and smart. Ethan is a journalist — he'll appreciate precision and will notice vague language.
- When proposing a change to the behavior prompt, quote the specific passage and show the replacement.
- When proposing a change to the knowledge base, show exactly what you're adding/changing/removing.
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
          // Don't return full KB — just a summary to keep context small
          const summary = { ...config };
          if (summary.knowledge_base) summary.knowledge_base = `[${Math.round(summary.knowledge_base.length/1000)}K chars — use append_knowledge to add facts, or promote_knowledge to reconcile]`;
          toolResult = JSON.stringify(summary, null, 2);

        } else if (toolUse.name === 'append_knowledge') {
          const text = toolUse.input?.text || '';
          try {
            const existing = await env.CONFIG.get('knowledge_base_pending') || '';
            const newPending = existing
              ? existing + '\n\n' + text.trim()
              : text.trim();
            await env.CONFIG.put('knowledge_base_pending', newPending);
            toolResult = `Appended to pending knowledge base. Pending now has ${newPending.length} chars. Use promote_knowledge to merge into the main document.`;
          } catch (e) {
            toolResult = `Error appending: ${e.message}`;
          }

        } else if (toolUse.name === 'promote_knowledge') {
          try {
            const main    = await env.CONFIG.get('knowledge_base') || '';
            const pending = await env.CONFIG.get('knowledge_base_pending') || '';
            if (!pending) {
              toolResult = 'Nothing pending to promote.';
            } else {
              const merged = main + '\n\n--- ADDITIONS (reconciled) ---\n' + pending;
              await env.CONFIG.put('knowledge_base', merged);
              await env.CONFIG.put('knowledge_base_pending', '');
              toolResult = `Promoted. Main KB is now ${merged.length} chars. Pending queue cleared.`;
            }
          } catch (e) {
            toolResult = `Error promoting: ${e.message}`;
          }

        } else if (toolUse.name === 'append_negative') {
          const text = toolUse.input?.text || '';
          try {
            const existing = await env.CONFIG.get('negative_prompt') || '';
            const timestamp = new Date().toISOString().slice(0, 10);
            const entry = `[${timestamp}] ${text.trim()}`;
            const updated = existing ? existing + '\n' + entry : entry;
            await env.CONFIG.put('negative_prompt', updated);
            toolResult = `Added to Negative Prompt: "${entry}". Remember to also use append_knowledge to queue removal of this from the KB if it appears there.`;
          } catch (e) {
            toolResult = `Error updating negative prompt: ${e.message}`;
          }

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
      const behavior  = await env.CONFIG.get('system_prompt');
      const knowledge = await env.CONFIG.get('knowledge_base');
      const pending   = await env.CONFIG.get('knowledge_base_pending');
      const negative  = await env.CONFIG.get('negative_prompt');

      if (!knowledge && !pending) {
        // No KB — just use behavior prompt
        if (behavior) body.system = behavior;
      } else {
        // ── TWO-STEP RAG PIPELINE ──────────────────────────────────────────
        //
        // Step 1 (Retrieval): Ask a fast model to extract ONLY the passages
        //   from the KB that are relevant to the user's question. No answering.
        //
        // Step 2 (Answer): Pass only those extracted passages to the answer model
        //   with a strict grounding instruction. The model has NO access to the
        //   full KB — only what retrieval returned. Cannot hallucinate what isn't there.
        //
        const apiKey = env.ANTHROPIC_API_KEY;

        // Build the full KB document
        let fullDoc = knowledge || '';
        if (pending) fullDoc += '\n\n--- RECENT ADDITIONS ---\n\n' + pending;
        if (negative) fullDoc += '\n\n--- FALSE CLAIMS (never state these) ---\n\n' + negative;

        // Get the last user message as the query
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        const query = typeof lastUserMsg?.content === 'string'
          ? lastUserMsg.content
          : (lastUserMsg?.content?.[0]?.text || '');

        // ── STEP 1: RETRIEVAL ────────────────────────────────────────────
        const retrievalResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5',
            max_tokens: 4000,
            system: `You are a precise document retrieval system. Your only job is to extract relevant passages from a source document.

RULES:
- Copy passages from the document VERBATIM. Do not paraphrase, summarize, or add anything.
- Include every passage that is relevant to the query. Be generous — include context.
- If the query asks about a topic, include ALL passages related to that topic.
- If nothing is relevant, output exactly: NO_RELEVANT_PASSAGES
- Do not add commentary, headers, or any text of your own. Only copied passages.`,
            messages: [{
              role: 'user',
              content: `SOURCE DOCUMENT:\n\n${fullDoc}\n\n${'─'.repeat(60)}\n\nQUERY: ${query}\n\nCopy every passage from the source document that is relevant to this query. Verbatim only.`,
            }],
          }),
        });

        const retrievalData = await retrievalResp.json();
        const passages = retrievalData?.content?.[0]?.text || 'NO_RELEVANT_PASSAGES';

        // ── STEP 2: ANSWER ───────────────────────────────────────────────
        const groundedSystem = (behavior || 'You are EthanExpert, a knowledgeable guide to Ethan Watters.') +
          `\n\n════════════════════════════════════════════════════\nGROUNDING RULE — ABSOLUTE\n════════════════════════════════════════════════════\nYou have been given retrieved source passages. These are your ONLY factual source.\nEvery claim must be directly supported by the passages. If the passages do not contain a fact, do not state it.\nIf passages do not mention something, say it is not in your record.\nYour training data about Ethan Watters is NOT a valid source. The passages are ground truth.\n════════════════════════════════════════════════════`;

        body.system = groundedSystem;
        body.messages = [
          {
            role: 'user',
            content: `RETRIEVED PASSAGES — your only factual source:\n\n${passages}`,
          },
          {
            role: 'assistant',
            content: 'I have read the retrieved passages and will answer using only the facts they contain.',
          },
          ...messages.slice(0, -1),
          lastUserMsg,
        ].filter(Boolean);
      }
    }


    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(body),
    });

    const data = await anthropicResp.json();
    return json(data, anthropicResp.status, origin);
  },
};
