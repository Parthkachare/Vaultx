import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarClock, Check, Clock3, LockKeyhole, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApiRequestError, apiRequest } from '../services/api';
import type { UnlockCheck } from '../services/vault';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; }

export default function TimeLockPage({ navigate, paperId }: Props) {
  const { papers } = useApp();
  const paper = papers.find(item => item.id === paperId);
  const [now, setNow] = useState(() => Date.now());
  const [eligibility, setEligibility] = useState<UnlockCheck>();
  const [eligibilityError, setEligibilityError] = useState('');
  const [checking, setChecking] = useState(false);
  const checkInFlight = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const verifyOnServer = useCallback(async () => {
    if (checkInFlight.current) return undefined;
    checkInFlight.current = true;
    setChecking(true);
    setEligibilityError('');
    try {
      const result = await apiRequest<UnlockCheck & { serverTime: string }>(
        `/papers/${encodeURIComponent(paperId)}/eligibility`,
      );
      setEligibility(result);
      return result;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Could not verify release eligibility.';
      const status = error instanceof ApiRequestError ? error.status : undefined;
      const requestId = error instanceof ApiRequestError ? error.requestId : undefined;
      const message = status === 401
        ? `Your VaultX session was rejected (HTTP 401): ${detail} Sign in again and retry.`
        : status === 403
          ? `Release check rejected (HTTP 403): ${detail} Only Admin and Exam Controller accounts can verify or open a paper. If this screen shows an authorized role, sign in again to refresh the session and retry.`
          : status
            ? `Release check failed (HTTP ${status}): ${detail}`
            : detail;
      const result = { allowed: false, message, reason: status === 401 ? 'NOT_AUTHENTICATED' as const : status === 403 ? 'UNAUTHORIZED_ROLE' as const : undefined };
      setEligibility(result);
      setEligibilityError(requestId ? `${message} Request ID: ${requestId}` : message);
      return result;
    } finally {
      checkInFlight.current = false;
      setChecking(false);
    }
  }, [paperId]);

  useEffect(() => { void verifyOnServer(); }, [verifyOnServer]);

  const unlockAt = useMemo(() => paper ? parseScheduledTime(paper.examDate, paper.unlockTime) : 0, [paper]);
  if (!paper) return null;

  const hasValidUnlockTime = Number.isFinite(unlockAt);
  const remaining = hasValidUnlockTime ? Math.max(0, unlockAt - now) : 0;
  const countdown = hasValidUnlockTime ? formatCountdown(remaining) : '--:--:--:--';
  const displayWindowReached = hasValidUnlockTime && remaining === 0;
  const approvalCount = Number(paper.manager1Approved) + Number(paper.manager2Approved);

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <button onClick={() => navigate('paper-details', paperId)} className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-violet-400">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to paper details
        </button>

        <div className="mb-6">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Scheduled release</p>
          <h1 className="text-xl font-semibold text-white">Time lock</h1>
          <p className="mt-1 text-sm text-slate-500">Monitor the configured window without bypassing server-side release checks.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="relative p-6 text-center sm:p-8">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-dim text-violet-400">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">{displayWindowReached ? 'Unlock time passed on this device' : 'Approximate time remaining'}</div>
              {displayWindowReached ? (
                <p className="mx-auto mt-4 max-w-md text-2xl font-semibold text-white">Ready for server verification</p>
              ) : (
                <p className="mt-3 font-mono text-4xl font-semibold tracking-tight text-white sm:text-5xl">{countdown}</p>
              )}
              <p className="mt-4 text-sm text-slate-400">{paper.subject}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-600">{paper.id}</p>
            </div>

            <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3">
              {[
                ['Exam date (IST)', paper.examDate],
                ['Unlock (IST)', paper.unlockTime],
                ['Expires (IST)', paper.expiryTime],
              ].map(([label, value], index) => (
                <div key={label} className={`p-4 text-center ${index ? 'border-l border-border' : ''} ${index === 2 ? 'col-span-2 border-l-0 border-t border-border sm:col-span-1 sm:border-l sm:border-t-0' : ''}`}>
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">{label}</p>
                  <p className="mt-1.5 font-mono text-xs text-slate-300">{value}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-border p-5 sm:p-6">
              <div className="mb-4 flex gap-3 rounded-lg border border-violet-500/15 bg-violet-dim/40 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
                <div className="text-xs leading-relaxed text-violet-300/70">
                  <p>This device countdown is informational; the backend is authoritative for role, approvals, unlock, and expiry checks.</p>
                  {eligibility && !eligibilityError && <p className={`mt-2 ${eligibility.allowed ? 'text-emerald-300' : 'text-amber-300'}`}>{eligibility.allowed ? 'Server: eligible to open.' : `Server: ${eligibility.message}`}</p>}
                </div>
              </div>
              {eligibilityError && (
                <div role="alert" className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-red-300">
                  {eligibilityError}
                </div>
              )}
              <button onClick={async () => {
                const result = await verifyOnServer();
                if (result?.allowed) navigate('unlock', paperId);
              }} disabled={checking} className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
                <ShieldCheck className="h-4 w-4" /> {checking ? 'Checking server…' : eligibilityError ? 'Retry server check' : 'Verify release eligibility'}
              </button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="text-sm font-semibold text-white">Approval chain</h2><p className="mt-0.5 text-[11px] text-slate-600">{approvalCount} of 2 complete</p></div>
                <UserRoundCheck className="h-4 w-4 text-violet-400" />
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Manager 1', name: paper.manager1, approved: paper.manager1Approved, time: paper.manager1ApprovedAt },
                  { label: 'Manager 2', name: paper.manager2, approved: paper.manager2Approved, time: paper.manager2ApprovedAt },
                ].map(manager => (
                  <div key={manager.label} className="flex gap-3 rounded-lg border border-border bg-surface-2/60 p-3">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${manager.approved ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400' : 'border-border-2 text-slate-600'}`}>
                      {manager.approved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    </div>
                    <div><p className="text-xs font-medium text-slate-300">{manager.name}</p><p className="mt-0.5 text-[10px] text-slate-600">{manager.label}{manager.time ? ` · ${manager.time}` : ' · Pending'}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/[0.06] text-amber-400"><CalendarClock className="h-3.5 w-3.5" /></div>
              <h2 className="text-sm font-semibold text-white">Access window</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">The document remains unavailable outside the configured window, even after both approvals are complete.</p>
              <div className="mt-4 flex items-center gap-2 font-mono text-[10px] text-slate-600"><Clock3 className="h-3 w-3" /> IST schedule · device countdown is informational</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function parseScheduledTime(date: string, time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return Number.NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) - 330 * 60 * 1000;
}

function formatCountdown(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [days, hours, minutes, remainder].map(value => String(value).padStart(2, '0')).join(':');
}
