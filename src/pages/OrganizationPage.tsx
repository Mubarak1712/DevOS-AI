import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, FolderKanban, Rocket, ArrowRight } from 'lucide-react';
import { Button, Card, Input, EmptyState, Modal } from '@/components/ui';
import { useProjects, useDeployments } from '@/hooks/api';

export function OrganizationPage() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: deployments = [] } = useDeployments();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Organization</h1>
          <p className="text-surface-500 mt-2">Manage your team workspace</p>
        </div>
        <Button onClick={() => setIsInviteModalOpen(true)} disabled title="Team invites coming soon">
          <UserPlus className="w-4 h-4 mr-2" />
          Invite Member
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: 'Members', value: '1', icon: Users },
          { label: 'Projects', value: String(projects.length), icon: FolderKanban },
          { label: 'Deployments', value: String(deployments.length), icon: Rocket },
        ].map((stat) => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-center gap-3">
              <stat.icon className="w-5 h-5 text-surface-400" />
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-sm text-surface-500">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-6">Team Members</h2>
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="Solo workspace"
          description="Organization features are coming soon. You are currently the only member of this workspace."
        />
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-semibold text-neutral-900">Workspace Projects</h2>
            </div>
            <Link to="/projects">
              <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700">
                Manage Projects <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-surface-500 mb-4">
            {projects.length === 1
              ? '1 project currently active in this workspace.'
              : `${projects.length} projects currently managed in this workspace.`}
          </p>
          <div className="rounded-xl bg-surface-50 p-4 border border-surface-200/60 flex items-center justify-between text-sm">
            <span className="text-surface-600">Active development</span>
            <span className="font-semibold text-neutral-900">
              {projects.filter((p) => p.status === 'development' || p.status === 'testing').length}
            </span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-neutral-900">Workspace Deployments</h2>
            </div>
            <Link to="/deployments">
              <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700">
                View Deployments <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-surface-500 mb-4">
            {deployments.length === 1
              ? '1 deployment connected to this organization.'
              : `${deployments.length} deployments tracked across connected platforms.`}
          </p>
          <div className="rounded-xl bg-surface-50 p-4 border border-surface-200/60 flex items-center justify-between text-sm">
            <span className="text-surface-600">Live endpoints</span>
            <span className="font-semibold text-emerald-600">
              {deployments.filter((d) => d.status === 'live').length}
            </span>
          </div>
        </Card>
      </div>

      <Modal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        title="Invite Team Member"
        description="Send an invitation to join your organization"
      >
        <div className="space-y-4">
          <Input label="Email Address" type="email" placeholder="colleague@example.com" disabled />
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)} className="flex-1">Cancel</Button>
            <Button className="flex-1" disabled>Coming Soon</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
