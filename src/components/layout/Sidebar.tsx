import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Github,
  Rocket,
  Link2,
  Brain,
  BarChart3,
  Settings,
  Shield,
  HelpCircle,
  FolderKanban,
  Bell,
  Building2,
  ChevronLeft,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';

const workspaceNav = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', href: '/projects', icon: FolderKanban },
  { label: 'Ideas', href: '/ideas', icon: Lightbulb },
  { label: 'GitHub', href: '/github', icon: Github },
  { label: 'Deployments', href: '/deployments', icon: Rocket },
  { label: 'Integrations', href: '/integrations', icon: Link2 },
];


const intelligenceNav = [
  { label: 'AI Studio', href: '/ai-studio', icon: Brain, accent: true },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const accountNav = [
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Organization', href: '/organization', icon: Building2 },
  { label: 'Configuration', href: '/config', icon: Settings },
  { label: 'Settings', href: '/settings', icon: Shield },
];

function NavSection({
  title,
  items,
  collapsed,
}: {
  title: string;
  items: { label: string; href: string; icon: React.ElementType; accent?: boolean }[];
  collapsed: boolean;
}) {
  const location = useLocation();

  return (
    <div className="mb-6">
      {!collapsed && (
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-surface-400">
          {title}
        </p>
      )}
      <div className="space-y-0.5">
        {items.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-[#E8E1FF] text-[#321F73] shadow-[0_10px_30px_rgba(91,47,183,0.08)]'
                  : 'text-[#5E4F7C] hover:bg-[#F6F1FF] hover:text-[#321F73]',
                collapsed && 'justify-center px-2'
              )}
            >
              <item.icon
                className={cn(
                  'w-[18px] h-[18px] shrink-0 transition-colors',
                  active ? 'text-[#7A57FF]' : item.accent ? 'text-[#9B6DFF] group-hover:text-[#8656FF]' : 'text-[#A99CC2] group-hover:text-[#7A57FF]'
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.accent && !active && (
                <Sparkles className="w-3 h-3 ml-auto text-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function Sidebar() {
  const { collapsed, toggle } = useSidebar();

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col shrink-0 sticky top-16 h-[calc(100vh-4rem)] border-r border-[#E9D5FF] bg-[#EDE9FE] transition-all duration-300',
        collapsed ? 'w-[72px]' : 'w-60'
      )}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/50">
        {!collapsed && (
          <span className="text-xs font-semibold text-surface-500 px-2">DevOS</span>
        )}
        <button
          onClick={toggle}
          className={cn(
            'p-2 rounded-lg text-surface-400 hover:text-violet-600 hover:bg-violet-50 transition-colors',
            collapsed && 'mx-auto'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2">
        <NavSection title="Workspace" items={workspaceNav} collapsed={collapsed} />
        <NavSection title="Intelligence" items={intelligenceNav} collapsed={collapsed} />
        <NavSection title="Account" items={accountNav} collapsed={collapsed} />
      </div>

      <div className="p-2 border-t border-white/50">
        <Link
          to="/contact"
          title={collapsed ? 'Help' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-500 hover:bg-white/60 hover:text-neutral-700 transition-colors',
            collapsed && 'justify-center'
          )}
        >
          <HelpCircle className="w-[18px] h-[18px]" />
          {!collapsed && <span>Help</span>}
        </Link>
      </div>
    </aside>
  );
}
