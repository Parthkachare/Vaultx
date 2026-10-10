import { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileSearch, Search, ShieldCheck, TriangleAlert, XCircle } from 'lucide-react';
import { apiRequest, toQuery } from '../services/api';
import type { AuditEntry } from '../data/mockData';

const statusStyles: Record<AuditEntry['status'], string> = {
  Success: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400',
  Failed: 'border-red-500/20 bg-red-500/[0.07] text-red-400',
  Warning: 'border-amber-500/20 bg-amber-500/[0.07] text-amber-400',
};

export default function AuditLogsPage() {
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, warning: 0 });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'All' | AuditEntry['status']>('All');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const limit = 100;

  const loadRows = (requestedPage: number, requestedSearch: string, requestedFilter: string) =>
    apiRequest<{ logs: Record<string, unknown>[]; total: number; pages: number }>(
    `/audit/logs${toQuery({ page: requestedPage, limit, search: requestedSearch, status: requestedFilter === 'All' ? undefined : requestedFilter })}`,
    );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
    loadRows(page, search, filter),
    apiRequest<typeof stats>('/audit/logs/stats'),
    ]).then(([result, summary]) => {
    if (!active) return;
    setAuditLogs(result.logs.map(mapAudit));
    setTotal(result.total);
    setPages(Math.max(1, result.pages));
    setStats(summary);
    }).catch(requestError => {
    if (active) setError(requestError instanceof Error ? requestError.message : 'Could not load audit logs.');
    }).finally(() => {
    if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [page, search, filter]);

  const exportCSV = async () => {
    setError('');
    setLoading(true);
    try {
    const first = await loadRows(1, search, filter);
    const otherPages = await Promise.all(
      Array.from({ length: Math.max(0, first.pages - 1) }, (_, index) => loadRows(index + 2, search, filter)),
    );
    const exportRows = [first, ...otherPages].flatMap(result => result.logs.map(mapAudit));
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = ['Time', 'User', 'Role', 'Action', 'Paper', 'IP', 'Device', 'Status'];
    const rows = exportRows.map(log => [
      log.time, log.user, log.role, log.action, log.paperId ?? '', log.ip, log.device, log.status,
    ].map(escapeCell).join(','));
    const blob = new Blob([[header.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vaultx-audit-${Date.now()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    } catch (requestError) {
    setError(requestError instanceof Error ? requestError.message : 'Could not export audit logs.');
    } finally {
    setLoading(false);
    }
  };

  const filtered = auditLogs;

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Security record</p>
            <h1 className="text-xl font-semibold text-white">Audit logs</h1>
            <p className="mt-1 text-sm text-slate-500">{total} matching events · Traceable system actions, authentication events, and paper access.</p>
          </div>
          <button onClick={exportCSV} disabled={loading} className="flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/30 hover:text-violet-400 disabled:opacity-50">
            <Download className="h-3.5 w-3.5" /> Export {total} records
          </button>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric icon={FileSearch} label="Total events" value={stats.total} tone="violet" />
          <Metric icon={CheckCircle2} label="Successful" value={stats.success} tone="emerald" />
          <Metric icon={XCircle} label="Failed" value={stats.failed} tone="red" />
          <Metric icon={TriangleAlert} label="Warnings" value={stats.warning} tone="amber" />
        </div>

        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            <input
              type="search"
              placeholder="Search user, action, paper ID, or IP..."
              value={search}
              onChange={event => { setSearch(event.target.value); setPage(1); }}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-300 outline-none placeholder:text-slate-600"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg bg-surface-2 p-1">
            {(['All', 'Success', 'Failed', 'Warning'] as const).map(item => (
              <button
                key={item}
                onClick={() => { setFilter(item); setPage(1); }}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === item ? 'bg-violet-dim text-violet-400' : 'text-slate-600 hover:text-slate-300'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[920px] text-left">
              <thead className="border-b border-border bg-surface-2/50">
                <tr>
                  {['Timestamp', 'Actor', 'Action', 'Paper', 'Source', 'Result'].map(label => (
                    <th key={label} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-white/[0.015]">
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-slate-500">{log.time}</td>
                    <td className="whitespace-nowrap px-4 py-3.5">
                      <p className="text-xs font-medium text-slate-300">{log.user}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{log.role}</p>
                    </td>
                    <td className="max-w-sm px-4 py-3.5 text-xs leading-relaxed text-slate-300">{log.action}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-violet-400">{log.paperId ?? '—'}</td>
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-[11px] text-slate-500">{log.ip}</p>
                      <p className="mt-0.5 max-w-44 truncate text-[10px] text-slate-700">{log.device}</p>
                    </td>
                    <td className="px-4 py-3.5"><StatusPill status={log.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-border/60 lg:hidden">
            {filtered.map(log => (
              <article key={log.id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div><p className="text-xs font-medium text-slate-300">{log.user}</p><p className="mt-0.5 text-[10px] text-slate-600">{log.role} · {log.time}</p></div>
                  <StatusPill status={log.status} />
                </div>
                <p className="text-xs leading-relaxed text-slate-400">{log.action}</p>
                <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-slate-600">
                  <span>{log.paperId ?? 'No paper reference'}</span><span>{log.ip}</span>
                </div>
              </article>
            ))}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="px-4 py-16 text-center">
              <ShieldCheck className="mx-auto mb-3 h-7 w-7 text-slate-700" />
              <p className="text-sm font-medium text-slate-400">No matching audit events</p>
              <p className="mt-1 text-xs text-slate-600">Try a different search or status filter.</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{loading ? 'Loading audit records…' : `Page ${page} of ${pages}`}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button onClick={() => setPage(current => Math.min(pages, current + 1))} disabled={page >= pages || loading} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function mapAudit(log: Record<string, unknown>): AuditEntry {
  const date = new Date(String(log.timestamp ?? ""));
  return {
    id: String(log._id ?? ""),
    time: Number.isNaN(date.getTime()) ? String(log.timestamp ?? "") : date.toLocaleString(),
    user: String(log.userName || log.userEmail || "System"),
    role: String(log.role || "System"),
    action: String(log.action ?? ""),
    ip: String(log.ipAddress ?? ""),
    device: String(log.userAgent ?? ""),
    status: log.status as AuditEntry["status"],
    paperId: log.paperId ? String(log.paperId) : undefined,
  };
}

function StatusPill({ status }: { status: AuditEntry['status'] }) {
  return <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold ${statusStyles[status]}`}>{status}</span>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: 'violet' | 'emerald' | 'red' | 'amber' }) {
  const tones = {
    violet: 'bg-violet-dim text-violet-400 border-violet-500/15',
    emerald: 'bg-emerald-500/[0.07] text-emerald-400 border-emerald-500/15',
    red: 'bg-red-500/[0.07] text-red-400 border-red-500/15',
    amber: 'bg-amber-500/[0.07] text-amber-400 border-amber-500/15',
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg border ${tones[tone]}`}><Icon className="h-3.5 w-3.5" /></div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{label}</p>
    </div>
  );
}
