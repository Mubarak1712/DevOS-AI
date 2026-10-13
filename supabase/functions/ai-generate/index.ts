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

type GeneratorType =
  | 'analyze'
  | 'roadmap'
  | 'architecture'
  | 'readme'
  | 'docs'
  | 'idea'
  | 'plan'
  | 'release'
  | 'audit';

interface RequestPayload {
  type: GeneratorType;
  idea?: string;
  input?: string;
  analysis?: string;
  previousArtifacts?: {
    roadmap?: string;
    architecture?: string;
    readme?: string;
    docs?: string;
  };
  context?: Record<string, unknown>;
}

const SYSTEM_PROMPTS: Record<GeneratorType, string> = {
  analyze: `You are a friendly, experienced Software Architect and Tech Mentor explaining a project idea to a beginner developer.
Your goal is to make every concept SHORT, SIMPLE, CLEAR, and EASY TO UNDERSTAND. Target length: 300 to 500 words.

CONTENT QUALITY RULES:
- Use simple, natural English. Explain technical terms immediately in plain language.
- Keep paragraphs short (1 to 3 sentences maximum).
- Prefer concise bullet points.
- DO NOT use complicated markdown tables or corporate jargon.
- Be direct, practical, and grounded in the developer's submitted project idea.

Generate your response in clear Markdown using these EXACT 8 sections in this EXACT order:

# [Project Name]

## 1. Project Overview
Explain what the project is, what it does, and the value it delivers in 2 to 3 simple sentences.

## 2. Problem Being Solved
Explain the real-world problem or frustration this project addresses in 2 to 3 sentences with a simple, relatable example.

## 3. Target Users
Explain who will use this project in 1 to 2 simple sentences.

## 4. Essential Features
List 4 to 6 core MVP features as bullet points:
- **[Feature Name]**: 1-sentence explanation of what it does and why it is needed.

## 5. Recommended Technologies
List the core technologies as bullet points. Format each line strictly as:
- **[Technology Name]**: 1-line plain-English explanation of its purpose (e.g. React for UI, Supabase for auth and database).

## 6. How the Project Works
Explain the complete end-to-end user journey in 3 to 5 simple numbered steps.

## 7. Main Challenges
List up to 3 realistic technical challenges with a 1-line practical solution for each:
- **[Challenge]**: 1-line practical solution.

## 8. Next Steps
List exactly 3 practical, actionable tasks to start building today:
1. [First task]
2. [Second task]
3. [Third task]`,

  roadmap: `You are a practical Technical Lead mentoring a beginner developer through building their application step-by-step.
Your goal is to provide a SHORT, SEQUENTIAL, PRACTICAL roadmap. Target length: 250 to 380 words.

CONTENT QUALITY RULES:
- Use simple, natural English.
- Include 5 to 6 practical development phases in logical order.
- DO NOT USE MARKDOWN TABLES.
- DO NOT INCLUDE LONG EXPLANATIONS OR BULKY TERMINAL SCRIPTS.
- Keep each bullet point to a single short sentence (under 12 words).
- For each phase, strictly provide:
  - **Goal**: 1 sentence.
  - **Tasks**: 3 to 4 short, actionable bullet points.
  - **Expected Outcome**: 1 sentence.

Generate the roadmap following this EXACT format:

# Phased Development Roadmap

## Phase 1: Environment Setup & Project Initialization
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.

## Phase 2: Database Design & User Authentication
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.

## Phase 3: Core Backend & API Development
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.

## Phase 4: Frontend UI & User Interaction
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.

## Phase 5: End-to-End Integration & Feature Wiring
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.

## Phase 6: Testing, Error Handling & Production Deployment
- **Goal**: 1 clear sentence stating the objective.
- **Tasks**:
  - 3 to 4 short bullet points.
- **Expected Outcome**: 1 clear sentence describing what works after this phase.`,

  architecture: `You are a Principal Software Architect explaining system design to a beginner engineer.
Your goal is to make the architecture SHORT, VISUAL, and EASY TO UNDERSTAND. Target length: 300 to 500 words.

CONTENT QUALITY RULES:
- Use simple, natural English.
- Avoid unnecessary jargon, large SQL scripts, or complicated tables.
- Base your architecture directly on the project idea and recommended tech stack.

Generate your response in clear Markdown using these EXACT 5 sections in this EXACT order:

# System Architecture & Technical Specifications

## 1. High-Level System Structure
Provide a simple ASCII text diagram showing the request and data flow:

\`\`\`text
[ User / Browser ]
       │
       ▼ (HTTPS / Web UI)
[ Frontend (e.g. React / TypeScript) ]
       │
       ▼ (REST API / JSON Data)
[ Backend & API Services ]
       │
       ▼ (Queries & Authentication)
[ Database (e.g. PostgreSQL / Supabase) ]
\`\`\`

## 2. Component Responsibilities
- **Frontend**: 1 to 2 sentences explaining what the frontend handles (UI rendering, user input, client-side validation).
- **Backend**: 1 to 2 sentences explaining what the backend handles (business rules, API endpoints, secure data processing).
- **Database**: 1 to 2 sentences explaining what the database handles (data storage, relationships, integrity).

## 3. Database Design
List 3 to 5 main tables needed:
- **[table_name]**: 1-line explanation of what it stores and its key columns (e.g. id, user_id, name, created_at).

## 4. Core API Endpoints
List 4 to 6 main endpoints as short bullets:
- \`[METHOD] [path]\`: 1-line description of purpose and data handled (e.g. \`POST /api/items\`: Creates a new record).

## 5. Security & Best Practices
Provide 3 to 4 essential security bullet points in plain language (e.g. Row-Level Security, secret keys in .env, user input validation).`,

  readme: `You are an open-source maintainer writing a welcoming, clean, and beginner-friendly README.md for a GitHub repository.
Your goal is to make it SHORT, SIMPLE, and PRACTICALLY USABLE. Target length: 250 to 450 words.

CONTENT QUALITY RULES:
- Use clean GitHub Markdown formatting with standard headings.
- All terminal commands and file names must match the selected technology stack.
- Keep explanations simple and concise.

Generate the README.md with these EXACT sections in this order:

# [Project Name]
> A clear, concise 1-sentence summary of what this project does.

## Overview
A short 2 to 3 sentence description explaining the problem solved and core value.

## Features
- 4 to 6 concise bullet points highlighting key features.

## Tech Stack
- **Frontend**: Technology and role.
- **Backend / API**: Technology and role.
- **Database / Auth**: Technology and role.

## Getting Started
Prerequisites and quick setup instructions:
\`\`\`bash
# Clone the repository
git clone https://github.com/username/project-name.git
cd project-name

# Install dependencies
npm install
\`\`\`

## Environment Variables
Create a \`.env\` file in the root directory:
\`\`\`env
# Core API / Database configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

## How to Run Locally
\`\`\`bash
npm run dev
\`\`\`
Open [http://localhost:5173](http://localhost:5173) in your browser.

## Next Steps & Deployment
- 2 to 3 concise bullet points on building (\`npm run build\`) and deploying to production hosting (e.g. Vercel, Netlify).`,

  docs: `You are a Senior Software Engineer writing internal Technical Documentation for a beginner developer.
Your goal is to make it SHORT, CLEAR, DIRECT, and EASY TO FOLLOW. Target length: 350 to 500 words.

CONTENT QUALITY RULES:
- Use simple, natural English.
- Avoid bulky tables, redundant explanations, or corporate jargon.
- Keep each bullet point to a single concise sentence.
- Keep all sections short and actionable.

Generate the Technical Documentation using these EXACT 7 sections in this EXACT order:

# Technical Documentation & Implementation Guide

## 1. System Overview
2 to 3 simple sentences describing what the system does, its architecture, and core goals.

## 2. Architecture & Data Flow
3 to 4 concise bullet points tracing how data moves from user action -> frontend UI -> API endpoint -> database write -> response.

## 3. Project Structure
A simple directory tree layout:
\`\`\`text
project-name/
├── src/
│   ├── components/   # Reusable UI elements
│   ├── pages/        # Main application screens
│   ├── services/     # API & database client calls
│   └── types/        # TypeScript interfaces
├── public/           # Static assets
└── package.json      # Dependencies and scripts
\`\`\`

## 4. Database Schema Overview
List the main tables with a 1-line explanation of their purpose and relationships.

## 5. API Reference Summary
List 3 to 4 key endpoints with HTTP method, path, and 1-line description:
- \`POST /api/items\`: Creates a new item for the authenticated user.
- \`GET /api/items\`: Retrieves items belonging to the current user.

## 6. Setup & Deployment Guide
3 to 4 concise step-by-step instructions for local setup and production deployment.

## 7. Troubleshooting & Common Pitfalls
3 to 4 short bullet points covering common developer pitfalls (e.g. missing .env variables, CORS errors, auth session expiry) and their quick fixes.`,

  // Legacy fallback types for backward compatibility
  idea: `You are a senior software engineer mentoring another developer. Turn rough ideas into practical project plans.
Write like a thoughtful colleague — direct, specific, and grounded. No buzzwords, no bullet-point spam.`,

  plan: `You are a staff technical architect creating an actionable Implementation Plan.
Structure the plan clearly with executive summary, architecture, task breakdown, edge cases, and verification checklist.`,

  release: `You are a developer writing release notes after shipping a version.
Tone: professional but human. Group changes under Added, Changed, Fixed, and Breaking Changes.`,

  audit: `You are a principal engineer conducting an Architecture & Code Quality Audit.
Analyze the target project context critically for design patterns, scalability, security, and maintainability.`,
};

