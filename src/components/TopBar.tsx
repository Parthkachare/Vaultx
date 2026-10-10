import { useState } from 'react';
import { Search, Bell, ChevronDown, LogOut, User } from 'lucide-react';

interface Props {
  userName: string;
  role: string;
  notifCount?: number;
  navigate: (page: string) => void;
  onLogout?: () => void;
  onSearch?: (query: string) => void;
}

export default function TopBar({ userName, role, notifCount = 0, navigate, onLogout, onSearch }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [search, setSearch] = useState("");

  return (
    <header
      className="h-13 flex items-center px-5 gap-4 flex-shrink-0"
      style={{
        height: '52px',
        background: 'rgba(11,11,17,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-2.5 flex-1 max-w-xs">
        <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#3a3a58' }} />
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={event => setSearch(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter" && search.trim()) onSearch?.(search.trim());
          }}
          aria-label="Search question papers"
          className="bg-transparent text-sm outline-none flex-1 w-full"
          style={{ color: '#c8c8dc', '::placeholder': { color: '#3a3a58' } } as React.CSSProperties}
        />
      </div>

      <div className="flex items-center gap-3 ml-auto">
        {/* Notif bell */}
        <button
          onClick={() => navigate('notifications')}
          className="relative"
          style={{ color: '#4a4a6a' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#9898b8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4a4a6a'}
        >
          <Bell className="w-4 h-4" />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
          )}
        </button>

        <div className="w-px h-4" style={{ background: '#22223a' }} />

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="flex items-center gap-2.5 py-1 px-2 rounded-lg transition-colors"
            style={{ color: '#9898b8' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1a1a2a'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0"
              style={{ background: '#1e1535', color: '#a78bfa', border: '1px solid #3a2060' }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm hidden sm:block" style={{ color: '#c8c8dc' }}>
              {userName.split(' ')[0]}
            </span>
            <ChevronDown className="w-3 h-3" style={{ color: '#4a4a6a' }} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1.5 w-44 rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#191927', border: '1px solid #2a2a44' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #22223a' }}>
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-3.5 h-3.5" style={{ color: '#5a5a80' }} />
                  <p className="text-xs font-medium text-white">{userName}</p>
                </div>
                <p className="text-[10px] pl-5" style={{ color: '#4a4a6a' }}>{role}</p>
              </div>
              <button
                onClick={() => { setShowMenu(false); onLogout?.(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs transition-colors"
                style={{ color: '#7a7a9a' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#7a7a9a'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <LogOut className="w-3.5 h-3.5" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
