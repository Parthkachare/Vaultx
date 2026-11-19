import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  FileText,
  ShieldCheck,
  Upload,
  UserRoundCheck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/api';

interface Props { navigate: (page: string, extra?: string, notice?: string) => void; userName: string; userRole: string; }

type FormState = {
  examName: string;
  subject: string;
  course: string;
  examDate: string;
  startTime: string;
  unlockTime: string;
  expiryTime: string;
  manager1: string;
  manager2: string;
};

const EMPTY_FORM: FormState = {
  examName: '',
  subject: '',
  course: '',
  examDate: '',
  startTime: '',
  unlockTime: '',
  expiryTime: '',
  manager1: '',
  manager2: '',
};

const fieldClass = 'w-full rounded-lg border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/10';
const labelClass = 'mb-1.5 block text-xs font-medium text-slate-400';
const panelClass = 'rounded-xl border border-border bg-surface p-5';

export default function UploadPaperPage({ navigate, userName, userRole }: Props) {
  const { users, refreshData } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const manager1Users = useMemo(
    () => users.filter(user => user.status === 'Active' && user.role === 'Manager 1'),
    [users],
  );
  const manager2Users = useMemo(
    () => users.filter(user => user.status === 'Active' && user.role === 'Manager 2'),
    [users],
  );

  const set = (key: keyof FormState, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
    setErrors(current => ({ ...current, [key]: '' }));
  };

  const acceptFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (nextFile.type !== 'application/pdf') {
      setFile(null);
      setErrors(current => ({ ...current, file: 'Select a PDF document.' }));
      return;
    }
    if (nextFile.size > 50 * 1024 * 1024) {
      setFile(null);
      setErrors(current => ({ ...current, file: 'The PDF must be smaller than 50 MB.' }));
      return;
    }
    setFile(nextFile);
    setErrors(current => ({ ...current, file: '' }));
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    acceptFile(event.dataTransfer.files[0]);
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    Object.entries(form).forEach(([key, value]) => {
      if (!value.trim()) nextErrors[key] = 'Required';
    });
    if (!file) nextErrors.file = 'Add the question paper PDF.';
    if (form.manager1 && form.manager1 === form.manager2) {
      nextErrors.manager2 = 'Choose a different second approver.';
    }
    if (form.unlockTime && form.startTime && form.unlockTime > form.startTime) {
      nextErrors.unlockTime = 'Unlock time must be at or before the exam start.';
    }
    if (form.expiryTime && form.startTime && form.expiryTime <= form.startTime) {
      nextErrors.expiryTime = 'Expiry must be after the exam start.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const review = () => {
    if (validate()) setStep('confirm');
  };

  const handleEncryptAndUpload = async () => {
    if (!validate() || !file) {
      setStep('form');
      return;
    }
    setSubmitting(true);
    setErrors(current => ({ ...current, submit: '' }));
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('examName', form.examName);
      body.append('subject', form.subject);
      body.append('course', form.course);
      body.append('examDate', form.examDate);
      body.append('examStartTime', form.startTime);
      body.append('unlockTime', form.unlockTime);
      body.append('expiryTime', form.expiryTime);
      body.append('manager1Id', form.manager1);
      body.append('manager2Id', form.manager2);
      const result = await apiRequest<{ paperId: string; warnings?: string[] }>('/papers', { method: 'POST', body });
      navigate('encryption', result.paperId, result.warnings?.join(' ') ?? '');
      await refreshData(userRole).catch(() => undefined);
    } catch (error) {
      setErrors(current => ({ ...current, submit: error instanceof Error ? error.message : 'Paper upload failed.' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'confirm') {
    const selectedManager1 = manager1Users.find(manager => manager.id === form.manager1)?.name ?? '';
    const selectedManager2 = users.find(manager => manager.id === form.manager2)?.name ?? '';
    const reviewRows = [
      ['Examination', form.examName],
      ['Subject', `${form.subject} · ${form.course}`],
      ['Schedule (IST)', `${form.examDate} · ${form.startTime}`],
      ['Access window (IST)', `${form.unlockTime} – ${form.expiryTime}`],
      ['Document', `${file?.name} · ${file ? formatBytes(file.size) : ''}`],
      ['Manager 1', selectedManager1],
      ['Manager 2', selectedManager2],
    ];

    return (
      <div className="h-full overflow-y-auto p-5 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => setStep('form')} className="mb-5 flex items-center gap-2 text-xs font-medium text-slate-500 transition-colors hover:text-violet-400">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to form
          </button>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Final review</p>
              <h1 className="text-xl font-semibold text-white">Confirm secure upload</h1>
              <p className="mt-1 text-sm text-slate-500">Verify the schedule and approval chain before encryption begins.</p>
            </div>
            <div className="hidden h-11 w-11 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-dim text-violet-400 sm:flex">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-amber-300">Security policy will be applied</p>
                <p className="mt-1 text-xs leading-relaxed text-amber-400/70">The document enters the existing AES-256-GCM encryption flow. Access still requires two independent approvals and the configured time window.</p>
              </div>
            </div>
          </div>

          <div className={`${panelClass} mb-4 overflow-hidden p-0`}>
            {reviewRows.map(([label, value], index) => (
              <div key={label} className={`flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${index ? 'border-t border-border/70' : ''}`}>
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-sm font-medium text-slate-200 sm:text-right">{value}</span>
              </div>
            ))}
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Encrypted at rest', 'AES-256-GCM'],
              ['Approval rule', '2 of 2 managers'],
              ['Access policy', 'Server-time window'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-600"><Check className="h-3 w-3 text-emerald-400" /> {label}</div>
                <div className="text-xs font-medium text-slate-300">{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={() => setStep('form')} className="rounded-lg border border-border px-5 py-2.5 text-sm text-slate-400 transition-colors hover:border-border-2 hover:text-slate-200">Edit details</button>
            {errors.submit && <p role="alert" className="text-sm text-red-400">{errors.submit}</p>}
            <button onClick={handleEncryptAndUpload} disabled={submitting} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50">
              <ShieldCheck className="h-4 w-4" /> {submitting ? 'Encrypting & uploading…' : 'Encrypt & upload'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-5 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-400">Secure intake</p>
            <h1 className="text-xl font-semibold text-white">Upload question paper</h1>
            <p className="mt-1 text-sm text-slate-500">Configure the exam window and two-person approval chain.</p>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-400 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Encryption policy active
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <section className={panelClass}>
              <SectionTitle icon={FileText} title="Examination details" subtitle="Identify the paper in the secure vault." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Exam name" error={errors.examName} wide><input className={fieldClass} placeholder="Final Semester Examination" value={form.examName} onChange={event => set('examName', event.target.value)} /></Field>
                <Field label="Subject" error={errors.subject}><input className={fieldClass} placeholder="Advanced Cryptography" value={form.subject} onChange={event => set('subject', event.target.value)} /></Field>
                <Field label="Course / class" error={errors.course}><input className={fieldClass} placeholder="M.Sc Computer Science" value={form.course} onChange={event => set('course', event.target.value)} /></Field>
              </div>
            </section>

            <section className={panelClass}>
              <SectionTitle icon={CalendarClock} title="Time-lock schedule (IST)" subtitle="Enter all dates and times in India Standard Time (UTC+05:30)." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Exam date (IST)" error={errors.examDate}><input type="date" className={fieldClass} value={form.examDate} onChange={event => set('examDate', event.target.value)} /></Field>
                <Field label="Exam start (IST)" error={errors.startTime}><input type="time" className={fieldClass} value={form.startTime} onChange={event => set('startTime', event.target.value)} /></Field>
                <Field label="Unlock time (IST)" error={errors.unlockTime}><input type="time" className={fieldClass} value={form.unlockTime} onChange={event => set('unlockTime', event.target.value)} /></Field>
                <Field label="Access expiry (IST)" error={errors.expiryTime}><input type="time" className={fieldClass} value={form.expiryTime} onChange={event => set('expiryTime', event.target.value)} /></Field>
              </div>
            </section>

            <section className={panelClass}>
              <SectionTitle icon={Upload} title="Question paper PDF" subtitle="PDF only, up to 50 MB." />
              <div
                onDrop={handleDrop}
                onDragOver={event => event.preventDefault()}
                className={`rounded-xl border border-dashed p-7 text-center transition-colors ${errors.file ? 'border-red-500/40 bg-red-500/[0.04]' : file ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-border-2 bg-surface-2/60 hover:border-violet-500/40'}`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-dim text-violet-400"><FileText className="h-5 w-5" /></div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-200">{file.name}</p>
                      <p className="text-xs text-slate-500">{formatBytes(file.size)} · PDF ready for validation</p>
                    </div>
                    <button onClick={() => setFile(null)} className="ml-2 rounded-md p-1.5 text-slate-600 transition-colors hover:bg-white/[0.05] hover:text-slate-300" aria-label="Remove file"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-slate-500"><Upload className="h-4 w-4" /></div>
                    <p className="text-sm font-medium text-slate-300">Drop a PDF here</p>
                    <p className="mt-1 text-xs text-slate-600">or choose a file from your device</p>
                    <button onClick={() => inputRef.current?.click()} className="mt-4 rounded-lg border border-border-2 bg-surface px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-violet-500/30 hover:text-violet-400">Browse files</button>
                    <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => acceptFile(event.target.files?.[0])} />
                  </>
                )}
              </div>
              {errors.file && <p className="mt-2 text-xs text-red-400">{errors.file}</p>}
            </section>

            <section className={panelClass}>
              <SectionTitle icon={UserRoundCheck} title="Authorized approvers" subtitle="The two assigned managers must approve independently." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Manager 1" error={errors.manager1}>
                  <select className={fieldClass} value={form.manager1} onChange={event => set('manager1', event.target.value)}>
                    <option value="">Select Manager 1</option>
                    {manager1Users.map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                  </select>
                </Field>
                <Field label="Manager 2" error={errors.manager2}>
                  <select className={fieldClass} value={form.manager2} onChange={event => set('manager2', event.target.value)}>
                    <option value="">Select Manager 2</option>
                    {manager2Users.filter(manager => manager.role === 'Manager 2').map(manager => <option key={manager.id} value={manager.id}>{manager.name}</option>)}
                  </select>
                </Field>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-3 pb-4 sm:flex-row sm:justify-end">
              {errors.submit && <p role="alert" className="text-sm text-red-400">{errors.submit}</p>}
              <button onClick={() => navigate('dashboard')} className="rounded-lg border border-border px-5 py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-200">Cancel</button>
              <button onClick={review} className="flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
                Review security setup <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-violet-500/15 bg-violet-dim/50 p-5 lg:sticky lg:top-0">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-400"><ShieldCheck className="h-4 w-4" /></div>
            <h2 className="text-sm font-semibold text-white">Security summary</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">VaultX protects the paper throughout its approval and release lifecycle.</p>
            <div className="mt-5 space-y-4">
              {[
                ['Encrypted immediately', 'AES-256-GCM protection is applied in the existing encryption flow.'],
                ['Dual authorization', 'One approval alone can never release the paper.'],
                ['Time-bound access', 'Eligibility is checked again when the paper is opened.'],
                ['Full audit trail', 'Upload, approval, and access actions are recorded.'],
              ].map(([title, copy]) => (
                <div key={title} className="flex gap-2.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div><p className="text-xs font-medium text-slate-300">{title}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">{copy}</p></div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, wide = false, children }: { label: string; error?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={wide ? 'sm:col-span-2' : ''}>
      <span className={labelClass}>{label}</span>
      {children}
      {error && <span className="mt-1 block text-[11px] text-red-400">{error}</span>}
    </label>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
  return (
    <div className="mb-5 flex items-start gap-3 border-b border-border/70 pb-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-dim text-violet-400"><Icon className="h-4 w-4" /></div>
      <div><h2 className="text-sm font-semibold text-slate-100">{title}</h2><p className="mt-0.5 text-xs text-slate-600">{subtitle}</p></div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