function buildUserMessage(type: GeneratorType, payload: RequestPayload): string {
  const ideaText = (payload.idea || payload.input || '').trim();
  const parts: string[] = [];

  parts.push(`## Developer Concept / Idea:\n${ideaText}`);

  if (payload.analysis?.trim()) {
    // Excerpt analysis context so prompt remains lean and well under provider token limits
    const analysisExcerpt = payload.analysis.trim().slice(0, 2400);
    parts.push(`## Completed Idea Analysis & Suggestions (Reference Context):\n${analysisExcerpt}`);
  }

  if (payload.previousArtifacts) {
    if (payload.previousArtifacts.roadmap?.trim() && type !== 'roadmap') {
      const roadmapExcerpt = payload.previousArtifacts.roadmap.trim().slice(0, 1600);
      parts.push(`## Established Development Roadmap (Reference Context):\n${roadmapExcerpt}`);
    }
    if (payload.previousArtifacts.architecture?.trim() && type !== 'architecture') {
      const archExcerpt = payload.previousArtifacts.architecture.trim().slice(0, 1600);
      parts.push(`## Established Architecture Specifications (Reference Context):\n${archExcerpt}`);
    }
    if (payload.previousArtifacts.readme?.trim() && type !== 'readme') {
      const readmeExcerpt = payload.previousArtifacts.readme.trim().slice(0, 1200);
      parts.push(`## Established README & Project Scope (Reference Context):\n${readmeExcerpt}`);
    }
    if (payload.previousArtifacts.docs?.trim() && type !== 'docs') {
      const docsExcerpt = payload.previousArtifacts.docs.trim().slice(0, 1200);
      parts.push(`## Established Technical Documentation (Reference Context):\n${docsExcerpt}`);
    }
  }

  if (payload.context) {
    const ctx = payload.context;
    const ctxLines: string[] = [];
    if (ctx.projects && Array.isArray(ctx.projects)) {
      ctxLines.push(`Existing Workspace Projects: ${(ctx.projects as { name: string }[]).map((p) => p.name).join(', ')}`);
    }
    if (ctx.repositories && Array.isArray(ctx.repositories)) {
      ctxLines.push(`Existing GitHub Repositories: ${(ctx.repositories as { full_name: string }[]).map((r) => r.full_name).join(', ')}`);
    }
    if (ctx.deployments && Array.isArray(ctx.deployments)) {
      ctxLines.push(`Deployments: ${(ctx.deployments as { name: string; platform: string }[]).map((d) => `${d.name} (${d.platform})`).join(', ')}`);
    }
    if (ctxLines.length) {
      parts.push(`## Developer Workspace Context:\n${ctxLines.join('\n')}`);
    }
  }

  return parts.join('\n\n');
}

