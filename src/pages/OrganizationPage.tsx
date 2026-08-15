import { useState } from 'react';
import { Users, UserPlus, FolderKanban, Rocket } from 'lucide-react';
import { Button, Card, Input, EmptyState, Modal, Badge } from '@/components/ui';
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

      <div className="grid sm:grid-cols-4 gap-4">
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
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Projects</h2>
          {projects.length === 0 ? (
            <EmptyState icon={<FolderKanban className="w-8 h-8" />} title="No projects" description="Create a project to organize your work." />
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 5).map((p) => (
                <div key={p.id} className="p-3 rounded-xl bg-surface-50 flex justify-between">
                  <span className="font-medium text-neutral-900">{p.name}</span>
                  <Badge>{p.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">Deployments</h2>
          {deployments.length === 0 ? (
            <EmptyState icon={<Rocket className="w-8 h-8" />} title="No deployments" description="Connect a platform and sync deployments." />
          ) : (
            <div className="space-y-2">
              {deployments.slice(0, 5).map((d) => (
                <div key={d.id} className="p-3 rounded-xl bg-surface-50 flex justify-between">
                  <span className="font-medium text-neutral-900">{d.name}</span>
                  <Badge variant={d.status === 'live' ? 'success' : 'default'}>{d.status}</Badge>
                </div>
              ))}
            </div>
          )}
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
