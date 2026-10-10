import type { PaperStatus } from '../data/mockData';

interface Config {
  label: string;
  bg: string;
  color: string;
  border: string;
  dot?: string;
}

const configs: Record<PaperStatus, Config> = {
  LOCKED:            { label: 'Locked',           bg: 'rgba(239,68,68,0.1)',   color: '#f87171', border: 'rgba(239,68,68,0.2)',   dot: '#f87171' },
  AWAITING_APPROVAL: { label: 'Awaiting Approval', bg: 'rgba(251,191,36,0.1)',  color: '#fbbf24', border: 'rgba(251,191,36,0.2)',  dot: '#fbbf24' },
  APPROVED:          { label: 'Approved',          bg: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: 'rgba(139,92,246,0.25)', dot: '#a78bfa' },
  READY_TO_UNLOCK:   { label: 'Ready',             bg: 'rgba(56,189,248,0.1)',  color: '#38bdf8', border: 'rgba(56,189,248,0.2)',  dot: '#38bdf8' },
  UNLOCKED:          { label: 'Unlocked',          bg: 'rgba(52,211,153,0.1)',  color: '#34d399', border: 'rgba(52,211,153,0.2)',  dot: '#34d399' },
  EXPIRED:           { label: 'Expired',           bg: 'transparent',           color: '#555570', border: 'rgba(255,255,255,0.08)', dot: '#555570' },
};

export default function StatusBadge({ status }: { status: PaperStatus }) {
  const c = configs[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium"
      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
    >
      {c.dot && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot }} />}
      {c.label}
    </span>
  );
}
