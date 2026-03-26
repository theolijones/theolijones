import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import {
  Film,
  FolderOpen,
  Radio,
  LayoutGrid,
  Calendar,
  ShieldCheck,
  BarChart3,
  Settings,
  Blocks,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { getLogoutUrl } from '@/lib/auth';

const navItems = [
  { to: '/', icon: Film, label: 'Library' },
  { to: '/folders', icon: FolderOpen, label: 'Folders' },
  { to: '/livestreams', icon: Radio, label: 'Live' },
  { to: '/placements', icon: LayoutGrid, label: 'Placements' },
  { to: '/scheduling', icon: Calendar, label: 'Scheduling' },
  { to: '/qa', icon: ShieldCheck, label: 'QA' },
  { to: '/modules', icon: Blocks, label: 'Modules' },
  { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
];

const bottomItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const user = useAuthStore((s) => s.user);

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-velox-surface border-r border-velox-border flex flex-col z-50">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-velox-border">
        <span className="font-mono text-lg font-medium tracking-wider text-velox-accent">
          VELOX
        </span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-velox-accent-muted text-velox-accent'
                  : 'text-velox-text-secondary hover:text-velox-text-primary hover:bg-velox-surface-hover'
              )
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="py-3 px-3 border-t border-velox-border space-y-0.5">
        {bottomItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-velox-accent-muted text-velox-accent'
                  : 'text-velox-text-secondary hover:text-velox-text-primary hover:bg-velox-surface-hover'
              )
            }
          >
            <item.icon className="w-[18px] h-[18px]" />
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* User */}
        <div className="flex items-center justify-between px-3 py-2.5 mt-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-velox-accent-muted flex items-center justify-center text-velox-accent text-xs font-mono font-medium shrink-0">
              {user?.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-xs text-velox-text-secondary truncate">
              {user?.email || 'Not signed in'}
            </span>
          </div>
          <a
            href={getLogoutUrl()}
            className="text-velox-text-muted hover:text-velox-red transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </a>
        </div>
      </div>
    </aside>
  );
}
