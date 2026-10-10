import { useEffect, useState } from 'react';
import { Lock, Shield, Clock, CheckCircle, XCircle, ArrowLeft, User, Key } from 'lucide-react';
import { mapPaper, useApp } from '../context/AppContext';
import StatusBadge from '../components/StatusBadge';
import { apiRequest, type ApiPaper } from '../services/api';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; role: string; }

export default function PaperDetailsPage({ navigate, paperId, role }: Props) {
  const { papers, auditLogs } = useApp();
  const [paper, setPaper] = useState(() => papers.find(item => item.id === paperId));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    setPaper(papers.find(item => item.id === paperId));
    setLoading(true);
    setLoadError('');
    apiRequest<ApiPaper>(`/papers/${encodeURIComponent(paperId)}`)
      .then(result => { if (active) setPaper(mapPaper(result)); })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not load paper details.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paperId, papers]);

  if (!paper && loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-500">Loading paper details from VaultX…</div>;
  }
  if (!paper) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="text-center">
          <p role="alert" className="text-slate-400 mb-3">{loadError || 'Paper not found.'}</p>
          <button onClick={() => navigate('vault')} className="text-blue-400 text-sm hover:text-blue-300">Back to Vault</button>
        </div>
      </div>
    );
  }

  const logs = auditLogs.filter(l => l.paperId === paper.id);

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {loadError && <p role="alert" className="text-xs text-amber-400">Could not refresh this record from the server: {loadError}</p>}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('vault')} className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{paper.subject}</h1>
          <p className="text-sm text-slate-500">{paper.examName} · {paper.course}</p>
        </div>
        <StatusBadge status={paper.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Examination Information</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Paper ID', value: paper.id, mono: true },
                { label: 'Encryption ID', value: paper.encryptionId, mono: true },
                { label: 'Exam Date (UTC)', value: paper.examDate },
                { label: 'Start Time (UTC)', value: paper.startTime },
                { label: 'Unlock Time (UTC)', value: paper.unlockTime },
                { label: 'Expiry Time (UTC)', value: paper.expiryTime },
                { label: 'Uploaded By', value: paper.uploadedBy },
                { label: 'Uploaded At', value: paper.uploadedAt },
              ].map(f => (
                <div key={f.label}>
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">{f.label}</div>
                  <div className={`text-sm ${f.mono ? 'font-mono text-blue-400 text-xs' : 'text-slate-200'}`}>{f.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Dual Authorization Status</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Manager 1', name: paper.manager1, approved: paper.manager1Approved, time: paper.manager1ApprovedAt },
                { label: 'Manager 2', name: paper.manager2, approved: paper.manager2Approved, time: paper.manager2ApprovedAt },
              ].map(m => (
                <div key={m.label} className={`p-4 rounded-xl border ${m.approved ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {m.approved ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-slate-600" />}
                    <span className={`text-xs font-semibold ${m.approved ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {m.approved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="w-3 h-3 text-slate-600" />
                    <span className="text-xs text-slate-300">{m.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{m.label}</div>
                  {m.time && <div className="text-[10px] font-mono text-emerald-600 mt-2">{m.time}</div>}
                </div>
              ))}
            </div>
            {(!paper.manager1Approved || !paper.manager2Approved) && (
              <p className="text-xs text-slate-600 mt-3 text-center">Both managers must independently approve before the paper can be unlocked.</p>
            )}
          </div>

          <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Audit History</h2>
            {!['Admin', 'Exam Controller'].includes(role) ? (
              <p className="text-xs text-slate-600 text-center py-4">Audit history is restricted to Admin and Exam Controller roles.</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-slate-600 text-center py-4">No audit events for this paper yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />
                <div className="space-y-4">
                  {logs.map(log => (
                    <div key={log.id} className="flex gap-4 relative">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 z-10 ${log.status === 'Success' ? 'bg-emerald-500 border-emerald-500' : 'bg-red-500 border-red-500'}`} />
                      <div>
                        <p className="text-xs text-slate-300">{log.action}</p>
                        <div className="flex gap-3 mt-1">
                          <span className="text-[10px] font-mono text-slate-600">{log.time}</span>
                          <span className="text-[10px] text-slate-700">·</span>
                          <span className="text-[10px] text-slate-600">{log.user}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-5">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Security</h2>
            <div className="space-y-3">
              {[
                { icon: Key, label: 'AES-256-GCM', sub: 'Encryption algorithm' },
                { icon: Shield, label: paper.securityLevel, sub: 'Security level' },
                { icon: Clock, label: 'Time-locked', sub: `Unlock at ${paper.unlockTime}` },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <s.icon className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-medium text-slate-300">{s.label}</div>
                    <div className="text-[10px] text-slate-600">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-xl border p-5 ${paper.status === 'UNLOCKED' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Lock className={`w-5 h-5 ${paper.status === 'UNLOCKED' ? 'text-emerald-400' : 'text-red-400'}`} />
              <span className={`text-sm font-bold ${paper.status === 'UNLOCKED' ? 'text-emerald-400' : 'text-red-400'}`}>
                {paper.status === 'UNLOCKED' ? '🔓 UNLOCKED' : '🔒 LOCKED'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {paper.status === 'UNLOCKED' ? 'Paper is accessible during the allowed window.' : 'Paper cannot be accessed until all conditions are met.'}
            </p>
          </div>

          <div className="space-y-2">
            {(paper.status === 'LOCKED' || paper.status === 'AWAITING_APPROVAL') && (
              <button onClick={() => navigate('dual-auth', paper.id)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors">
                <Shield className="w-4 h-4" /> Authorize Access
              </button>
            )}
            {paper.status === 'APPROVED' && (
              <button onClick={() => navigate('timelock', paper.id)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500/80 hover:bg-amber-500 text-white text-sm font-semibold transition-colors">
                <Clock className="w-4 h-4" /> View Time Lock
              </button>
            )}
            {paper.status === 'UNLOCKED' && (
              <button onClick={() => navigate('unlock', paper.id)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
                <Lock className="w-4 h-4" /> Open Secure Paper
              </button>
            )}
            <button onClick={() => navigate('audit')} className="w-full py-2.5 rounded-lg border border-white/[0.08] text-slate-400 text-sm hover:text-slate-200 hover:border-white/20 transition-colors">View Full Audit Log</button>
          </div>
        </div>
      </div>
    </div>
  );
}
