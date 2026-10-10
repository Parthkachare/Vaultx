import { useState } from 'react';
import { Search, Upload, Eye, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { type PaperStatus } from '../data/mockData';
import StatusBadge from '../components/StatusBadge';

interface Props { navigate: (page: string, extra?: string) => void; initialSearch?: string; }

const FILTERS: Array<{ key: PaperStatus | 'ALL'; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'LOCKED', label: 'Locked' },
  { key: 'AWAITING_APPROVAL', label: 'Awaiting' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'UNLOCKED', label: 'Unlocked' },
  { key: 'EXPIRED', label: 'Expired' },
];

export default function VaultPage({ navigate, initialSearch = '' }: Props) {
  const { papers } = useApp();
  const [search, setSearch] = useState(initialSearch);
  const [filterStatus, setFilterStatus] = useState<PaperStatus | 'ALL'>('ALL');

  const filtered = papers.filter(p => {
    const s = (p.subject + p.id + p.examName).toLowerCase();
    return s.includes(search.toLowerCase()) && (filterStatus === 'ALL' || p.status === filterStatus);
  });

  return (
    <div className="p-5 space-y-4 overflow-y-auto h-full" style={{ color: '#c8c8dc' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Question Papers</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4a4a6a' }}>{papers.length} encrypted papers · AES-256-GCM</p>
        </div>
        <button
          onClick={() => navigate('upload')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all glow-violet"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg flex-1 min-w-44 max-w-xs"
          style={{ background: '#191927', border: '1px solid #26263a' }}
        >
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: '#3a3a58' }} />
          <input
            type="text"
            placeholder="Search papers..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: '#c8c8dc' }}
          />
        </div>

        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: '#191927', border: '1px solid #26263a' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="px-3 py-1.5 rounded text-xs transition-colors"
              style={filterStatus === f.key
                ? { background: '#1e1535', color: '#a78bfa' }
                : { color: '#4a4a6a', background: 'transparent' }
              }
              onMouseEnter={e => { if (filterStatus !== f.key) (e.currentTarget as HTMLElement).style.color='#9898b8'; }}
              onMouseLeave={e => { if (filterStatus !== f.key) (e.currentTarget as HTMLElement).style.color='#4a4a6a'; }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#13131e', border: '1px solid #26263a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e30' }}>
              {['Paper ID', 'Subject', 'Course', 'Exam Date', 'Unlock', 'M1', 'M2', 'Level', 'Status', ''].map(h => (
                <th key={h} className="text-left px-3 py-3 text-[10px] uppercase tracking-widest font-semibold first:pl-4" style={{ color: '#3a3a58' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((paper, i) => (
              <tr
                key={paper.id}
                className="cursor-pointer group"
                style={i < filtered.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.025)' } : {}}
                onClick={() => navigate('paper-details', paper.id)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.015)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <td className="py-3 px-3 pl-4 font-mono text-xs" style={{ color: '#a78bfa' }}>{paper.id}</td>
                <td className="py-3 px-3 text-xs font-medium" style={{ color: '#d4d4e8' }}>{paper.subject}</td>
                <td className="py-3 px-3 text-xs" style={{ color: '#5a5a80' }}>{paper.course}</td>
                <td className="py-3 px-3 text-xs font-mono" style={{ color: '#5a5a80' }}>{paper.examDate}</td>
                <td className="py-3 px-3 text-xs font-mono" style={{ color: '#5a5a80' }}>{paper.unlockTime}</td>
                <td className="py-3 px-3 text-xs font-mono">
                  {paper.manager1Approved
                    ? <span style={{ color: '#34d399' }}>✓</span>
                    : <span style={{ color: '#2a2a40' }}>—</span>}
                </td>
                <td className="py-3 px-3 text-xs font-mono">
                  {paper.manager2Approved
                    ? <span style={{ color: '#34d399' }}>✓</span>
                    : <span style={{ color: '#2a2a40' }}>—</span>}
                </td>
                <td className="py-3 px-3 text-[10px] font-mono font-semibold" style={{ color: paper.securityLevel === 'CRITICAL' ? '#f87171' : '#fbbf24' }}>
                  {paper.securityLevel}
                </td>
                <td className="py-3 px-3"><StatusBadge status={paper.status} /></td>
                <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => navigate('paper-details', paper.id)} className="p-1.5 rounded transition-colors" style={{ color: '#4a4a6a' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#4a4a6a'}>
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {(paper.status === 'LOCKED' || paper.status === 'AWAITING_APPROVAL') && (
                      <button onClick={() => navigate('dual-auth', paper.id)} className="p-1.5 rounded transition-colors" style={{ color: '#4a4a6a' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#fbbf24'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#4a4a6a'}>
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm" style={{ color: '#3a3a58' }}>No papers match your filter.</div>
        )}
      </div>
    </div>
  );
}
