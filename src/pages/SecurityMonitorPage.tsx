import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Filter,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/api';
import type { SecurityAlert } from '../data/mockData';

type AlertFilter = 'Active' | 'Resolved' | 'All';

const severityStyle: Record<SecurityAlert['severity'], string> = {
  Critical: 'border-red-500/25 bg-red-500/[0.08] text-red-400',
  High: 'border-red-500/20 bg-red-500/[0.06] text-red-400',
  Medium: 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400',
  Low: 'border-sky-500/20 bg-sky-500/[0.06] text-sky-400',
};

export default function SecurityMonitorPage() {
  const { securityAlerts, auditLogs, refreshData, dispatch } = useApp();
  const [filter, setFilter] = useState<AlertFilter>('Active');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [resolving, setResolving] = useState<string | null>(null);

  const active = securityAlerts.filter(alert => !alert.resolved);
  const resolved = securityAlerts.filter(alert => alert.resolved);
  const failedAuthEvents = auditLogs.filter(log => log.status === 'Failed' && /login|otp|auth/i.test(log.action)).length;
  const accessDenials = auditLogs.filter(log => log.status === 'Failed' && /access|unlock|vault/i.test(log.action)).length;

  const visibleAlerts = useMemo(() => securityAlerts.filter(alert => {
    const matchesFilter = filter === 'All' || (filter === 'Active' ? !alert.resolved : alert.resolved);
    const query = search.toLowerCase();
    return matchesFilter && `${alert.type} ${alert.message} ${alert.severity}`.toLowerCase().includes(query);
  }), [filter, search, securityAlerts]);

  const handleResolve = async (alertId: string) => {
    setError('');
    setResolving(alertId);
    try {
      await apiRequest(`/audit/security-events/${encodeURIComponent(alertId)}/resolve`, { method: 'PATCH' });
      dispatch({ type: 'RESOLVE_ALERT', alertId });
      try {
        await refreshData('Admin');
      } catch (refreshError) {
        setError(`Event was resolved, but the alert list could not refresh: ${refreshError instanceof Error ? refreshError.message : 'refresh failed.'}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resolve the security event.');
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Threat visibility</p>
            <h1 className="text-xl font-semibold text-white">Security monitor</h1>
            <p className="mt-1 text-sm text-slate-500">Review detected events and resolve alerts from the recorded security stream.</p>
          </div>
          <div className={`flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs sm:self-auto ${active.length ? 'border-amber-500/20 bg-amber-500/[0.06] text-amber-400' : 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400'}`}>
            {active.length ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {active.length ? `${active.length} alert${active.length === 1 ? '' : 's'} require review` : 'No active alerts'}
          </div>
        </header>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={ShieldAlert} label="Active alerts" value={active.length} tone={active.length ? 'red' : 'slate'} />
          <Metric icon={AlertTriangle} label="Critical / high" value={active.filter(alert => alert.severity === 'Critical' || alert.severity === 'High').length} tone="amber" />
          <Metric icon={KeyRound} label="Failed authentication" value={failedAuthEvents} tone="violet" />
          <Metric icon={X} label="Access denials" value={accessDenials} tone="slate" />
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
                  <Search className="h-3.5 w-3.5 text-slate-600" />
                  <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search security events..." className="min-w-0 flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600" />
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1">
                  <Filter className="mx-2 h-3.5 w-3.5 text-slate-600" />
                  {(['Active', 'Resolved', 'All'] as const).map(item => (
                    <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === item ? 'bg-violet-dim text-violet-400' : 'text-slate-600 hover:text-slate-300'}`}>{item}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {visibleAlerts.map(alert => (
                <article key={alert.id} className="p-4 transition-colors hover:bg-white/[0.012] sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${severityStyle[alert.severity]}`}>
                      {alert.resolved ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-200">{alert.type}</h2>
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${severityStyle[alert.severity]}`}>{alert.severity}</span>
                        {alert.resolved && <span className="rounded border border-emerald-500/15 bg-emerald-500/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Resolved</span>}
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{alert.message}</p>
                      <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-slate-600"><Clock3 className="h-3 w-3" /> {alert.time}</p>
                    </div>
                    {!alert.resolved && (
                      <button onClick={() => handleResolve(alert.id)} disabled={resolving === alert.id} title="Mark as resolved" className="shrink-0 rounded-lg border border-border bg-surface-2 p-2 text-slate-500 transition-colors hover:border-emerald-500/20 hover:text-emerald-400 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {visibleAlerts.length === 0 && (
                <div className="px-5 py-16 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-emerald-500/50" />
                  <p className="text-sm font-medium text-slate-400">No matching security alerts</p>
                  <p className="mt-1 text-xs text-slate-600">There are no events in this view.</p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><h2 className="text-sm font-semibold text-white">Alert distribution</h2><p className="mt-0.5 text-[11px] text-slate-600">Recorded events by severity</p></div>
                <span className="font-mono text-xs text-slate-500">{securityAlerts.length} total</span>
              </div>
              <div className="space-y-3">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map(severity => {
                  const count = securityAlerts.filter(alert => alert.severity === severity).length;
                  return (
                    <div key={severity} className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${severity === 'Critical' || severity === 'High' ? 'bg-red-400' : severity === 'Medium' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                      <span className="flex-1 text-xs text-slate-500">{severity}</span>
                      <span className="font-mono text-xs text-slate-300">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-5">
              <h2 className="text-sm font-semibold text-white">Resolution status</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-red-500/15 bg-red-500/[0.05] p-3"><p className="text-xl font-semibold text-red-400">{active.length}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">Open</p></div>
                <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/[0.05] p-3"><p className="text-xl font-semibold text-emerald-400">{resolved.length}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-slate-600">Resolved</p></div>
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-slate-600">Metrics reflect stored alert and audit records only. No inferred security score is displayed.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: 'red' | 'amber' | 'violet' | 'slate' }) {
  const tones = {
    red: 'border-red-500/15 bg-red-500/[0.06] text-red-400',
    amber: 'border-amber-500/15 bg-amber-500/[0.06] text-amber-400',
    violet: 'border-violet-500/15 bg-violet-dim text-violet-400',
    slate: 'border-border bg-surface-2 text-slate-500',
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{label}</p>
    </div>
  );
}
