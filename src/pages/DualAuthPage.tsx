import { useState } from 'react';
import { Lock, CheckCircle, Circle, Shield, ArrowLeft, Eye, EyeOff, AlertTriangle, KeyRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/api';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; role: string; userName: string; currentUserId: string; }

export default function DualAuthPage({ navigate, paperId, role, userName, currentUserId }: Props) {
  const { papers, refreshData } = useApp();
  const paper = papers.find(p => p.id === paperId);

  const [showOtpForm, setShowOtpForm] = useState<'m1' | 'm2' | null>(null);
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [confirmedManager, setConfirmedManager] = useState<{ name: string; which: 'm1' | 'm2' } | null>(null);
  const [developmentOtp, setDevelopmentOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!paper) {
    return (
      <div className="h-full overflow-y-auto p-5 sm:p-6">
        <div className="mb-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Authorization queue</p>
          <h1 className="text-xl font-semibold text-white">Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">Papers that still require one or both manager approvals.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {papers.filter(p => p.status === 'LOCKED' || p.status === 'AWAITING_APPROVAL').map(p => (
            <button key={p.id} onClick={() => navigate('dual-auth', p.id)} className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-violet-500/25">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-dim text-violet-400"><Lock className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">{p.subject}</div>
                <div className="mt-0.5 font-mono text-[11px] text-slate-600">{p.id} · {p.examDate}</div>
              </div>
              <div className="flex gap-2 text-[10px] font-semibold">
                <span className={`rounded border px-2 py-1 ${p.manager1Approved ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400' : 'border-border bg-surface-2 text-slate-600'}`}>M1</span>
                <span className={`rounded border px-2 py-1 ${p.manager2Approved ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400' : 'border-border bg-surface-2 text-slate-600'}`}>M2</span>
              </div>
            </button>
          ))}
          {papers.filter(p => p.status === 'LOCKED' || p.status === 'AWAITING_APPROVAL').length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border py-16 text-center text-xs text-slate-600">No papers awaiting approval.</div>
          )}
        </div>
      </div>
    );
  }

  const freshPaper = papers.find(p => p.id === paperId)!;

  const canApproveM1 = role === 'Manager 1' && freshPaper.manager1Id === currentUserId && !freshPaper.manager1Approved;
  const canApproveM2 = role === 'Manager 2' && freshPaper.manager2Id === currentUserId && !freshPaper.manager2Approved;

  const requestApprovalOtp = async (which: 'm1' | 'm2') => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiRequest<{ _devOtp?: string }>('/approvals/otp', {
        method: 'POST',
        body: JSON.stringify({ paperId: paper.id }),
      });
      setDevelopmentOtp(response._devOtp ?? '');
      setOtp('');
      setShowOtpForm(which);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not request an approval OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (which: 'm1' | 'm2') => {
    setError('');
    setSubmitting(true);
    try {
      const response = await apiRequest<{ paperStatus: string; warnings?: string[] }>('/approvals', {
        method: 'POST',
        body: JSON.stringify({ paperId: paper.id, otp }),
      });
      setConfirmedManager({ name: which === 'm1' ? paper.manager1 : paper.manager2, which });
      setShowOtpForm(null);
      setOtp('');
      setDevelopmentOtp('');
      setError(response.warnings?.join(' ') ?? '');
      try {
        await refreshData(role);
      } catch (refreshError) {
        setError(current => `${current ? `${current} ` : ''}Approval was recorded, but the latest paper state could not be loaded: ${refreshError instanceof Error ? refreshError.message : 'refresh failed.'}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Approval could not be recorded.');
    } finally {
      setSubmitting(false);
    }
  };

  const bothApproved = freshPaper.manager1Approved && freshPaper.manager2Approved;

  if (confirmedManager) {
    return (
      <div className="flex min-h-full items-center justify-center p-5 sm:p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h2 className="mb-2 text-xl font-semibold text-white">Approval recorded</h2>
            <p className="text-sm text-slate-400">The server verified your OTP and recorded this approval.</p>
          </div>
          <div className="space-y-3 rounded-xl border border-border bg-surface p-5 text-left">
            {[
              ['Approver', confirmedManager.name],
              ['Paper ID', paper.id],
              ['Subject', paper.subject],
              ['Action', `Manager ${confirmedManager.which === 'm1' ? '1' : '2'} approval (OTP verified)`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-xs text-slate-600">{k}</span>
                <span className="text-xs text-slate-300 font-medium">{v}</span>
              </div>
            ))}
          </div>
          {error && <p role="alert" className="text-left text-xs text-amber-400">{error}</p>}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-left text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {bothApproved
              ? 'Both approvals complete. Paper will unlock at the scheduled server time.'
              : 'This approval alone does NOT unlock the paper. The second manager approval and scheduled time are also required.'}
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('vault')} className="flex-1 rounded-lg border border-border py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-200">Vault</button>
            <button onClick={() => setConfirmedManager(null)} className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
              {bothApproved ? 'View Status' : 'View Auth Status'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('vault')} className="rounded-lg border border-transparent p-2 text-slate-500 transition-colors hover:border-border hover:bg-surface hover:text-slate-200">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Two-person control</p>
          <h1 className="text-xl font-semibold text-white">Dual authorization</h1>
          <p className="mt-1 text-sm text-slate-500">{paper.subject} · {paper.id}</p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-dim/60 p-4">
          <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-400" />
          <p className="text-xs leading-relaxed text-violet-300">
            <span className="font-semibold">Two authorized approvals are required to unlock this paper.</span>{' '}
            Each manager must verify their identity with an OTP. Neither approval alone unlocks the paper — the scheduled time window must also be reached.
          </p>
        </div>
        {error && !showOtpForm && <p role="alert" className="text-xs text-red-400">{error}</p>}

        <div className="grid gap-4 rounded-xl border border-border bg-surface p-5 lg:grid-cols-[minmax(0,1fr)_2fr]">
            <div className="flex items-center gap-4 border-b border-border pb-4 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${bothApproved ? 'border-emerald-500/25 bg-emerald-500/10' : 'border-red-500/20 bg-red-500/[0.07]'}`}>
                <Lock className={`h-5 w-5 ${bothApproved ? 'text-emerald-400' : 'text-red-400'}`} />
              </div>
              <div>
                <div className={`font-mono text-sm font-semibold uppercase tracking-wider ${bothApproved ? 'text-emerald-400' : 'text-red-400'}`}>
                  {bothApproved ? 'Approval complete' : 'Paper locked'}
                </div>
                <div className="mt-1 text-xs text-slate-500">{paper.subject}</div>
              </div>
            </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Exam Starts', paper.startTime],
              ['Paper Unlocks', paper.unlockTime],
              ['Exam Date', paper.examDate],
              ['Security Level', paper.securityLevel],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-600">{k}</div>
                <div className="font-mono text-sm text-slate-300">{v}</div>
              </div>
            ))}
        </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { id: 'm1' as const, label: 'Manager 1', name: freshPaper.manager1, approved: freshPaper.manager1Approved, canApprove: canApproveM1, approvedAt: freshPaper.manager1ApprovedAt, blocked: role !== 'Manager 1' || freshPaper.manager1Id !== currentUserId, blockedReason: 'Only the assigned Manager 1 can submit this approval.' },
            { id: 'm2' as const, label: 'Manager 2', name: freshPaper.manager2, approved: freshPaper.manager2Approved, canApprove: canApproveM2, approvedAt: freshPaper.manager2ApprovedAt, blocked: role !== 'Manager 2' || freshPaper.manager2Id !== currentUserId, blockedReason: 'Only the assigned Manager 2 can submit this approval.' },
          ].map(m => (
            <div key={m.id} className={`rounded-xl border p-5 transition-all ${m.approved ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : 'border-border bg-surface'}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                {m.approved ? <CheckCircle className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-slate-700" />}
                <span className={`text-sm font-semibold ${m.approved ? 'text-emerald-400' : 'text-slate-500'}`}>{m.approved ? 'Approved' : 'Pending'}</span>
                </div>
                <span className="font-mono text-[10px] text-slate-600">{m.label}</span>
              </div>
              <div className="text-sm font-medium text-slate-200 mb-0.5">{m.name}</div>
              <div className="text-xs text-slate-600">{m.label}</div>
              {m.approved && m.approvedAt && <div className="text-[10px] font-mono text-emerald-600 mt-2">{m.approvedAt}</div>}
              {m.canApprove && !m.approved && showOtpForm !== m.id && (
                <button onClick={() => requestApprovalOtp(m.id)} disabled={submitting} className="mt-4 w-full rounded-lg bg-violet-600 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
                  {submitting ? 'Requesting OTP…' : 'Submit My Approval'}
                </button>
              )}
              {showOtpForm === m.id && (
                <div className="mt-4 space-y-3">
                  {developmentOtp && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-dim p-3 text-xs text-violet-300">
                      <div className="mb-1 flex items-center gap-1.5 font-semibold"><KeyRound className="h-3 w-3" /> Development OTP</div>
                      <div className="font-mono text-lg font-bold tracking-widest">{developmentOtp}</div>
                      <div className="text-[10px] text-violet-400/60">This code is never returned in production.</div>
                    </div>
                  )}
                  <div className="relative">
                    <input
                      type={showOtp ? 'text' : 'password'}
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 pr-10 font-mono text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/50"
                    />
                    <button type="button" onClick={() => setShowOtp(!showOtp)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {showOtp ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {error && <p className="text-[10px] text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowOtpForm(null); setOtp(''); setError(''); setDevelopmentOtp(''); }} className="flex-1 rounded-lg border border-border py-2 text-xs text-slate-500 transition-colors hover:text-slate-300">Cancel</button>
                    <button onClick={() => handleApprove(m.id)} disabled={submitting || otp.length < 6} className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-semibold transition-colors disabled:opacity-50">{submitting ? 'Submitting…' : 'Confirm'}</button>
                  </div>
                </div>
              )}
              {m.blocked && !m.approved && (
                <p className="mt-3 text-[10px] text-slate-600">{m.blockedReason ?? `Awaiting ${m.label} to approve`}</p>
              )}
              {!m.canApprove && !m.approved && !m.blocked && (
                <p className="mt-3 text-[10px] text-slate-600">Awaiting {m.label} to approve</p>
              )}
            </div>
          ))}
        </div>

        {bothApproved && (
          <div className="flex gap-3">
            <button onClick={() => navigate('timelock', paper.id)} className="flex-1 rounded-lg border border-border py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-200">View Time Lock</button>
            <button onClick={() => navigate('unlock', paper.id)} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-colors">
              <Lock className="w-4 h-4" /> Proceed to Unlock
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
