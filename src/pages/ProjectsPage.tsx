import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FolderKanban, Edit3, Trash2, Github, Rocket, Clock } from 'lucide-react';
import { Button, Input, Card, ProjectStatusBadge, EmptyState, Modal, Select, Textarea } from '@/components/ui';
import { PageHeader } from '@/components/design/PageHeader';
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject, useLogActivity } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Project } from '@/types';

const statusColors: Record<Project['status'], string> = {
  planning: 'bg-slate-200',
  development: 'bg-cyan-100',
  testing: 'bg-slate-100',
  deployed: 'bg-emerald-100',
  archived: 'bg-slate-100',
};

export function ProjectsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const { data: projects = [], isLoading } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const logActivity = useLogActivity();

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    category: '',
    technologies: '',
    github_url: '',
    deployment_url: '',
    status: 'planning' as Project['status'],
  });

  const activeCount = useMemo(
    () => projects.filter((project) => project.status === 'development' || project.status === 'testing').length,
    [projects]
  );

  const deployedCount = useMemo(
    () => projects.filter((project) => project.status === 'deployed').length,
    [projects]
  );

  const archivedCount = useMemo(
    () => projects.filter((project) => project.status === 'archived').length,
    [projects]
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchesSearch =
          project.name.toLowerCase().includes(search.toLowerCase()) ||
          project.description?.toLowerCase().includes(search.toLowerCase()) ||
          project.category?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !statusFilter || project.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [projects, search, statusFilter]
  );

  const resetForm = () => {
    setNewProject({
      name: '',
      description: '',
      category: '',
      technologies: '',
      github_url: '',
      deployment_url: '',
      status: 'planning',
    });
  };

  const handleCreateProject = async () => {
    if (!user) return;

    const project = await createProject.mutateAsync({
      name: newProject.name,
      description: newProject.description || undefined,
      category: newProject.category || undefined,
      technologies: newProject.technologies.split(',').map((t) => t.trim()).filter(Boolean),
      github_url: newProject.github_url || undefined,
      deployment_url: newProject.deployment_url || undefined,
      status: newProject.status,
    });

    await logActivity.mutateAsync({
      action: 'created_project',
      resourceType: 'project',
      resourceId: project.id,
      details: { name: project.name },
    });

    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;

    await updateProject.mutateAsync({
      projectId: editingProject.id,
      updates: {
        name: newProject.name,
        description: newProject.description || undefined,
        category: newProject.category || undefined,
        technologies: newProject.technologies.split(',').map((t) => t.trim()).filter(Boolean),
        github_url: newProject.github_url || undefined,
        deployment_url: newProject.deployment_url || undefined,
        status: newProject.status,
      },
    });

    setEditingProject(null);
    resetForm();
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    await deleteProject.mutateAsync(projectToDelete.id);
    setIsDeleteModalOpen(false);
    setProjectToDelete(null);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setNewProject({
      name: project.name,
      description: project.description || '',
      category: project.category || '',
      technologies: project.technologies?.join(', ') || '',
      github_url: project.github_url || '',
      deployment_url: project.deployment_url || '',
      status: project.status,
    });
    setIsCreateModalOpen(true);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="A premium project workspace built from your database records."
        actions={
          <Button onClick={() => { resetForm(); setEditingProject(null); setIsCreateModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 rounded-[28px] border border-[#D9C5FF] bg-[#F0E6FF] shadow-[0_18px_40px_rgba(124,58,237,0.08)]">
          <p className="text-sm font-semibold text-[#5E4F7C]">Projects</p>
          <p className="text-3xl font-bold text-[#1F1145]">{projects.length}</p>
          <p className="text-xs text-[#5E4F7C] mt-2">Total projects in your workspace</p>
        </Card>
        <Card className="p-5 rounded-[28px] border border-[#D1E8FF] bg-[#E8F4FF] shadow-[0_18px_40px_rgba(17,110,85,0.08)]">
          <p className="text-sm font-semibold text-[#1F4E6A]">Active work</p>
          <p className="text-3xl font-bold text-[#0F4D5C]">{activeCount}</p>
          <p className="text-xs text-[#295A70] mt-2">Projects in development or testing</p>
        </Card>
        <Card className="p-5 rounded-[28px] border border-[#D6F7E9] bg-[#E8FFF3] shadow-[0_18px_40px_rgba(17,110,85,0.08)]">
          <p className="text-sm font-semibold text-[#196053]">Deployed</p>
          <p className="text-3xl font-bold text-[#134D42]">{deployedCount}</p>
          <p className="text-xs text-[#1B5F45] mt-2">Live project deployments</p>
        </Card>
        <Card className="p-5 rounded-[28px] border border-[#F8E7B6] bg-[#FFF7D6] shadow-[0_18px_40px_rgba(173,146,50,0.08)]">
          <p className="text-sm font-semibold text-[#7B5A00]">Archived</p>
          <p className="text-3xl font-bold text-[#4F3F08]">{archivedCount}</p>
          <p className="text-xs text-[#7B5A00] mt-2">Completed or paused projects</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="relative rounded-[28px] border border-[#D9C5FF] bg-[#FCEEF8] p-5 shadow-[0_18px_40px_rgba(124,58,237,0.08)]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A99CC2]" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-12"
          />
        </div>
        <div className="rounded-[28px] border border-[#D9C5FF] bg-[#EEE6FF] p-5 shadow-[0_18px_40px_rgba(124,58,237,0.08)]">
          <Select
            options={[
              { value: '', label: 'All statuses' },
              { value: 'planning', label: 'Planning' },
              { value: 'development', label: 'Development' },
              { value: 'testing', label: 'Testing' },
              { value: 'deployed', label: 'Deployed' },
              { value: 'archived', label: 'Archived' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <Card key={index} className="p-6 animate-pulse">
              <div className="space-y-4">
                <div className="h-4 bg-neutral-200 rounded w-1/2" />
                <div className="h-5 bg-neutral-200 rounded w-3/4" />
                <div className="h-3 bg-neutral-200 rounded" />
                <div className="h-3 bg-neutral-200 rounded w-5/6" />
              </div>
            </Card>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            icon={<FolderKanban className="w-8 h-8" />}
            title={search || statusFilter ? 'No projects found' : 'No projects yet'}
            description={
              search || statusFilter
                ? 'Try broadening your search or removing a filter.'
                : 'Create your first project to start tracking your roadmap.'
            }
            actionLabel={!search && !statusFilter ? 'Create Project' : undefined}
            onAction={!search && !statusFilter ? () => setIsCreateModalOpen(true) : undefined}
          />
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="overflow-hidden group border border-slate-200 shadow-sm">
                <div className={`h-1.5 w-full ${statusColors[project.status as Project['status']] ?? 'bg-slate-200'}`} />
                <div className="p-6 space-y-5">
                          <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-[22px] bg-[#F2EEFF] flex items-center justify-center text-[#4C3DA6] text-lg font-bold shadow-sm">
                        {project.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-semibold text-[#1F1145] truncate">{project.name}</h3>
                        {project.category && (
                          <p className="text-sm text-[#5E4F7C] truncate">{project.category}</p>
                        )}
                      </div>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>

                  <p className="text-sm text-[#5E4F7C] leading-relaxed line-clamp-3">
                    {project.description || 'No description provided yet.'}
                  </p>

                  {project.technologies?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {project.technologies.slice(0, 5).map((tech: string) => (
                        <span key={tech} className="px-2 py-1 text-xs font-semibold text-[#3C2976] bg-[#F3F0FF] rounded-full">
                          {tech}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {project.github_url && (
                        <a href={project.github_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900">
                          <Github className="w-4 h-4" />
                        </a>
                      )}
                      {project.deployment_url && (
                        <a href={project.deployment_url} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-900">
                          <Rocket className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      onClick={() => openEditModal(project)}
                      className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => { setProjectToDelete(project); setIsDeleteModalOpen(true); }}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setEditingProject(null); resetForm(); }}
        title={editingProject ? 'Edit Project' : 'Create New Project'}
        description={editingProject ? 'Update project details and sync statuses.' : 'Add a project to your workspace.'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (editingProject) handleUpdateProject(); else handleCreateProject(); }}>
          <Input
            label="Project Name"
            placeholder="My Awesome Project"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            required
          />

          <Textarea
            label="Description"
            placeholder="Describe your project..."
            rows={4}
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Category"
              placeholder="Web App, Mobile, CLI..."
              value={newProject.category}
              onChange={(e) => setNewProject({ ...newProject, category: e.target.value })}
            />
            <Select
              label="Status"
              options={[
                { value: 'planning', label: 'Planning' },
                { value: 'development', label: 'Development' },
                { value: 'testing', label: 'Testing' },
                { value: 'deployed', label: 'Deployed' },
                { value: 'archived', label: 'Archived' },
              ]}
              value={newProject.status}
              onChange={(e) => setNewProject({ ...newProject, status: e.target.value as Project['status'] })}
            />
          </div>

          <Textarea
            label="Technologies"
            placeholder="React, Node.js, PostgreSQL"
            rows={2}
            value={newProject.technologies}
            onChange={(e) => setNewProject({ ...newProject, technologies: e.target.value })}
            helperText="Separate technologies with commas"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="GitHub URL"
              placeholder="https://github.com/user/repo"
              value={newProject.github_url}
              onChange={(e) => setNewProject({ ...newProject, github_url: e.target.value })}
            />
            <Input
              label="Deployment URL"
              placeholder="https://myapp.vercel.app"
              value={newProject.deployment_url}
              onChange={(e) => setNewProject({ ...newProject, deployment_url: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => { setIsCreateModalOpen(false); setEditingProject(null); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" isLoading={createProject.isPending || updateProject.isPending}>
              {editingProject ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setProjectToDelete(null); }}
        title="Delete Project"
        size="sm"
      >
        <div className="text-center py-4">
          <p className="text-neutral-600 mb-6">
            Are you sure you want to delete <span className="font-semibold">{projectToDelete?.name}</span>? This action cannot be undone.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" className="flex-1" onClick={() => { setIsDeleteModalOpen(false); setProjectToDelete(null); }}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDeleteProject} isLoading={deleteProject.isPending}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
