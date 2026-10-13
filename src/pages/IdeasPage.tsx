import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Plus,
  Search,
  Tag,
  Clock,
  Edit3,
  Trash2,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Button, Input, Card, Modal, Select, Textarea, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea, useQueryInitialLoading, useLogActivity } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Idea, IdeaCategory, IdeaStatus } from '@/types';

const categoryConfig: Record<IdeaCategory, { label: string; bg: string; text: string; border: string }> = {
  project: { label: 'New Project', bg: 'bg-violet-500/10', text: 'text-violet-600', border: 'border-violet-200' },
  feature: { label: 'Feature', bg: 'bg-cyan-500/10', text: 'text-cyan-600', border: 'border-cyan-200' },
  improvement: { label: 'Improvement', bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-200' },
  technical: { label: 'Technical / Refactor', bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-200' },
  experiment: { label: 'Experiment / Spike', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
  product: { label: 'Product Thought', bg: 'bg-rose-500/10', text: 'text-rose-600', border: 'border-rose-200' },
  thought: { label: 'Dev Scratchpad', bg: 'bg-slate-500/10', text: 'text-slate-600', border: 'border-slate-200' },
};

const statusConfig: Record<IdeaStatus, { label: string; badge: string; icon: string }> = {
  idea: { label: 'Raw Idea', badge: 'bg-slate-100 text-slate-700', icon: '💡' },
  planned: { label: 'Planned', badge: 'bg-violet-100 text-violet-700', icon: '📋' },
  in_progress: { label: 'In Progress', badge: 'bg-amber-100 text-amber-800', icon: '⚡' },
  completed: { label: 'Completed', badge: 'bg-emerald-100 text-emerald-800', icon: '✅' },
};

export function IdeasPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState<Idea | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'feature' as IdeaCategory,
    status: 'idea' as IdeaStatus,
    tags: '',
  });

  const { data: ideas = [], isPending, fetchStatus } = useIdeas();
  const createIdeaMutation = useCreateIdea();
  const updateIdeaMutation = useUpdateIdea();
  const deleteIdeaMutation = useDeleteIdea();
  const logActivity = useLogActivity();

  const isLoading = useQueryInitialLoading(authLoading, isPending, fetchStatus);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'feature',
      status: 'idea',
      tags: '',
    });
    setEditingIdea(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (idea: Idea) => {
    setEditingIdea(idea);
    setFormData({
      title: idea.title,
      description: idea.description || '',
      category: idea.category,
      status: idea.status,
      tags: idea.tags?.join(', ') || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.title.trim()) return;

    const parsedTags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (editingIdea) {
      await updateIdeaMutation.mutateAsync({
        ideaId: editingIdea.id,
        updates: {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          category: formData.category,
          status: formData.status,
          tags: parsedTags,
        },
      });
      await logActivity.mutateAsync({
        action: 'updated_idea',
        resourceType: 'idea',
        resourceId: editingIdea.id,
        details: { title: formData.title },
      });
    } else {
      const created = await createIdeaMutation.mutateAsync({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        category: formData.category,
        status: formData.status,
        tags: parsedTags,
      });
      await logActivity.mutateAsync({
        action: 'created_idea',
        resourceType: 'idea',
        resourceId: created?.id,
        details: { title: formData.title },
      });
    }

    setIsModalOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (!ideaToDelete) return;
    await deleteIdeaMutation.mutateAsync(ideaToDelete.id);
    await logActivity.mutateAsync({
      action: 'deleted_idea',
      resourceType: 'idea',
      resourceId: ideaToDelete.id,
      details: { title: ideaToDelete.title },
    });
    setIsDeleteModalOpen(false);
    setIdeaToDelete(null);
  };

  const cycleStatus = async (idea: Idea) => {
    const sequence: IdeaStatus[] = ['idea', 'planned', 'in_progress', 'completed'];
    const currentIndex = sequence.indexOf(idea.status);
    const nextStatus = sequence[(currentIndex + 1) % sequence.length];

    await updateIdeaMutation.mutateAsync({
      ideaId: idea.id,
      updates: { status: nextStatus },
    });
  };

  // Aggregations
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    ideas.forEach((i: Idea) => i.tags?.forEach((t: string) => tagsSet.add(t)));
    return Array.from(tagsSet).sort();
  }, [ideas]);

  const stats = useMemo(() => {
    return {
      total: ideas.length,
      idea: ideas.filter((i: Idea) => i.status === 'idea').length,
      planned: ideas.filter((i: Idea) => i.status === 'planned').length,
      in_progress: ideas.filter((i: Idea) => i.status === 'in_progress').length,
      completed: ideas.filter((i: Idea) => i.status === 'completed').length,
    };
  }, [ideas]);

  const filteredIdeas = useMemo(() => {
    return ideas.filter((idea: Idea) => {
      const matchesSearch =
        [idea.title, idea.description || '', ...(idea.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesCategory = !categoryFilter || idea.category === categoryFilter;
      const matchesStatus = !statusFilter || idea.status === statusFilter;
      const matchesTag = !selectedTag || (idea.tags && idea.tags.includes(selectedTag));

      return matchesSearch && matchesCategory && matchesStatus && matchesTag;
    });
  }, [ideas, search, categoryFilter, statusFilter, selectedTag]);


  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Idea Vault"
        title="Ideas & Suggestions"
        description="Capture rough developer thoughts, potential features, technical spikes, and architecture ideas before turning them into projects."
        actions={
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Capture Idea
          </Button>
        }
      />

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 rounded-[24px] border border-[#D9C5FF] bg-[#F0E6FF] shadow-[0_12px_32px_rgba(124,58,237,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#5E4F7C]">Total Thoughts</p>
              <p className="text-3xl font-bold text-[#1F1145] mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center text-violet-600 shadow-sm">
              <Lightbulb className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 rounded-[24px] border border-[#D1E8FF] bg-[#E8F4FF] shadow-[0_12px_32px_rgba(17,110,85,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1F4E6A]">Planned</p>
              <p className="text-3xl font-bold text-[#0F4D5C] mt-1">{stats.planned}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center text-sky-600 shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 rounded-[24px] border border-[#F8E7B6] bg-[#FFF7D6] shadow-[0_12px_32px_rgba(173,146,50,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#7B5A00]">In Progress</p>
              <p className="text-3xl font-bold text-[#4F3F08] mt-1">{stats.in_progress}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center text-amber-600 shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        </Card>

        <Card className="p-5 rounded-[24px] border border-[#D6F7E9] bg-[#E8FFF3] shadow-[0_12px_32px_rgba(17,110,85,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#196053]">Completed</p>
              <p className="text-3xl font-bold text-[#134D42] mt-1">{stats.completed}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/80 flex items-center justify-center text-emerald-600 shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-5 border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search ideas, keywords, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            options={[
              { value: '', label: 'All categories' },
              { value: 'project', label: 'New Project' },
              { value: 'feature', label: 'Feature' },
              { value: 'improvement', label: 'Improvement' },
              { value: 'technical', label: 'Technical / Refactor' },
              { value: 'experiment', label: 'Experiment / Spike' },
              { value: 'product', label: 'Product Thought' },
              { value: 'thought', label: 'Dev Scratchpad' },
            ]}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          />

          <Select
            options={[
              { value: '', label: 'All statuses' },
              { value: 'idea', label: 'Raw Idea' },
              { value: 'planned', label: 'Planned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>

        {allTags.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTag('')}
              className={`px-2.5 py-1 rounded-full transition-colors ${
                !selectedTag ? 'bg-slate-900 text-white font-semibold' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                className={`px-2.5 py-1 rounded-full transition-colors ${
                  selectedTag === tag
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Ideas Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6 animate-pulse bg-slate-50 h-52" />
          ))}
        </div>
      ) : filteredIdeas.length === 0 ? (
        <Card className="p-8 border border-slate-200 shadow-sm">
          <EmptyState
            icon={<Lightbulb className="w-8 h-8 text-violet-500" />}
            title={search || categoryFilter || statusFilter || selectedTag ? 'No ideas match your filters' : 'Your Idea Vault is empty'}
            description={
              search || categoryFilter || statusFilter || selectedTag
                ? 'Try clearing your search query or reset filters.'
                : 'Capture rough thoughts, architecture experiments, or feature ideas here before formalizing them into projects.'
            }
            actionLabel={!search && !categoryFilter && !statusFilter && !selectedTag ? 'Capture First Idea' : undefined}
            onAction={!search && !categoryFilter && !statusFilter && !selectedTag ? openCreateModal : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filteredIdeas.map((idea: Idea, index: number) => {
              const cat = categoryConfig[idea.category] || categoryConfig.thought;
              const stat = statusConfig[idea.status] || statusConfig.idea;

              return (
                <motion.div
                  key={idea.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04 }}
                  className="flex"
                >
                  <Card
                    hover
                    className="p-5 border border-slate-200 shadow-sm bg-white rounded-[24px] flex flex-col justify-between w-full group relative overflow-hidden"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cat.bg} ${cat.text} border ${cat.border}`}>
                          {cat.label}
                        </span>

                        <button
                          type="button"
                          onClick={() => cycleStatus(idea)}
                          title="Click to cycle status"
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-transform active:scale-95 ${stat.badge}`}
                        >
                          <span>{stat.icon}</span>
                          <span>{stat.label}</span>
                        </button>
                      </div>

                      <h3 className="font-display font-semibold text-lg text-slate-900 group-hover:text-violet-700 transition-colors">
                        {idea.title}
                      </h3>

                      {idea.description ? (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed whitespace-pre-line line-clamp-4">
                          {idea.description}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-2">No description captured.</p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                      {idea.tags && idea.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {idea.tags.map((tag: string) => (
                            <span
                              key={tag}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTag(tag);
                              }}
                              className="cursor-pointer text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 px-2 py-0.5 rounded-md transition-colors"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}


                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(idea.created_at).toLocaleDateString()}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => navigate('/ai-studio', { state: { idea } })}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                            title="Analyze in AI Studio"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(idea)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                            title="Edit Idea"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIdeaToDelete(idea);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                            title="Delete Idea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          resetForm();
        }}
        title={editingIdea ? 'Edit Idea' : 'Capture Developer Idea'}
        description="Store a technical thought, architecture spike, or feature concept in your private idea vault."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Distributed caching layer using Redis & Upstash"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            autoFocus
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Category"
              options={[
                { value: 'project', label: 'New Project' },
                { value: 'feature', label: 'Feature' },
                { value: 'improvement', label: 'Improvement' },
                { value: 'technical', label: 'Technical / Refactor' },
                { value: 'experiment', label: 'Experiment / Spike' },
                { value: 'product', label: 'Product Thought' },
                { value: 'thought', label: 'Dev Scratchpad' },
              ]}
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as IdeaCategory })}
            />

            <Select
              label="Status"
              options={[
                { value: 'idea', label: 'Raw Idea' },
                { value: 'planned', label: 'Planned' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'completed', label: 'Completed' },
              ]}
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as IdeaStatus })}
            />
          </div>

          <Textarea
            label="Description & Thoughts"
            placeholder="Outline the problem, potential technical approach, dependencies, or trade-offs..."
            rows={5}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <Input
            label="Tags (comma-separated)"
            placeholder="react, performance, backend, ai"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          />

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createIdeaMutation.isPending || updateIdeaMutation.isPending}
              disabled={!formData.title.trim()}
            >
              {editingIdea ? 'Save Changes' : 'Capture Idea'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setIdeaToDelete(null);
        }}
        title="Delete Idea"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-slate-600 mb-6">
            Are you sure you want to remove <span className="font-semibold text-slate-900">{ideaToDelete?.title}</span> from your vault?
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setIdeaToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleDelete}
              isLoading={deleteIdeaMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
