import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Brain,
  Sparkles,
  FileText,
  BookOpen,
  Compass,
  Layers,
  Copy,
  Check,
  Loader2,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
  Lightbulb,
  FolderKanban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button, Card, Textarea, EmptyState, Modal, Input } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import {
  useProviderConfigs,
  useProjects,
  useRepositories,
  useIdeas,
  useCreateIdea,
  useCreateProject,
} from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { aiService, type AIWorkspaceContext } from '@/services/ai';
import { aiHistoryService } from '@/services/api';
import type { Idea } from '@/types';

type StudioTab = 'analysis' | 'roadmap' | 'architecture' | 'readme' | 'docs';

export function AIStudioPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: providerConfigs = [] } = useProviderConfigs();
  const { data: projects = [] } = useProjects();
  const { data: repositories = [] } = useRepositories();
  const { data: ideas = [] } = useIdeas();
  const createIdeaMutation = useCreateIdea();
  const createProjectMutation = useCreateProject();

  // STEP 1: Idea Input State
  const [ideaInput, setIdeaInput] = useState('');
  const [selectedVaultIdeaId, setSelectedVaultIdeaId] = useState('');

  // Context Enrichment (Optional)
  const [includeContext, setIncludeContext] = useState(false);
  const [contextType, setContextType] = useState<'workspace' | 'repository' | 'project'>('workspace');
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [showContextPreview, setShowContextPreview] = useState(false);

  // STEP 2 & 3: Outputs organized around the SAME idea (Preserved across tab switches)
  const [activeTab, setActiveTab] = useState<StudioTab>('analysis');
  const [analysisOutput, setAnalysisOutput] = useState('');
  const [roadmapOutput, setRoadmapOutput] = useState('');
  const [architectureOutput, setArchitectureOutput] = useState('');
  const [readmeOutput, setReadmeOutput] = useState('');
  const [docsOutput, setDocsOutput] = useState('');

  // Loading states per section
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [isGeneratingArchitecture, setIsGeneratingArchitecture] = useState(false);
  const [isGeneratingReadme, setIsGeneratingReadme] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  // Dedicated error states per section (ensures failure in one section never affects others)
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);
  const [architectureError, setArchitectureError] = useState<string | null>(null);
  const [readmeError, setReadmeError] = useState<string | null>(null);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedToVaultSuccess, setSavedToVaultSuccess] = useState(false);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [vaultSaveError, setVaultSaveError] = useState<string | null>(null);
  const [historyRestoredNote, setHistoryRestoredNote] = useState<string | null>(null);

  // Convert to Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectTechStack, setProjectTechStack] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectCreateError, setProjectCreateError] = useState<string | null>(null);

  const [history, setHistory] = useState<Array<{ type: string; input: string; output: string; model: string; created_at: string }>>([]);

  const aiConfigured = providerConfigs.some(
    (p) => (p.provider === 'groq' || p.provider === 'gemini') && p.configured
  );
  const activeProvider = providerConfigs.find((p) => p.provider === 'groq' && p.configured)
    ? 'Groq'
    : providerConfigs.find((p) => p.provider === 'gemini' && p.configured)
      ? 'Gemini'
      : null;

  // Handle incoming idea from navigation (e.g. from IdeasPage)
  useEffect(() => {
    const incomingIdea = (location.state as { idea?: Idea })?.idea;
    if (incomingIdea) {
      const combined = `${incomingIdea.title}\n\n${incomingIdea.description || ''}`.trim();
      setIdeaInput(combined);
      setSelectedVaultIdeaId(incomingIdea.id);
    }
  }, [location.state]);

  // Load recent history
  useEffect(() => {
    if (!user) return;
    aiHistoryService.getRecent(user.id, 8).then(setHistory).catch(() => {});
  }, [user, analysisOutput, roadmapOutput, architectureOutput, readmeOutput, docsOutput]);

  // Set default repo and project
  useEffect(() => {
    if (repositories.length > 0 && !selectedRepoId) setSelectedRepoId(repositories[0].id);
    if (projects.length > 0 && !selectedProjectId) setSelectedProjectId(projects[0].id);
  }, [repositories, projects, selectedRepoId, selectedProjectId]);

  const selectedRepo = useMemo(() => repositories.find((r) => r.id === selectedRepoId), [repositories, selectedRepoId]);
  const selectedProject = useMemo(() => projects.find((p) => p.id === selectedProjectId), [projects, selectedProjectId]);

  // Workspace context payload
  const computedContext = useMemo<AIWorkspaceContext | undefined>(() => {
    if (!includeContext) return undefined;

    if (contextType === 'repository' && selectedRepo) {
      return {
        target: {
          type: 'repository',
          name: selectedRepo.full_name,
          details: `Primary language: ${selectedRepo.language || 'Plain'} | Branch: ${selectedRepo.default_branch || 'main'} | Description: ${selectedRepo.description || 'None'}`,
        },
        repositories: [{
          full_name: selectedRepo.full_name,
          language: selectedRepo.language,
          description: selectedRepo.description,
        }],
      };
    }

    if (contextType === 'project' && selectedProject) {
      return {
        target: {
          type: 'project',
          name: selectedProject.name,
          details: `Status: ${selectedProject.status} | Tech: ${(selectedProject.technologies || []).join(', ')}`,
        },
        projects: [{
          name: selectedProject.name,
          status: selectedProject.status,
          technologies: selectedProject.technologies ?? [],
        }],
      };
    }

    return {
      target: {
        type: 'workspace',
        name: 'Workspace Codebases',
        details: `${projects.length} projects, ${repositories.length} repositories`,
      },
      projects: projects.slice(0, 4).map((p) => ({
        name: p.name,
        status: p.status,
        technologies: p.technologies ?? [],
      })),
      repositories: repositories.slice(0, 6).map((r) => ({
        full_name: r.full_name,
        language: r.language,
        description: r.description,
      })),
    };
  }, [includeContext, contextType, selectedRepo, selectedProject, projects, repositories]);

  // STEP 2: Analyze Idea (Central Action)
  const handleAnalyzeIdea = async () => {
    if (!ideaInput.trim() || isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(null);
    setHistoryRestoredNote(null);
    setLoadingStep('Evaluating concept, target problem & user beneficiaries...');

    try {
      setTimeout(() => setLoadingStep('Formulating actionable suggestions & tech stack...'), 1200);
      setTimeout(() => setLoadingStep('Drafting architecture, milestones & risk mitigations...'), 2600);

      const result = await aiService.generate({
        type: 'analyze',
        idea: ideaInput.trim(),
        context: computedContext,
      });

      setAnalysisOutput(result.output);
      setModelUsed(result.model);
      setActiveTab('analysis');

      if (user) {
        await aiHistoryService.create(user.id, {
          type: 'analyze',
          input: ideaInput.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Idea analysis failed. Please verify provider connectivity in Configuration.');
    } finally {
      setIsAnalyzing(false);
      setLoadingStep('');
    }
  };

  // STEP 3: Develop Idea Further (Phased Roadmap)
  const handleGenerateRoadmap = async () => {
    if (!ideaInput.trim() || isGeneratingRoadmap) return;
    setIsGeneratingRoadmap(true);
    setRoadmapError(null);
    setActiveTab('roadmap');

    try {
      const result = await aiService.generate({
        type: 'roadmap',
        idea: ideaInput.trim(),
        analysis: analysisOutput || undefined,
        context: computedContext,
      });
      setRoadmapOutput(result.output);
      setModelUsed(result.model);

      if (user) {
        await aiHistoryService.create(user.id, {
          type: 'roadmap',
          input: ideaInput.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setRoadmapError(err instanceof Error ? err.message : 'Roadmap generation failed.');
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  // STEP 3: Develop Idea Further (Architecture & Deep Implementation Specs)
  const handleGenerateArchitecture = async () => {
    if (!ideaInput.trim() || isGeneratingArchitecture) return;
    setIsGeneratingArchitecture(true);
    setArchitectureError(null);
    setActiveTab('architecture');

    try {
      const result = await aiService.generate({
        type: 'architecture',
        idea: ideaInput.trim(),
        analysis: analysisOutput || undefined,
        previousArtifacts: {
          roadmap: roadmapOutput || undefined,
        },
        context: computedContext,
      });
      setArchitectureOutput(result.output);
      setModelUsed(result.model);

      if (user) {
        await aiHistoryService.create(user.id, {
          type: 'architecture',
          input: ideaInput.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setArchitectureError(err instanceof Error ? err.message : 'Architecture generation failed.');
    } finally {
      setIsGeneratingArchitecture(false);
    }
  };

  // STEP 3: Develop Idea Further (README.md)
  const handleGenerateReadme = async () => {
    if (!ideaInput.trim() || isGeneratingReadme) return;
    setIsGeneratingReadme(true);
    setReadmeError(null);
    setActiveTab('readme');

    try {
      const result = await aiService.generate({
        type: 'readme',
        idea: ideaInput.trim(),
        analysis: analysisOutput || undefined,
        previousArtifacts: {
          architecture: architectureOutput || undefined,
          roadmap: roadmapOutput || undefined,
        },
        context: computedContext,
      });
      setReadmeOutput(result.output);
      setModelUsed(result.model);

      if (user) {
        await aiHistoryService.create(user.id, {
          type: 'readme',
          input: ideaInput.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setReadmeError(err instanceof Error ? err.message : 'README generation failed.');
    } finally {
      setIsGeneratingReadme(false);
    }
  };

  // STEP 3: Develop Idea Further (Technical Docs)
  const handleGenerateDocs = async () => {
    if (!ideaInput.trim() || isGeneratingDocs) return;
    setIsGeneratingDocs(true);
    setDocsError(null);
    setActiveTab('docs');

    try {
      const result = await aiService.generate({
        type: 'docs',
        idea: ideaInput.trim(),
        analysis: analysisOutput || undefined,
        previousArtifacts: {
          architecture: architectureOutput || undefined,
          roadmap: roadmapOutput || undefined,
          readme: readmeOutput || undefined,
        },
        context: computedContext,
      });
      setDocsOutput(result.output);
      setModelUsed(result.model);

      if (user) {
        await aiHistoryService.create(user.id, {
          type: 'docs',
          input: ideaInput.slice(0, 2000),
          output: result.output.slice(0, 10000),
          model: result.model,
        });
      }
    } catch (err) {
      setDocsError(err instanceof Error ? err.message : 'Documentation generation failed.');
    } finally {
      setIsGeneratingDocs(false);
    }
  };

  // STEP 4: Action — Save to Idea Vault
  const handleSaveToVault = async () => {
    if (!ideaInput.trim() || !user || isSavingToVault) return;
    setIsSavingToVault(true);
    setVaultSaveError(null);
    try {
      const lines = ideaInput.trim().split('\n');
      const title = lines[0].replace(/^#+\s*/, '').slice(0, 100);
      await createIdeaMutation.mutateAsync({
        title: title || 'AI Analyzed Concept',
        description: `${ideaInput}\n\n--- AI Analysis Summary ---\n${analysisOutput.slice(0, 1500)}`,
        category: 'project',
        status: 'planned',
        tags: ['ai-studio', 'analyzed'],
      });
      setSavedToVaultSuccess(true);
      setTimeout(() => setSavedToVaultSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save to Idea Vault:', err);
      setVaultSaveError(err instanceof Error ? err.message : 'Failed to save to Idea Vault');
    } finally {
      setIsSavingToVault(false);
    }
  };

  // STEP 4: Action — Open Convert to Project Modal
  const openProjectModal = () => {
    const lines = ideaInput.trim().split('\n');
    const title = lines[0].replace(/^#+\s*/, '').slice(0, 60);
    setProjectName(title || 'New Project');
    setProjectDescription(ideaInput.slice(0, 300));

    // Extract recommended tech stack from analysis if available
    let techStack = 'React, TypeScript, Supabase';
    if (analysisOutput) {
      const techMatch = analysisOutput.match(/## (?:[0-9]+\.\s*)?Recommended Technolog(?:ies|y Stack)[\s\S]*?(?=##|$)/i) ||
                        analysisOutput.match(/## (?:Recommended )?Technologies[\s\S]*?(?=##|$)/i);
      if (techMatch) {
        const foundTech: string[] = [];
        const lines = techMatch[0].split('\n');
        for (const line of lines) {
          const match = line.match(/\*\*(.*?)\*\*/);
          if (
            match &&
            match[1] &&
            !match[1].toLowerCase().includes('recommend') &&
            !match[1].toLowerCase().includes('stack') &&
            !match[1].toLowerCase().includes('technology name') &&
            !match[1].toLowerCase().includes('what it does') &&
            !match[1].toLowerCase().includes('why we need') &&
            !match[1].toLowerCase().includes('where we will')
          ) {
            foundTech.push(match[1].replace(/[:]/g, '').trim());
          }
        }
        if (foundTech.length > 0) {
          techStack = Array.from(new Set(foundTech)).slice(0, 6).join(', ');
        }
      }
    }

    setProjectTechStack(techStack);
    setProjectCreateError(null);
    setIsProjectModalOpen(true);
  };

  // STEP 4: Action — Execute Project Creation
  const handleConfirmCreateProject = async () => {
    if (!projectName.trim() || isCreatingProject) return;
    setIsCreatingProject(true);
    setProjectCreateError(null);
    try {
      const technologies = projectTechStack
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await createProjectMutation.mutateAsync({
        name: projectName.trim(),
        description: projectDescription.trim(),
        technologies,
        status: 'planning',
      });

      setIsProjectModalOpen(false);
      navigate('/projects');
    } catch (err) {
      console.error('Failed to create project:', err);
      setProjectCreateError(err instanceof Error ? err.message : 'Failed to create project. Please verify you are logged in.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  // STEP 4: Action — Copy Generated Results
  const handleCopy = async () => {
    const content =
      activeTab === 'analysis'
        ? analysisOutput
        : activeTab === 'roadmap'
          ? roadmapOutput
          : activeTab === 'architecture'
            ? architectureOutput
            : activeTab === 'readme'
              ? readmeOutput
              : docsOutput;

    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // STEP 4: Action — Restore Previous AI Session
  const handleLoadHistory = (item: (typeof history)[0]) => {
    setIdeaInput(item.input);
    if (item.type === 'analyze' || item.type === 'idea') {
      setAnalysisOutput(item.output);
      setActiveTab('analysis');
    } else if (item.type === 'roadmap') {
      setRoadmapOutput(item.output);
      setActiveTab('roadmap');
    } else if (item.type === 'architecture') {
      setArchitectureOutput(item.output);
      setActiveTab('architecture');
    } else if (item.type === 'readme') {
      setReadmeOutput(item.output);
      setActiveTab('readme');
    } else {
      setDocsOutput(item.output);
      setActiveTab('docs');
    }
    setModelUsed(item.model);
    setAnalysisError(null);
    setRoadmapError(null);
    setArchitectureError(null);
    setReadmeError(null);
    setDocsError(null);
    setHistoryRestoredNote(`Loaded previous ${item.type} session from ${new Date(item.created_at).toLocaleTimeString()}`);
  };

  // Select idea from Vault dropdown
  const handleSelectFromVault = (ideaId: string) => {
    setSelectedVaultIdeaId(ideaId);
    const found = ideas.find((i) => i.id === ideaId);
    if (found) {
      setIdeaInput(`${found.title}\n\n${found.description || ''}`.trim());
    }
  };

  // Example Prompts
  const starterPrompts = [
    {
      title: 'AI Attendance System',
      prompt: 'I want to build an AI-powered student attendance system with face recognition verification, class timetable sync, and automated absence alerts for teachers.',
    },
    {
      title: 'Real-Time Webhook Proxy',
      prompt: 'A lightweight webhook inspection and replay proxy for Stripe and GitHub webhooks with end-to-end payload signing verification and request replay.',
    },
    {
      title: 'Zero-Downtime DB Migrator',
      prompt: 'A PostgreSQL schema migration CLI with automated rollback scripts, lock timeouts, and safe non-blocking column addition safeguards.',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Intelligence"
        title="AI Studio"
        description="The primary developer workspace — enter an idea to receive comprehensive technical analysis, actionable improvements, and phased roadmaps."
        actions={
          activeProvider ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">
              <Sparkles className="w-3.5 h-3.5" />
              {activeProvider} Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Provider Key Needed
            </span>
          )
        }
      />

      {/* Provider Status Diagnostic Notice if no key is configured */}
      {!aiConfigured && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900">AI Provider Key Not Set in Supabase Secrets</p>
              <p className="text-amber-800 mt-0.5 leading-relaxed">
                Live AI inference requires <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-semibold">GROQ_API_KEY</code> or <code className="font-mono bg-amber-100 px-1 py-0.5 rounded font-semibold">GEMINI_API_KEY</code> configured in your Supabase Edge Function secrets. You can still input ideas, import concepts from Idea Vault, and restore past sessions.
              </p>
            </div>
          </div>
          <Link
            to="/config"
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold transition-colors text-xs"
          >
            Diagnostics →
          </Link>
        </div>
      )}

      {/* STEP 1: ENTER AN IDEA */}
      <Card variant="os" padding="md" className="space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-100 pb-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-violet-600" />
            <h2 className="text-sm font-bold text-neutral-900">Step 1: Enter Your Developer Concept</h2>
          </div>

          {/* Import existing idea from Idea Vault */}
          {ideas.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-surface-500">Import from Idea Vault:</span>
              <select
                value={selectedVaultIdeaId}
                onChange={(e) => handleSelectFromVault(e.target.value)}
                className="text-xs rounded-xl border border-surface-200 bg-white px-2.5 py-1.5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select captured idea...</option>
                {ideas.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {historyRestoredNote && (
          <div className="p-2.5 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              {historyRestoredNote}
            </span>
            <button
              type="button"
              onClick={() => setHistoryRestoredNote(null)}
              className="text-violet-500 hover:text-violet-700 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* The Core Prominent Idea Input */}
        <Textarea
          placeholder="Describe your idea in your own words... (e.g. 'I want to build an AI-powered student attendance system with face recognition verification and automated absence alerts')"
          rows={5}
          value={ideaInput}
          onChange={(e) => setIdeaInput(e.target.value)}
          className="font-mono text-sm leading-relaxed"
        />

        {/* Example Starter Prompts */}
        {!ideaInput.trim() && (
          <div className="pt-1">
            <p className="text-[11px] font-semibold text-surface-400 mb-2">Example prompts to explore:</p>
            <div className="flex flex-wrap gap-2">
              {starterPrompts.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => setIdeaInput(s.prompt)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-surface-100/70 hover:bg-violet-50 hover:text-violet-700 text-neutral-700 transition-colors border border-surface-200/60"
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Context Attachment Options */}
        <div className="pt-2 border-t border-surface-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-surface-600">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
            <span className="font-medium text-neutral-800">Enrich with existing workspace context</span>
          </label>

          {includeContext && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={contextType}
                onChange={(e) => setContextType(e.target.value as typeof contextType)}
                className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-neutral-800"
              >
                <option value="workspace">All Workspace ({projects.length} projects, {repositories.length} repos)</option>
                <option value="repository">Specific Repository</option>
                <option value="project">Specific Project</option>
              </select>

              {contextType === 'repository' && repositories.length > 0 && (
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-neutral-800 max-w-[200px] truncate"
                >
                  {repositories.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.full_name}
                    </option>
                  ))}
                </select>
              )}

              {contextType === 'project' && projects.length > 0 && (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="rounded-lg border border-surface-200 px-2 py-1 text-xs text-neutral-800 max-w-[200px] truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={() => setShowContextPreview(!showContextPreview)}
                className="text-violet-600 hover:underline flex items-center gap-0.5 ml-1"
              >
                {showContextPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showContextPreview ? 'Hide context' : 'Inspect'}
              </button>
            </div>
          )}

          {/* Action CTA */}
          <Button
            onClick={handleAnalyzeIdea}
            isLoading={isAnalyzing}
            disabled={!ideaInput.trim() || isAnalyzing}
            className="w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze & Shape Idea
          </Button>
        </div>

        {/* Collapsible context inspector */}
        {showContextPreview && includeContext && (
          <div className="pt-2">
            <pre className="text-[11px] font-mono p-3 rounded-xl bg-slate-900 text-slate-200 max-h-40 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(computedContext ?? {}, null, 2)}
            </pre>
          </div>
        )}

        {/* Active Analysis Loading Banner */}
        {isAnalyzing && (
          <div className="p-4 rounded-xl bg-violet-50/80 border border-violet-200 text-violet-800 text-xs flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-600 animate-spin flex-shrink-0" />
            <div>
              <p className="font-semibold text-neutral-900">Synthesizing Technical Architecture</p>
              <p className="text-surface-600 mt-0.5">{loadingStep || 'Analyzing problem statement and core features...'}</p>
            </div>
          </div>
        )}

        {/* Analysis Error Display */}
        {analysisError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Idea Analysis Error</p>
              <p className="mt-0.5">{analysisError}</p>
              <div className="mt-2 flex items-center gap-3">
                <Button size="sm" variant="secondary" onClick={handleAnalyzeIdea} disabled={isAnalyzing}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Retry Analysis
                </Button>
                <Link to="/config" className="underline font-semibold text-rose-700">
                  Inspect System Configuration →
                </Link>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* STEP 2, 3 & 4: THE ANALYZED IDEA WORKSPACE */}
      {(analysisOutput || roadmapOutput || architectureOutput || readmeOutput || docsOutput) && (
        <Card variant="os" padding="md" className="space-y-4">
          {/* Header Bar of Analyzed Idea */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  Active Idea Specification
                </span>
                {modelUsed && <span className="text-xs text-surface-400">· {modelUsed}</span>}
              </div>
              <h3 className="font-display font-bold text-lg text-neutral-900 mt-1 line-clamp-1">
                {ideaInput.trim().split('\n')[0].replace(/^#+\s*/, '')}
              </h3>
            </div>

            {/* STEP 4: FUNCTIONAL ACTIONS */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-success-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copied' : 'Copy Output'}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSaveToVault}
                isLoading={isSavingToVault}
                disabled={savedToVaultSuccess || isSavingToVault}
              >
                {savedToVaultSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                    Saved to Ideas
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                    Save to Idea Vault
                  </>
                )}
              </Button>

              {vaultSaveError && (
                <span className="text-xs text-rose-600 font-medium px-2 py-1 rounded bg-rose-50 border border-rose-200">
                  {vaultSaveError}
                </span>
              )}

              <Button variant="secondary" size="sm" onClick={openProjectModal}>
                <FolderKanban className="w-3.5 h-3.5 mr-1.5 text-cyan-600" />
                Convert to Project
              </Button>
            </div>
          </div>

          {/* STEP 3: DEVELOP THE IDEA FURTHER (TABS ORGANIZED AROUND THIS IDEA) */}
          <div className="flex flex-wrap gap-2 border-b border-surface-100 pb-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('analysis')}
              className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'analysis'
                  ? 'bg-violet-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-700 hover:bg-surface-100'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              1. Analysis & Suggestions
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('roadmap')}
              className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'roadmap'
                  ? 'bg-violet-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-700 hover:bg-surface-100'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              2. Phased Roadmap {isGeneratingRoadmap ? '...' : roadmapOutput ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('architecture')}
              className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'architecture'
                  ? 'bg-violet-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-700 hover:bg-surface-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              3. Architecture & Specs {isGeneratingArchitecture ? '...' : architectureOutput ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('readme')}
              className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'readme'
                  ? 'bg-violet-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-700 hover:bg-surface-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              4. README.md {isGeneratingReadme ? '...' : readmeOutput ? '✓' : ''}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('docs')}
              className={`px-3 py-2 rounded-xl flex items-center gap-2 transition-all ${
                activeTab === 'docs'
                  ? 'bg-violet-600 text-white font-semibold shadow-xs'
                  : 'text-neutral-700 hover:bg-surface-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              5. Technical Docs {isGeneratingDocs ? '...' : docsOutput ? '✓' : ''}
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="pt-2">
            {activeTab === 'analysis' && (
              <div className="space-y-4">
                <pre className="dev-os-code-block max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                  {analysisOutput}
                </pre>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-surface-500 border-t border-surface-100">
                  <span>Develop this idea further into structured roadmaps, architecture specifications, or open-source documentation:</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={handleGenerateRoadmap} isLoading={isGeneratingRoadmap}>
                      <Compass className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                      Generate Roadmap →
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleGenerateArchitecture} isLoading={isGeneratingArchitecture}>
                      <Layers className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                      Architecture Specs →
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleGenerateReadme} isLoading={isGeneratingReadme}>
                      <FileText className="w-3.5 h-3.5 mr-1.5 text-cyan-600" />
                      README.md →
                    </Button>
                    <Button size="sm" variant="secondary" onClick={handleGenerateDocs} isLoading={isGeneratingDocs}>
                      <BookOpen className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                      Technical Docs →
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'roadmap' && (
              <div className="space-y-4">
                {isGeneratingRoadmap ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-800">Constructing Phased Development Roadmap...</p>
                    <p className="text-xs text-surface-500 mt-1">Sequencing Setup, Database & Auth, Backend, Frontend UI, Integration, Testing, and Deployment.</p>
                  </div>
                ) : roadmapError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Roadmap Generation Failed</p>
                        <p className="mt-0.5">{roadmapError}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" variant="secondary" onClick={handleGenerateRoadmap} isLoading={isGeneratingRoadmap}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Retry Generating Roadmap
                          </Button>
                          <Link to="/config" className="underline font-semibold text-rose-700">
                            Inspect Diagnostics →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : roadmapOutput ? (
                  <div className="space-y-4">
                    <pre className="dev-os-code-block max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                      {roadmapOutput}
                    </pre>
                    <div className="pt-2 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleGenerateRoadmap} isLoading={isGeneratingRoadmap}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                        Regenerate Roadmap
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Compass className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-900">Phased Roadmap Ready to Generate</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-sm mx-auto mb-4">
                      Create a concrete phased execution roadmap from setup to deployment, tailored to this idea.
                    </p>
                    <Button size="sm" onClick={handleGenerateRoadmap} isLoading={isGeneratingRoadmap}>
                      <Compass className="w-3.5 h-3.5 mr-1.5" />
                      Generate Roadmap Now
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'architecture' && (
              <div className="space-y-4">
                {isGeneratingArchitecture ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-violet-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-800">Synthesizing Architectural Specifications...</p>
                    <p className="text-xs text-surface-500 mt-1">Detailing database schema, API contracts, security boundaries, and caching.</p>
                  </div>
                ) : architectureError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Architecture Generation Failed</p>
                        <p className="mt-0.5">{architectureError}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" variant="secondary" onClick={handleGenerateArchitecture} isLoading={isGeneratingArchitecture}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Retry Generating Architecture
                          </Button>
                          <Link to="/config" className="underline font-semibold text-rose-700">
                            Inspect Diagnostics →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : architectureOutput ? (
                  <div className="space-y-4">
                    <pre className="dev-os-code-block max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                      {architectureOutput}
                    </pre>
                    <div className="pt-2 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleGenerateArchitecture} isLoading={isGeneratingArchitecture}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-violet-600" />
                        Regenerate Architecture Specs
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Layers className="w-10 h-10 text-violet-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-900">Architecture Specs Ready to Generate</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-sm mx-auto mb-4">
                      Detail component boundaries, database schemas, entities, and API contracts for this idea.
                    </p>
                    <Button size="sm" onClick={handleGenerateArchitecture} isLoading={isGeneratingArchitecture}>
                      <Layers className="w-3.5 h-3.5 mr-1.5" />
                      Generate Architecture Specs Now
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'readme' && (
              <div className="space-y-4">
                {isGeneratingReadme ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-800">Drafting Open-Source README.md...</p>
                    <p className="text-xs text-surface-500 mt-1">Formatting quickstart, features, architecture, and usage examples.</p>
                  </div>
                ) : readmeError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">README Generation Failed</p>
                        <p className="mt-0.5">{readmeError}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" variant="secondary" onClick={handleGenerateReadme} isLoading={isGeneratingReadme}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Retry Generating README
                          </Button>
                          <Link to="/config" className="underline font-semibold text-rose-700">
                            Inspect Diagnostics →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : readmeOutput ? (
                  <div className="space-y-4">
                    <pre className="dev-os-code-block max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                      {readmeOutput}
                    </pre>
                    <div className="pt-2 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleGenerateReadme} isLoading={isGeneratingReadme}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-cyan-600" />
                        Regenerate README.md
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileText className="w-10 h-10 text-cyan-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-900">README Ready to Generate</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-sm mx-auto mb-4">
                      Create a ready-to-commit README.md file tailored to this project's architecture.
                    </p>
                    <Button size="sm" onClick={handleGenerateReadme} isLoading={isGeneratingReadme}>
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Draft README.md Now
                    </Button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="space-y-4">
                {isGeneratingDocs ? (
                  <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-800">Synthesizing Technical Documentation...</p>
                    <p className="text-xs text-surface-500 mt-1">Compiling architecture specifications, API patterns, and troubleshooting guides.</p>
                  </div>
                ) : docsError ? (
                  <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold">Documentation Generation Failed</p>
                        <p className="mt-0.5">{docsError}</p>
                        <div className="mt-3 flex items-center gap-3">
                          <Button size="sm" variant="secondary" onClick={handleGenerateDocs} isLoading={isGeneratingDocs}>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            Retry Generating Docs
                          </Button>
                          <Link to="/config" className="underline font-semibold text-rose-700">
                            Inspect Diagnostics →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : docsOutput ? (
                  <div className="space-y-4">
                    <pre className="dev-os-code-block max-h-[560px] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
                      {docsOutput}
                    </pre>
                    <div className="pt-2 flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleGenerateDocs} isLoading={isGeneratingDocs}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                        Regenerate Technical Docs
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <BookOpen className="w-10 h-10 text-amber-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-neutral-900">Technical Docs Ready to Generate</p>
                    <p className="text-xs text-surface-500 mt-1 max-w-sm mx-auto mb-4">
                      Document system contracts, data models, error strategies, and local setup.
                    </p>
                    <Button size="sm" onClick={handleGenerateDocs} isLoading={isGeneratingDocs}>
                      <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                      Draft Technical Docs Now
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Convert to Project Confirmation Modal */}
      <Modal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        title="Convert Idea to DevOS Project"
        description="Creates an active project workspace in DevOS using this analyzed idea and recommended technology stack."
        size="md"
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Project Name</label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. AI Attendance System"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Description</label>
            <Textarea
              rows={3}
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
              placeholder="Brief summary of the project scope..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-700 block mb-1">Technologies (comma-separated)</label>
            <Input
              value={projectTechStack}
              onChange={(e) => setProjectTechStack(e.target.value)}
              placeholder="e.g. React, Python, FastAPI, Supabase"
            />
          </div>

          {projectCreateError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{projectCreateError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <Button variant="secondary" size="sm" onClick={() => setIsProjectModalOpen(false)} disabled={isCreatingProject}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirmCreateProject} isLoading={isCreatingProject} disabled={!projectName.trim()}>
              <FolderKanban className="w-3.5 h-3.5 mr-1.5" />
              Create Project
            </Button>
          </div>
        </div>
      </Modal>

      {/* STEP 4: RESTORE PREVIOUS AI SESSIONS */}
      <Card variant="glass" padding="md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-600" />
            <h3 className="font-display font-bold text-neutral-900 text-sm">Recent Ideation Sessions</h3>
          </div>
          <span className="text-xs text-surface-400">Click any session to reload into the workspace</span>
        </div>

        {history.length === 0 ? (
          <EmptyState
            icon={<Brain className="w-7 h-7" />}
            title="No past ideation sessions"
            description="Analyzed ideas and roadmaps will appear here for one-click reloading."
            variant="default"
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {history.map((item, idx) => (
              <button
                key={item.created_at + item.type + idx}
                type="button"
                onClick={() => handleLoadHistory(item)}
                className="text-left p-3.5 rounded-xl bg-white/80 border border-surface-200/80 hover:border-violet-400 hover:shadow-xs transition-all group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 bg-violet-50 px-2 py-0.5 rounded-md">
                    {item.type}
                  </span>
                  <span className="text-[10px] text-surface-400">
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-neutral-700 font-medium line-clamp-2 mt-1 group-hover:text-violet-900">
                  {item.input}
                </p>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-100 text-[10px] text-surface-400">
                  <span>{item.model?.split(' ')?.[0] || 'AI'}</span>
                  <span className="text-violet-600 group-hover:underline">Restore →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