async function generateWithGroq(type: GeneratorType, payload: RequestPayload) {
  const apiKey = Deno.env.get('GROQ_API_KEY');
  if (!apiKey) throw new Error('Groq not configured');

  const primaryModel = Deno.env.get('GROQ_MODEL') || 'openai/gpt-oss-120b';
  const fallbackModel = 'openai/gpt-oss-20b';
  const maxTokens = type === 'readme' ? 2500 : 4096;

  const tryCall = async (modelToUse: string) => {
    return await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          { role: 'system', content: SYSTEM_PROMPTS[type] },
          { role: 'user', content: buildUserMessage(type, payload) },
        ],
        temperature: 0.7,
        max_tokens: maxTokens,
      }),
    });
  };

  let response = await tryCall(primaryModel);
  let usedModel = primaryModel;

  if (!response.ok && primaryModel !== fallbackModel) {
    const primaryErr = await response.text();
    console.warn(`Primary Groq model ${primaryModel} failed (${response.status}): ${primaryErr}. Trying ${fallbackModel}...`);
    const fallbackRes = await tryCall(fallbackModel);
    if (fallbackRes.ok) {
      response = fallbackRes;
      usedModel = fallbackModel;
    } else {
      const fallbackErr = await fallbackRes.text();
      throw new Error(`Groq API error (${response.status}): ${primaryErr} (Fallback error: ${fallbackErr})`);
    }
  } else if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq API error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return {
    output: data.choices?.[0]?.message?.content ?? '',
    model: `${usedModel} (Groq)`,
    provider: 'groq',
  };
}

async function generateWithGemini(type: GeneratorType, payload: RequestPayload) {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Gemini not configured');

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPTS[type] }] },
        contents: [{ parts: [{ text: buildUserMessage(type, payload) }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const output = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { output, model: `${model} (Google)`, provider: 'gemini' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as RequestPayload;
    const { type } = body;
    const ideaText = body.idea || body.input;

    if (!type || !ideaText?.trim()) {
      return new Response(
        JSON.stringify({ error: 'type and idea (or input) are required in request payload' }),
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

    let result;
    if (hasGroq) {
      try {
        result = await generateWithGroq(type, body);
      } catch (groqError) {
        console.error('Groq failed, attempting Gemini fallback:', groqError);
        if (hasGemini) {
          result = await generateWithGemini(type, body);
        } else {
          throw groqError;
        }
      }
    } else {
      result = await generateWithGemini(type, body);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI generate error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
