import { supabase } from '@/lib/supabase';

export type AIGeneratorType = 'idea' | 'readme' | 'docs' | 'release';

export interface AIWorkspaceContext {
  projects?: Array<{ name: string; status?: string; technologies?: string[] }>;
  repositories?: Array<{ full_name: string; language?: string | null }>;
  deployments?: Array<{ name: string; platform: string; status?: string }>;
}

export const aiService = {
  async generate(type: AIGeneratorType, input: string, context?: AIWorkspaceContext) {
    const { data, error } = await supabase.functions.invoke('ai-generate', {
      body: { type, input, context },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    return data as { output: string; model: string; provider: string };
  },
};
