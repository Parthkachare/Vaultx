import {
  LayoutDashboard, FileText, Calendar, CheckSquare, Vault,
  ScrollText, ShieldAlert, Users, Bell, Settings, Lock,
} from 'lucide-react';

type Page = string;

const navGroups = [
  {
    label: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'vault', label: 'Question Papers', icon: FileText },
      { id: 'exams', label: 'Examinations', icon: Calendar },
      { id: 'approvals', label: 'Approvals', icon: CheckSquare },
      { id: 'secure-vault', label: 'Vault', icon: Vault },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'audit', label: 'Audit Logs', icon: ScrollText },
      { id: 'security', label: 'Security Monitor', icon: ShieldAlert },
      { id: 'users', label: 'Users', icon: Users },
    ],
  },
  {
    label: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface Props {
  currentPage: Page;
  navigate: (page: Page) => void;
  role: string;
  alertCount?: number;
}

export default function Sidebar({ currentPage, navigate, role, alertCount = 0 }: Props) {
  const visibleGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.id === "audit") return role === "Admin" || role === "Exam Controller";
      if (["security", "users"].includes(item.id)) return role === "Admin";
      if (item.id === "exams" || item.id === "upload") return role === "Admin" || role === "Exam Controller";
      return true;
    }),
  })).filter(group => group.items.length > 0);

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full border-r" style={{ background: '#0f0f1a', borderColor: '#22223a' }}>
      {/* Logo */}
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center glow-violet flex-shrink-0" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
            <Lock className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">VaultX</span>
        </div>
        <p className="text-[10px] mt-2 font-mono" style={{ color: '#4a4a6a' }}>Secure Paper System</p>
      </div>

      {/* Role indicator */}
      <div className="mx-4 mb-4 px-3 py-2 rounded-lg" style={{ background: '#1a1a2e', border: '1px solid #2a2a44' }}>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs font-medium" style={{ color: '#9898b8' }}>{role}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-5">
        {visibleGroups.map(group => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#3a3a58' }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ id, label, icon: Icon }) => {
                const active = currentPage === id;
                const hasAlert = id === 'security' && alertCount > 0;
                return (
                  <button
                    key={id}
                    onClick={() => navigate(id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all relative group"
                    style={active
                      ? { background: '#1e1535', color: '#a78bfa', borderLeft: '2px solid #7c3aed', paddingLeft: '8px' }
                      : { color: '#5a5a80' }
                    }
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#161626'; (e.currentTarget as HTMLElement).style.color = '#9898b8'; }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#5a5a80'; } }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left text-[13px]">{label}</span>
                    {hasAlert && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: '#ef4444' }}>
                        {alertCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4" style={{ borderTop: '1px solid #1e1e30' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-mono" style={{ color: '#3a3a58' }}>AES-256-GCM active</span>
        </div>
      </div>
    </aside>
  );
}
