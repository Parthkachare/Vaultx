import { useEffect, useState } from 'react';
import { FileText, Lock, ShieldAlert, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { apiRequest } from '../services/api';

interface Props { navigate: (page: string, extra?: string) => void; }

const S = {
  card: { background: '#13131e', border: '1px solid #26263a', borderRadius: '10px' } as React.CSSProperties,
  cardEl: { background: '#191927', border: '1px solid #26263a', borderRadius: '10px' } as React.CSSProperties,
  label: { color: '#4a4a6a' } as React.CSSProperties,
};

export default function AdminDashboard({ navigate }: Props) {
  const { papers, auditLogs, securityAlerts } = useApp();
  const [health, setHealth] = useState<'checking' | 'ok' | 'unavailable'>('checking');

  useEffect(() => {
    let active = true;
    apiRequest<{ status: string; database: string }>('/health')
      .then(result => { if (active) setHealth(result.status === 'ok' && result.database === 'connected' ? 'ok' : 'unavailable'); })
      .catch(() => { if (active) setHealth('unavailable'); });
    return () => { active = false; };
  }, []);

  const locked   = papers.filter(p => p.status === 'LOCKED').length;
  const awaiting = papers.filter(p => p.status === 'AWAITING_APPROVAL').length;
  const approved = papers.filter(p => p.status === 'APPROVED').length;
  const activeAlerts = securityAlerts.filter(a => !a.resolved);
  const today    = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  return (
    <div className="p-5 overflow-y-auto h-full space-y-5" style={{ color: '#c8c8dc' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Admin Dashboard</h1>
          <p className="text-xs mt-0.5" style={S.label}>{today}</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono" style={{
          background: health === 'ok' ? 'rgba(52,211,153,0.08)' : 'rgba(251,191,36,0.08)',
          border: health === 'ok' ? '1px solid rgba(52,211,153,0.18)' : '1px solid rgba(251,191,36,0.18)',
          color: health === 'ok' ? '#34d399' : '#fbbf24',
        }}>
          <CheckCircle className="w-3.5 h-3.5" /> {health === 'ok' ? 'Backend and database connected' : health === 'checking' ? 'Checking backend health…' : 'Backend or database unavailable'}
        </div>
      </div>

      {/* Stat cards — each visually distinct */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total papers — violet solid accent */}
        <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg,#1e1535,#14112a)', border: '1px solid #3a2060' }}>
          <FileText className="w-5 h-5 mb-3" style={{ color: '#a78bfa' }} />
          <div className="text-3xl font-bold text-white">{papers.length}</div>
          <div className="text-xs mt-1" style={{ color: '#7a5a9a' }}>Total papers</div>
        </div>

        {/* Locked — red tint */}
        <div className="rounded-xl p-4" style={{ background: '#191927', border: '1px solid #26263a' }}>
          <Lock className="w-5 h-5 mb-3" style={{ color: '#f87171' }} />
          <div className="text-3xl font-bold" style={{ color: locked > 0 ? '#f87171' : '#e2e2e8' }}>{locked}</div>
          <div className="text-xs mt-1" style={S.label}>Locked papers</div>
        </div>

        {/* Awaiting — amber tint */}
        <div className="rounded-xl p-4" style={{ background: awaiting > 0 ? 'rgba(251,191,36,0.05)' : '#191927', border: awaiting > 0 ? '1px solid rgba(251,191,36,0.2)' : '1px solid #26263a' }}>
          <Clock className="w-5 h-5 mb-3" style={{ color: awaiting > 0 ? '#fbbf24' : '#3a3a58' }} />
          <div className="text-3xl font-bold" style={{ color: awaiting > 0 ? '#fbbf24' : '#e2e2e8' }}>{awaiting}</div>
          <div className="text-xs mt-1" style={S.label}>Awaiting approval</div>
        </div>

        {/* Alerts — red solid if active */}
        <div className="rounded-xl p-4" style={{ background: activeAlerts.length > 0 ? 'rgba(239,68,68,0.06)' : '#191927', border: activeAlerts.length > 0 ? '1px solid rgba(239,68,68,0.2)' : '1px solid #26263a' }}>
          <ShieldAlert className="w-5 h-5 mb-3" style={{ color: activeAlerts.length > 0 ? '#f87171' : '#3a3a58' }} />
          <div className="text-3xl font-bold" style={{ color: activeAlerts.length > 0 ? '#f87171' : '#e2e2e8' }}>{activeAlerts.length}</div>
          <div className="text-xs mt-1" style={S.label}>Active alerts</div>
        </div>
      </div>

      {/* Approved papers banner if any */}
      {approved > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#a78bfa' }} />
          <p className="text-sm" style={{ color: '#a78bfa' }}>
            <span className="font-semibold">{approved} paper{approved !== 1 ? 's' : ''}</span> approved by both managers — awaiting scheduled unlock time.
          </p>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Audit log — 3 cols, dense */}
        <div className="lg:col-span-3 rounded-xl overflow-hidden" style={S.card}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
            <span className="text-sm font-medium text-white">Recent activity</span>
            <button onClick={() => navigate('audit')} className="flex items-center gap-1 text-xs transition-colors" style={{ color: '#5a5a80' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#5a5a80'}>
              All logs <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {auditLogs.slice(0, 8).map((log, i) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-4 py-2.5"
              style={i < 7 ? { borderBottom: '1px solid rgba(255,255,255,0.03)' } : {}}
            >
              <span className="font-mono text-[10px] w-16 shrink-0 pt-px" style={{ color: '#3a3a58' }}>
                {log.time.split('·')[0].replace(/\s+/g, ' ').trim()}
              </span>
              <span
                className="font-mono text-[10px] shrink-0 pt-px w-8 font-semibold"
                style={{ color: log.status === 'Success' ? '#34d399' : '#f87171' }}
              >
                {log.status === 'Success' ? 'OK' : 'ERR'}
              </span>
              <span className="text-xs leading-relaxed" style={{ color: '#8888a0' }}>{log.action}</span>
            </div>
          ))}
        </div>

        {/* Alerts panel — 2 cols */}
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={S.card}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
            <span className="text-sm font-medium text-white">Security alerts</span>
            <button onClick={() => navigate('security')} className="text-xs transition-colors" style={{ color: '#5a5a80' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#5a5a80'}>
              View all
            </button>
          </div>
          {activeAlerts.length === 0 ? (
            <div className="px-4 py-10 text-xs text-center" style={{ color: '#3a3a58' }}>No active alerts</div>
          ) : (
            activeAlerts.slice(0, 5).map((a, i) => {
              const sevColor = a.severity === 'Critical' ? '#f87171' : a.severity === 'High' ? '#fb923c' : '#fbbf24';
              return (
                <div key={a.id} className="px-4 py-3" style={i < activeAlerts.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.03)' } : {}}>
                  <div className="flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: sevColor }} />
                    <div className="min-w-0">
                      <p className="text-xs leading-snug" style={{ color: '#c8c8dc' }}>{a.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-mono" style={{ color: sevColor }}>{a.severity}</span>
                        <span className="text-[10px]" style={{ color: '#3a3a58' }}>{a.type}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Papers table */}
      <div className="rounded-xl overflow-hidden" style={S.card}>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
          <span className="text-sm font-medium text-white">Papers overview</span>
          <button onClick={() => navigate('vault')} className="flex items-center gap-1 text-xs transition-colors" style={{ color: '#5a5a80' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#5a5a80'}>
            Open vault <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid #1e1e30' }}>
              {['Paper ID', 'Subject', 'Exam Date', 'Unlock', 'Status'].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[11px] uppercase tracking-wide font-medium" style={{ color: '#3a3a58' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {papers.filter(p => p.status !== 'EXPIRED').slice(0, 5).map((p, i) => (
              <tr
                key={p.id}
                className="cursor-pointer"
                style={i < 4 ? { borderBottom: '1px solid rgba(255,255,255,0.03)' } : {}}
                onClick={() => navigate('paper-details', p.id)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.015)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: '#a78bfa' }}>{p.id}</td>
                <td className="px-4 py-3 text-xs font-medium" style={{ color: '#c8c8dc' }}>{p.subject}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#5a5a80' }}>{p.examDate}</td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#5a5a80' }}>{p.unlockTime}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-2 flex-wrap pb-1">
        <span className="text-xs" style={S.label}>Quick links:</span>
        {[
          { label: 'Upload paper', page: 'upload' },
          { label: 'Manage users', page: 'users' },
          { label: 'Exams', page: 'exams' },
          { label: 'Audit logs', page: 'audit' },
        ].map(l => (
          <button
            key={l.page}
            onClick={() => navigate(l.page)}
            className="px-3 py-1.5 rounded text-xs transition-all"
            style={{ color: '#6a6a88', border: '1px solid #22223a', background: 'transparent' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color='#a78bfa'; (e.currentTarget as HTMLElement).style.borderColor='rgba(139,92,246,0.3)'; (e.currentTarget as HTMLElement).style.background='rgba(139,92,246,0.06)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color='#6a6a88'; (e.currentTarget as HTMLElement).style.borderColor='#22223a'; (e.currentTarget as HTMLElement).style.background='transparent'; }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
