import { ArrowRight, CheckCircle, Clock, FileText, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface Props {
  navigate: (page: string, extra?: string) => void;
  role: string;
  userId: string;
  userName: string;
}

export default function ManagerDashboard({ navigate, role, userId, userName }: Props) {
  const { papers, notifications } = useApp();
  const assignedPapers = papers.filter(paper => role === 'Manager 1' ? paper.manager1Id === userId : paper.manager2Id === userId);
  const pending = assignedPapers.filter(paper => role === 'Manager 1' ? !paper.manager1Approved : !paper.manager2Approved);
  const approved = assignedPapers.length - pending.length;
  const unread = notifications.filter(notification => notification.unread).length;

  return (
    <div className="h-full space-y-5 overflow-y-auto p-5 text-slate-200">
      <header>
        <p className="text-xs text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <h1 className="mt-1 text-lg font-semibold text-white">Manager Dashboard</h1>
        <p className="text-xs text-slate-500">Approval work assigned to {userName}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={FileText} label="Assigned papers" value={assignedPapers.length} />
        <Metric icon={Clock} label="Awaiting your approval" value={pending.length} />
        <Metric icon={CheckCircle} label="Approved by you" value={approved} />
      </div>

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#0f1728]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <h2 className="text-sm font-medium text-white">Approval queue</h2>
          <button onClick={() => navigate('approvals')} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">All approvals <ArrowRight className="h-3 w-3" /></button>
        </div>
        {assignedPapers.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-slate-600">No papers are currently assigned to your account.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {assignedPapers.map(paper => {
              const isApproved = role === 'Manager 1' ? paper.manager1Approved : paper.manager2Approved;
              return (
                <button key={paper.id} onClick={() => navigate('dual-auth', paper.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.02]">
                  <ShieldCheck className={`h-4 w-4 flex-shrink-0 ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-200">{paper.subject}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-slate-600">{paper.id} · {paper.examDate}</span>
                  </span>
                  <span className={`text-[10px] ${isApproved ? 'text-emerald-400' : 'text-amber-400'}`}>{isApproved ? 'Approved' : 'Pending'}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('vault')} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:text-slate-200">View Vault</button>
        <button onClick={() => navigate('notifications')} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Notifications ({unread} unread)</button>
        <button onClick={() => navigate('settings')} className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-400 hover:text-slate-200">Account Settings</button>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0f1728] p-4">
      <Icon className="mb-3 h-5 w-5 text-violet-400" />
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
