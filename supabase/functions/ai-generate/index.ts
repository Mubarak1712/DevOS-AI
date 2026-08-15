export{};

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type GeneratorType = 'idea' | 'readme' | 'docs' | 'release';

const SYSTEM_PROMPTS: Record<GeneratorType, string> = {
  idea: `You are a senior software engineer mentoring another developer. Turn rough ideas into practical project plans.
Write like a thoughtful colleague — direct, specific, and grounded. No buzzwords, no "Certainly!", no bullet-point spam.
Structure: project vision (2 sentences), core features (numbered, concrete), suggested stack (with brief why), milestones (week-by-week), and first steps for today.
If the idea is vague, make reasonable assumptions and say so briefly.`,

  readme: `You are an experienced open-source maintainer writing a README for a real repository.
Sound human and confident — not like a template generator. Include: title, one-line pitch, problem it solves, quick start, usage example, and contributing note.
Use markdown. Skip filler phrases like "Welcome to" or "This project aims to". Write for developers who skim.`,

  docs: `You are a staff engineer documenting an internal tool for your team.
Write clear technical docs: overview, architecture in plain language, setup steps, key concepts, and common troubleshooting.
Be concise but thorough. Use markdown headers. Avoid robotic AI phrasing — write like internal Notion docs you'd actually read.`,

  release: `You are a developer writing release notes after shipping a version.
Tone: professional but human. Group changes under Added, Changed, Fixed. Be specific about what changed and why it matters.
If commit details are sparse, infer sensible changes from context. No "We're excited to announce".`,

};

function buildUserMessage(type: GeneratorType, input: string, context?: Record<string, unknown>): string {
  const parts = [input.trim()];
  if (context) {
    const ctxLines: string[] = [];
    if (context.projects && Array.isArray(context.projects)) {
      ctxLines.push(`User projects: ${(context.projects as { name: string }[]).map((p) => p.name).join(', ')}`);
    }
    if (context.repositories && Array.isArray(context.repositories)) {
      ctxLines.push(`GitHub repos: ${(context.repositories as { full_name: string }[]).map((r) => r.full_name).join(', ')}`);
    }
    if (context.deployments && Array.isArray(context.deployments)) {
      ctxLines.push(`Deployments: ${(context.deployments as { name: string; platform: string }[]).map((d) => `${d.name} (${d.platform})`).join(', ')}`);
    }
    if (ctxLines.length) parts.push('\n--- Workspace context ---\n' + ctxLines.join('\n'));
  }
  return parts.join('\n\n');
}

async function generateWithGroq(type: GeneratorType, input: string, context?: Record<string, unknown>) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('Groq not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[type] },
        { role: 'user', content: buildUserMessage(type, input, context) },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    output: data.choices?.[0]?.message?.content ?? '',
    model: 'llama-3.3-70b-versatile (Groq)',
    provider: 'groq',
  };
}

async function generateWithGemini(type: GeneratorType, input: string, context?: Record<string, unknown>) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini not configured');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPTS[type] }] },
        contents: [{ parts: [{ text: buildUserMessage(type, input, context) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${err}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { output, model: 'gemini-2.0-flash', provider: 'gemini' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, input, context } = body as {
      type: GeneratorType;
      input: string;
      context?: Record<string, unknown>;
    };

    if (!type || !input?.trim()) {
      return new Response(
        JSON.stringify({ error: 'type and input are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!SYSTEM_PROMPTS[type]) {
      return new Response(
        JSON.stringify({ error: `Unknown generator type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasGroq = !!Deno.env.get('GROQ_API_KEY');
    const hasGemini = !!Deno.env.get('GEMINI_API_KEY');

    if (!hasGroq && !hasGemini) {
      return new Response(
        JSON.stringify({ error: 'No AI provider configured. Add GROQ_API_KEY or GEMINI_API_KEY to Edge Function secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = hasGroq
      ? await generateWithGroq(type, input, context)
      : await generateWithGemini(type, input, context);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI generate error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
