import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Sparkles,
  FileText,
  Wand2,
  RefreshCw,
  Lightbulb,
  BookOpen,
  FileCode,
  Settings,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { Button, Card, Textarea, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useProviderConfigs } from '@/hooks/api';
import { useProjects, useRepositories, useDeployments } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { aiService, type AIGeneratorType } from '@/services/ai';
import { aiHistoryService } from '@/services/api';

const generators = [
  { id: 'idea' as const, icon: Lightbulb, title: 'Idea to Project', description: 'Shape a rough concept into a buildable roadmap', gradient: 'from-violet-500 to-purple-600' },
  { id: 'readme' as const, icon: FileText, title: 'README Generator', description: 'Write a README that sounds like a real maintainer', gradient: 'from-cyan-500 to-teal-500' },
  { id: 'docs' as const, icon: BookOpen, title: 'Documentation', description: 'Technical docs your team would actually read', gradient: 'from-coral-500 to-peach-500' },
  { id: 'release' as const, icon: FileCode, title: 'Release Notes', description: 'Ship notes without the corporate fluff', gradient: 'from-purple-500 to-violet-600' },
];

const placeholders: Record<AIGeneratorType, string> = {
  idea: 'A CLI tool that scans my repos for outdated dependencies and opens PRs automatically...',
  readme: 'Project: DevOS AI — a developer workspace that connects GitHub, deployments, and AI in one place...',
  docs: 'Document how our deployment sync works: user connects Vercel, edge function pulls deployments...',
  release: 'v1.2.0 — fixed GitHub OAuth callback, added repository filters, improved dashboard stats...',
};

export function AIStudioPage() {
  const { user } = useAuth();
  const { data: providerConfigs = [] } = useProviderConfigs();
  const { data: projects = [] } = useProjects();
  const { data: repositories = [] } = useRepositories();
  const { data: deployments = [] } = useDeployments();

  const [selectedGenerator, setSelectedGenerator] = useState<AIGeneratorType>('idea');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<Array<{ type: string; input: string; output: string; model: string; created_at: string }>>([]);

  const aiConfigured = providerConfigs.some(
    (p) => (p.provider === 'groq' || p.provider === 'gemini') && p.configured
  );
  const activeProvider = providerConfigs.find((p) => p.provider === 'groq' && p.configured)
    ? 'Groq'
    : providerConfigs.find((p) => p.provider === 'gemini' && p.configured)
      ? 'Gemini'
      : null;

  useEffect(() => {
    if (!user) return;
    aiHistoryService.getRecent(user.id, 8).then(setHistory).catch(() => {});
  }, [user, output]);

  const handleGenerate = async () => {
    if (!input.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setOutput('');

    try {
      const context = {
        projects: projects.slice(0, 5).map((p) => ({ name: p.name, status: p.status, technologies: p.technologies ?? [] })),
        repositories: repositories.slice(0, 8).map((r) => ({ full_name: r.full_name, language: r.language })),
        deployments: deployments.slice(0, 5).map((d) => ({ name: d.name, platform: d.platform, status: d.status })),
      };

      const result = await aiService.generate(selectedGenerator, input, context);
      setOutput(result.output);
      setModelUsed(result.model);

      if (user) {
        await aiHistoryService.create(user.id, {
          type: selectedGenerator,
          input: input.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const copyOutput = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!aiConfigured) {
    return (
      <div>
        <PageHeader
          eyebrow="Intelligence"
          title="AI Studio"
          description="Human-quality developer assistance — powered by Groq or Gemini when configured."
        />
        <Card variant="os" padding="none">
          <EmptyState
            icon={<Settings className="w-8 h-8" />}
            title="AI provider not configured"
            description="Add GROQ_API_KEY or GEMINI_API_KEY to your Supabase Edge Function secrets. DevOS uses whichever is available."
            actionLabel="View Configuration"
            onAction={() => { window.location.href = '/config'; }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence"
        title="AI Studio"
        description={`Context-aware generation using your workspace data · ${activeProvider ?? 'AI'} ready`}
        actions={
          activeProvider && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-violet-100 text-violet-700">
              <Sparkles className="w-3.5 h-3.5" />
              {activeProvider}
            </span>
          )
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {generators.map((gen) => (
          <motion.button
            key={gen.id}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedGenerator(gen.id)}
            className={`text-left dev-os-panel p-4 transition-all ${
              selectedGenerator === gen.id ? 'dev-os-glow-ring ring-2 ring-violet-400/30' : 'hover:shadow-card-hover'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gen.gradient} flex items-center justify-center text-white mb-3`}>
              <gen.icon className="w-5 h-5" />
            </div>
            <h3 className="font-display font-semibold text-neutral-900 text-sm">{gen.title}</h3>
            <p className="text-xs text-surface-500 mt-1 leading-relaxed">{gen.description}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card variant="os" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-neutral-900">Your prompt</h2>
            <Button variant="ghost" size="sm" onClick={() => setInput('')}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Clear
            </Button>
          </div>
          <Textarea
            placeholder={placeholders[selectedGenerator]}
            rows={14}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="flex items-center justify-between mt-4 gap-3">
            <p className="text-xs text-surface-500">
              Uses {projects.length} projects, {repositories.length} repos as context
            </p>
            <Button onClick={handleGenerate} isLoading={generating} disabled={!input.trim()}>
              <Wand2 className="w-4 h-4 mr-2" />
              Generate
            </Button>
          </div>
          {error && <p className="mt-3 text-sm text-error-600">{error}</p>}
        </Card>

        <Card variant="os" padding="md" className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-neutral-900">Output</h2>
            {output && (
              <Button variant="ghost" size="sm" onClick={copyOutput}>
                {copied ? <Check className="w-4 h-4 mr-1.5 text-success-600" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </div>
          <div className="flex-1 min-h-[320px]">
            {generating ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
                <p className="text-sm text-surface-600">Thinking through your request...</p>
              </div>
            ) : output ? (
              <pre className="dev-os-code-block h-full max-h-[420px] overflow-y-auto whitespace-pre-wrap">{output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-cyan-100 flex items-center justify-center mb-4">
                  <Brain className="w-7 h-7 text-violet-600" />
                </div>
                <p className="font-medium text-neutral-900">Ready when you are</p>
                <p className="text-sm text-surface-500 mt-1 max-w-xs">Responses read like advice from a senior dev — not a chatbot.</p>
              </div>
            )}
          </div>
          {modelUsed && output && (
            <p className="text-xs text-surface-400 mt-3">Generated with {modelUsed}</p>
          )}
        </Card>
      </div>

      <Card variant="glass" padding="md">
        <h2 className="font-display font-bold text-neutral-900 mb-4">Recent generations</h2>
        {history.length === 0 ? (
          <EmptyState
            icon={<Brain className="w-8 h-8" />}
            title="No history yet"
            description="Your generated content will appear here after your first run."
            variant="default"
          />
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.created_at + item.type} className="p-4 rounded-xl bg-white/60 border border-surface-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-violet-600">{item.type}</span>
                  <span className="text-xs text-surface-400">· {item.model}</span>
                </div>
                <p className="text-sm text-surface-600 line-clamp-2">{item.input}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
