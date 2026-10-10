import { Upload, FileText, Clock, CheckCircle, ArrowRight, CalendarClock, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { groupPapersByExam, utcToday } from '../services/exams';
import StatusBadge from '../components/StatusBadge';

interface Props { navigate: (page: string, extra?: string) => void; }

const S = {
  card: { background: '#13131e', border: '1px solid #26263a', borderRadius: '10px' } as React.CSSProperties,
};

export default function ExamControllerDashboard({ navigate, userName }: Props & { userName: string }) {
  const { papers, auditLogs } = useApp();

  const pendingApprovals = papers.filter(p => p.status === 'AWAITING_APPROVAL' || p.status === 'LOCKED');
  const upcoming = groupPapersByExam(papers).filter(exam => exam.date >= utcToday());
  const myLogs = auditLogs.filter(log => log.user === userName).slice(0, 5);

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full" style={{ color: '#c8c8dc' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Exam Controller</h1>
          <p className="text-xs mt-0.5" style={{ color: '#4a4a6a' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('upload')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white glow-violet"
          style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.9'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}
        >
          <Upload className="w-3.5 h-3.5" /> Upload Paper
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'linear-gradient(135deg,#1e1535,#14112a)', border: '1px solid #3a2060' }}>
          <FileText className="w-5 h-5 mb-3" style={{ color: '#a78bfa' }} />
          <div className="text-2xl font-bold text-white">{papers.length}</div>
          <div className="text-xs mt-1" style={{ color: '#6a4a8a' }}>Question papers</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: pendingApprovals.length > 0 ? 'rgba(251,191,36,0.05)' : '#191927', border: pendingApprovals.length > 0 ? '1px solid rgba(251,191,36,0.2)' : '1px solid #26263a' }}>
          <Clock className="w-5 h-5 mb-3" style={{ color: pendingApprovals.length > 0 ? '#fbbf24' : '#3a3a58' }} />
          <div className="text-2xl font-bold" style={{ color: pendingApprovals.length > 0 ? '#fbbf24' : '#e2e2e8' }}>{pendingApprovals.length}</div>
          <div className="text-xs mt-1" style={{ color: '#4a4a6a' }}>Pending approval</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#191927', border: '1px solid #26263a' }}>
          <CalendarClock className="w-5 h-5 mb-3" style={{ color: '#34d399' }} />
          <div className="text-2xl font-bold" style={{ color: '#34d399' }}>{upcoming.length}</div>
          <div className="text-xs mt-1" style={{ color: '#4a4a6a' }}>Upcoming exams</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#191927', border: '1px solid #26263a' }}>
          <CheckCircle className="w-5 h-5 mb-3" style={{ color: '#38bdf8' }} />
          <div className="text-2xl font-bold" style={{ color: '#38bdf8' }}>{papers.filter(p => p.status === 'APPROVED' || p.status === 'UNLOCKED').length}</div>
          <div className="text-xs mt-1" style={{ color: '#4a4a6a' }}>Approved / unlocked</div>
        </div>
      </div>

      {/* Pending approval alert */}
      {papers.filter(p => p.status === 'AWAITING_APPROVAL').length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24' }} />
          <p className="text-sm flex-1" style={{ color: '#fbbf24' }}>
            <span className="font-semibold">{papers.filter(p => p.status === 'AWAITING_APPROVAL').length} paper(s)</span> awaiting manager approval.
          </p>
          <button onClick={() => navigate('approvals')} className="flex items-center gap-1 text-xs" style={{ color: '#fbbf24' }}>
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming exams */}
        <div className="rounded-xl overflow-hidden" style={S.card}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
            <span className="text-sm font-medium text-white">Upcoming Exams</span>
            <button onClick={() => navigate('exams')} className="text-xs transition-colors" style={{ color: '#5a5a80' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#5a5a80'}>
              All exams
            </button>
          </div>
          <div>
            {upcoming.map((exam, i) => (
              <div key={exam.id} className="flex items-center gap-3 px-4 py-3" style={i < upcoming.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.025)' } : {}}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <CalendarClock className="w-4 h-4" style={{ color: '#a78bfa' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#d4d4e8' }}>{exam.name}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: '#3a3a58' }}>{exam.date} · {exam.startTime}</p>
                </div>
                <span className="text-[10px] font-mono" style={{ color: '#34d399' }}>{exam.papers.length}p</span>
              </div>
            ))}
            {upcoming.length === 0 && <div className="px-4 py-8 text-xs text-center" style={{ color: '#3a3a58' }}>No upcoming exams</div>}
          </div>
        </div>

        {/* Papers list */}
        <div className="rounded-xl overflow-hidden" style={S.card}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
            <span className="text-sm font-medium text-white">Question Papers</span>
            <button onClick={() => navigate('vault')} className="text-xs transition-colors" style={{ color: '#5a5a80' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#a78bfa'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#5a5a80'}>
              Open vault
            </button>
          </div>
          <div>
            {papers.slice(0, 5).map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                style={i < 4 ? { borderBottom: '1px solid rgba(255,255,255,0.025)' } : {}}
                onClick={() => navigate('paper-details', p.id)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.015)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#d4d4e8' }}>{p.subject}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: '#3a3a58' }}>{p.id} · {p.examDate}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl overflow-hidden" style={S.card}>
        <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e1e30' }}>
          <span className="text-sm font-medium text-white">Your recent activity</span>
        </div>
        {myLogs.length === 0 ? (
          <div className="px-4 py-6 text-xs" style={{ color: '#3a3a58' }}>No recent activity.</div>
        ) : (
          myLogs.map((log, i) => (
            <div key={log.id} className="flex items-start gap-3 px-4 py-2.5" style={i < myLogs.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.025)' } : {}}>
              <span className="font-mono text-[10px] w-16 shrink-0 pt-px" style={{ color: '#3a3a58' }}>{log.time.split('·')[0].trim()}</span>
              <span className="font-mono text-[10px] shrink-0 pt-px" style={{ color: log.status === 'Success' ? '#34d399' : '#f87171' }}>{log.status === 'Success' ? 'OK' : 'ERR'}</span>
              <span className="text-xs" style={{ color: '#8888a0' }}>{log.action}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
