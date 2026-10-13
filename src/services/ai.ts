import { supabase } from '@/lib/supabase';

export type AIGeneratorType =
  | 'analyze'
  | 'roadmap'
  | 'architecture'
  | 'readme'
  | 'docs'
  | 'plan'
  | 'release'
  | 'audit'
  | 'idea';

export interface AIWorkspaceContext {
  target?: {
    type: 'workspace' | 'repository' | 'project' | 'custom';
    name?: string;
    details?: string;
  };
  projects?: Array<{ name: string; status?: string; technologies?: string[] }>;
  repositories?: Array<{ full_name: string; language?: string | null; description?: string | null }>;
  deployments?: Array<{ name: string; platform: string; status?: string; url?: string }>;
}

export interface AIGeneratePayload {
  type: AIGeneratorType;
  idea: string;
  analysis?: string;
  previousArtifacts?: {
    roadmap?: string;
    architecture?: string;
    readme?: string;
    docs?: string;
  };
  context?: AIWorkspaceContext;
}

export interface AIGenerateResponse {
  output: string;
  model: string;
  provider: string;
}

export const aiService = {
  async generate(
    typeOrPayload: AIGeneratorType | AIGeneratePayload,
    legacyInput?: string,
    legacyContext?: AIWorkspaceContext
  ): Promise<AIGenerateResponse> {
    const payload: AIGeneratePayload =
      typeof typeOrPayload === 'string'
        ? {
            type: typeOrPayload,
            idea: legacyInput || '',
            context: legacyContext,
          }
        : typeOrPayload;

    try {
      const { data, error } = await supabase.functions.invoke('ai-generate', {
        body: {
          type: payload.type,
          idea: payload.idea,
          input: payload.idea, // for backward compatibility
          analysis: payload.analysis,
          previousArtifacts: payload.previousArtifacts,
          context: payload.context,
        },
      });

      if (!error && !data?.error && data?.output) {
        return data as AIGenerateResponse;
      }

      let errMsg = data?.error || error?.message || '';

      // Extract detailed server-side error payload from Supabase FunctionsHttpError context
      if (error && typeof (error as { context?: { json?: () => Promise<unknown> } }).context?.json === 'function') {
        try {
          const body = (await (error as { context: { json: () => Promise<Record<string, string>> } }).context.json()) as Record<string, string>;
          if (body?.error) {
            errMsg = body.error;
          } else if (body?.message) {
            errMsg = body.message;
          }
        } catch {
          // If body reading fails, keep existing errMsg
        }
      }

      // Check for missing AI provider key in secrets
      if (errMsg.toLowerCase().includes('no ai provider configured')) {
        throw new Error(
          'AI Provider Key Missing: Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in Supabase Edge Function secrets. Set the secret with "npx supabase secrets set GROQ_API_KEY=..." or inspect status in Configuration.'
        );
      }

      // Check for rate limit / quota
      if (
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('rate limit') ||
        errMsg.toLowerCase().includes('quota')
      ) {
        throw new Error(
          `AI Provider Quota Error: Rate limit or quota exceeded on the AI provider (${errMsg}). Please try again in a few moments or configure a backup key.`
        );
      }

      // Check for specific provider/network connectivity errors
      if (
        errMsg.includes('could not be resolved') ||
        errMsg.includes('connection was aborted') ||
        errMsg.includes('Failed to fetch') ||
        errMsg.includes('NetworkError')
      ) {
        throw new Error(
          `AI Provider Network Error: Unable to reach the AI gateway (${errMsg}). Please check your internet connection or verify provider status in Configuration.`
        );
      }

      throw new Error(errMsg || 'AI generation failed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes('could not be resolved') ||
        msg.includes('connection was aborted') ||
        msg.includes('Failed to fetch')
      ) {
        throw new Error(
          'AI Provider Connection Error: The connection was aborted or the AI endpoint could not be resolved. Please verify your internet connection or inspect provider settings in Configuration.'
        );
      }
      throw err;
    }
  },
};
