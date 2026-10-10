import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle, Database, Lock, Shield } from 'lucide-react';
import { apiRequest, type ApiPaper } from '../services/api';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; notice?: string; }

export default function EncryptionProcessPage({ navigate, paperId, notice = '' }: Props) {
  const [paper, setPaper] = useState<ApiPaper>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest<ApiPaper>(`/papers/${encodeURIComponent(paperId)}`)
      .then(result => { if (active) setPaper(result); })
      .catch(requestError => {
        if (active) setError(requestError instanceof Error ? requestError.message : 'Could not verify the uploaded paper.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paperId]);

  return (
    <div className="flex h-full min-h-full items-center justify-center overflow-y-auto p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${paper ? 'border-emerald-500/30 bg-emerald-500/20' : error ? 'border-red-500/30 bg-red-500/10' : 'border-blue-500/30 bg-blue-500/20'}`}>
            {paper ? <Lock className="h-8 w-8 text-emerald-400" /> : error ? <AlertTriangle className="h-8 w-8 text-red-400" /> : <Shield className="h-8 w-8 animate-pulse text-blue-400" />}
          </div>
          <h1 className="mb-1 text-xl font-bold text-white">{paper ? 'Encryption Complete' : error ? 'Upload Verification Failed' : 'Verifying Encrypted Upload'}</h1>
          <p className="text-sm text-slate-500">
            {paper ? 'The server confirms this PDF was encrypted and persisted.' : error ? 'The server could not confirm the uploaded paper.' : 'Checking the persisted paper record with the VaultX server…'}
          </p>
          {paper && <p className="mt-2 text-xs font-mono text-slate-600">{paper.subject} · {paper.paperId}</p>}
        </div>

        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
        {notice && <div role="alert" className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">{notice}</div>}
        {paper && (
          <>
            <div className="mb-6 rounded-xl border border-white/[0.06] bg-[#0f1728] p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs text-slate-500">Encryption ID</span>
                <Database className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div className="rounded-lg border border-blue-500/10 bg-blue-500/5 px-4 py-3 font-mono text-sm text-blue-400">{paper.encryptionId ?? 'Not supplied by server'}</div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <p className="text-slate-500">Status <span className="ml-1 text-slate-200">{paper.status}</span></p>
                <p className="text-slate-500">Encrypted size <span className="ml-1 text-slate-200">{paper.fileSizeBytes?.toLocaleString() ?? '—'} bytes</span></p>
              </div>
            </div>
            <div className="mb-6 flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">Encrypted paper record verified</p>
                <p className="mt-1 text-xs text-emerald-600">Encryption and persistence occurred on the server during upload; this screen verifies the resulting record and does not simulate progress.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate('vault')} className="flex-1 rounded-lg border border-white/[0.08] py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-200">View Vault</button>
              <button onClick={() => navigate('paper-details', paper.paperId)} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-400">
                Paper Details <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
        {!loading && error && <button onClick={() => navigate('upload')} className="w-full rounded-lg border border-white/[0.08] py-2.5 text-sm text-slate-300 hover:bg-white/[0.04]">Back to Upload</button>}
      </div>
    </div>
  );
}
