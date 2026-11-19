import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Clock3, FileText, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/api';
import type { UnlockCheck } from '../services/vault';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; userName: string; userRole: string; }

export default function UnlockPage({ navigate, paperId, userName, userRole }: Props) {
  const { papers } = useApp();
  const paper = papers.find(item => item.id === paperId);
  const [eligibility, setEligibility] = useState<UnlockCheck>();
  const [eligibilityError, setEligibilityError] = useState('');
  const [checking, setChecking] = useState(false);

  const fetchEligibility = useCallback(async () => {
    setChecking(true);
    setEligibilityError('');
    try {
      const result = await apiRequest<UnlockCheck & { serverTime: string }>(
        `/papers/${encodeURIComponent(paperId)}/eligibility`,
      );
      setEligibility(result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not verify release eligibility.';
      setEligibility({ allowed: false, message });
      setEligibilityError(message);
      return undefined;
    } finally {
      setChecking(false);
    }
  }, [paperId]);

  useEffect(() => { void fetchEligibility(); }, [fetchEligibility]);

  const handleOpen = async () => {
    const result = await fetchEligibility();
    if (result?.allowed) navigate('viewer', paperId);
  };

  if (!paper) return null;

  const roleAllowed = ['Admin', 'Exam Controller'].includes(userRole);
  const currentEligibility = eligibility ?? { allowed: false, message: 'Checking release eligibility with the server…' };

  const conditions = [
    {
      label: 'Manager 1 approval',
      met: paper.manager1Approved,
      detail: paper.manager1Approved ? paper.manager1 : `Pending from ${paper.manager1}`,
      time: paper.manager1ApprovedAt,
    },
    {
      label: 'Manager 2 approval',
      met: paper.manager2Approved,
      detail: paper.manager2Approved ? paper.manager2 : `Pending from ${paper.manager2}`,
      time: paper.manager2ApprovedAt,
    },
    {
      label: 'Server time window',
      met: currentEligibility.allowed || !['BEFORE_UNLOCK_TIME', 'AFTER_EXPIRY', 'PAPER_EXPIRED'].includes(currentEligibility.reason ?? ''),
      detail: `${paper.examDate} · ${paper.unlockTime} – ${paper.expiryTime}`,
    },
    {
      label: 'Authorized role',
      met: roleAllowed && !eligibilityError,
      detail: userRole,
    },
  ];

  const allMet = currentEligibility.allowed;

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('paper-details', paperId)} className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-violet-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to paper details
        </button>

        <div className="mb-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Access checkpoint</p>
          <h1 className="text-xl font-semibold text-white">Secure paper release</h1>
          <p className="mt-1 text-sm text-slate-500">VaultX revalidates every release condition before opening the document.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${allMet ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/[0.07] text-red-400'}`}>
                  {allMet ? <ShieldCheck className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
                </div>
                <div>
                  <div className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${allMet ? 'text-emerald-400' : 'text-red-400'}`}>{allMet ? 'Release authorized' : 'Access blocked'}</div>
                  <h2 className="text-lg font-semibold text-white">{paper.subject}</h2>
                  <p className="mt-1 text-xs text-slate-500">{paper.examName} · {paper.course}</p>
                  <p className="mt-2 font-mono text-[11px] text-violet-400">{paper.id}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-b border-border sm:grid-cols-3">
              {[
                ['Exam date (IST)', paper.examDate],
                ['Unlock (IST)', paper.unlockTime],
                ['Expires (IST)', paper.expiryTime],
              ].map(([label, value], index) => (
                <div key={label} className={`p-4 ${index ? 'border-l border-border' : ''} ${index === 2 ? 'col-span-2 border-l-0 border-t border-border sm:col-span-1 sm:border-l sm:border-t-0' : ''}`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
                  <p className="mt-1.5 font-mono text-xs text-slate-300">{value}</p>
                </div>
              ))}
            </div>

            <div className="p-5 sm:p-6">
              {!allMet && currentEligibility.message && (
                <div className="mb-5 flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <div><p className="text-xs font-medium text-amber-300">Release requirement not met</p><p className="mt-1 text-xs leading-relaxed text-amber-400/70">{currentEligibility.message}</p></div>
                </div>
              )}
              {eligibilityError && <p role="alert" className="mb-4 text-xs text-red-400">{eligibilityError}</p>}

              <button
                onClick={handleOpen}
                disabled={!allMet || checking}
                className={`flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-colors ${allMet ? 'bg-violet-600 text-white hover:bg-violet-500' : 'cursor-not-allowed border border-border bg-surface-2 text-slate-700'}`}
              >
                <FileText className="h-4 w-4" /> {checking ? 'Verifying with server…' : allMet ? 'Open in secure viewer' : 'Release conditions not met'}
              </button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-600"><ShieldCheck className="h-3 w-3" /> The protected PDF endpoint verifies access again and records the view.</p>
            </div>
          </section>

          <aside className="h-fit rounded-xl border border-border bg-surface p-5">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-sm font-semibold text-white">Release conditions</h2><p className="mt-0.5 text-[11px] text-slate-600">{conditions.filter(condition => condition.met).length} of {conditions.length} checks passed</p></div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${allMet ? 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400' : 'border-border bg-surface-2 text-slate-600'}`}>
                {allMet ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              </div>
            </div>

            <div className="space-y-2">
              {conditions.map(condition => (
                <div key={condition.label} className="flex gap-3 rounded-lg border border-border/70 bg-surface-2/50 p-3">
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${condition.met ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-red-500/20 bg-red-500/[0.06] text-red-400'}`}>
                    {condition.met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${condition.met ? 'text-slate-300' : 'text-slate-400'}`}>{condition.label}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-slate-600">{condition.detail}</p>
                    {condition.time && <p className="mt-1 font-mono text-[9px] text-slate-700">{condition.time}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-violet-500/15 bg-violet-dim/50 p-3">
              <p className="text-[11px] leading-relaxed text-violet-300/70">The viewer is never opened from the countdown alone. Eligibility is checked again when you select the access action.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
