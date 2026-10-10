import { Calendar, CheckCircle, Clock, FileText, ArrowRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { groupPapersByExam, utcToday } from '../services/exams';

interface Props { navigate: (page: string, extra?: string) => void; }

export default function ExamManagementPage({ navigate }: Props) {
  const { papers } = useApp();
  const exams = groupPapersByExam(papers);
  const today = utcToday();
  const upcoming = exams.filter(exam => exam.date >= today);
  const completed = exams.filter(exam => exam.date < today);

  return (
    <div className="space-y-5 overflow-y-auto p-6 h-full">
      <div>
        <h1 className="text-xl font-bold text-white">Examination Management</h1>
        <p className="mt-0.5 text-sm text-slate-500">{upcoming.length} scheduled · {completed.length} past · grouped from persisted paper records</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-white/[0.06] bg-[#0f1728] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Upcoming Examinations</h2>
          </div>
          <div className="space-y-3">
            {upcoming.map(exam => (
              <div key={exam.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4 transition-colors hover:border-white/[0.08]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div><div className="text-sm font-medium text-slate-200">{exam.name}</div><div className="mt-0.5 text-xs text-slate-500">{exam.course}</div></div>
                  <span className="flex-shrink-0 rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono text-blue-400">Scheduled</span>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  {[
                    ['Date', exam.date],
                    ['Start Time', exam.startTime],
                    ['Manager 1', exam.manager1],
                    ['Manager 2', exam.manager2],
                  ].map(([label, value]) => (
                    <div key={label}><div className="mb-0.5 text-[10px] uppercase tracking-wider text-slate-600">{label}</div><div className="text-xs text-slate-400">{value}</div></div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  {exam.papers.map(paper => (
                    <button key={paper.id} onClick={() => navigate('paper-details', paper.id)} className="group flex w-full items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-left transition-colors hover:border-white/[0.08]">
                      <span className="flex items-center gap-2 text-xs text-slate-400 transition-colors group-hover:text-slate-200"><FileText className="h-3.5 w-3.5 text-slate-600" />{paper.subject}</span>
                      <ArrowRight className="h-3 w-3 text-slate-700 transition-colors group-hover:text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {upcoming.length === 0 && <Empty message="No scheduled examinations in persisted paper records." />}
          </div>
        </section>

        <section className="rounded-xl border border-white/[0.06] bg-[#0f1728] p-5">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">Past Examinations</h2>
          </div>
          <div className="space-y-3">
            {completed.map(exam => (
              <div key={exam.id} className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div><div className="text-sm font-medium text-slate-400">{exam.name}</div><div className="text-xs text-slate-600">{exam.course}</div></div>
                  <span className="flex-shrink-0 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-600">Past date</span>
                </div>
                <div className="mb-3 flex gap-4 text-xs">
                  <div><span className="text-slate-600">Date: </span><span className="font-mono text-slate-400">{exam.date}</span></div>
                  <div><span className="text-slate-600">Papers: </span><span className="text-slate-400">{exam.papers.length}</span></div>
                </div>
                {exam.papers.map(paper => (
                  <button key={paper.id} onClick={() => navigate('paper-details', paper.id)} className="flex w-full items-center justify-between border-t border-white/[0.04] py-2 text-left text-xs text-slate-500 hover:text-slate-200">
                    <span>{paper.subject} · {paper.id}</span><ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            ))}
            {completed.length === 0 && <Empty message="No past examinations in persisted paper records." />}
          </div>
        </section>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-600"><Calendar className="h-3 w-3" /> Examination groups are derived from paper records; no separate exam schedule is stored.</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="py-12 text-center text-xs text-slate-600">{message}</div>;
}
