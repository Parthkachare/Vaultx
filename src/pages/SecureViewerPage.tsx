import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Lock, Printer, Shield, ZoomIn, ZoomOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ApiRequestError, apiBlob, apiRequest } from '../services/api';

interface Props { navigate: (page: string, extra?: string) => void; paperId: string; userName: string; }

export default function SecureViewerPage({ navigate, paperId, userName }: Props) {
  const { papers } = useApp();
  const paper = papers.find(item => item.id === paperId);
  const [zoom, setZoom] = useState(100);
  const [pdfUrl, setPdfUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let objectUrl = '';
    let active = true;
    setLoading(true);
    setError('');
    setPdfUrl('');
    setPdfReady(false);
    apiBlob(`/papers/${encodeURIComponent(paperId)}/view`)
      .then(({ blob }) => {
        if (!active) return;
        if (blob.type !== 'application/pdf') throw new Error('The protected endpoint did not return a PDF.');
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch(requestError => {
        if (!active) return;
        const detail = requestError instanceof Error ? requestError.message : 'The protected paper could not be loaded.';
        if (requestError instanceof ApiRequestError) {
          const requestId = requestError.requestId ? ` Request ID: ${requestError.requestId}.` : '';
          setError(`Protected PDF request failed (HTTP ${requestError.status}): ${detail}.${requestId}`);
        } else {
          setError(detail);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paperId]);

  if (!paper) return null;

  const handlePrint = async () => {
    setError('');
    setPrinting(true);
    try {
      await apiRequest(`/papers/${encodeURIComponent(paperId)}/print`, { method: 'POST' });
      frameRef.current?.contentWindow?.print();
    } catch (printError) {
      setError(printError instanceof Error ? printError.message : 'Print request could not be authorized or recorded.');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#060b17]">
      <div className="flex h-12 flex-shrink-0 items-center gap-3 border-b border-white/[0.06] bg-[#0a0f1e] px-4">
        <button onClick={() => navigate('unlock', paperId)} aria-label="Back to release checks" className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-slate-300">Secure Viewer</span>
          <span className="font-mono text-[10px] text-slate-600">· {paper.id}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setZoom(value => Math.max(50, value - 10))} aria-label="Zoom out" className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/10"><ZoomOut className="h-3.5 w-3.5" /></button>
          <span className="w-10 text-center font-mono text-xs text-slate-500">{zoom}%</span>
          <button onClick={() => setZoom(value => Math.min(150, value + 10))} aria-label="Zoom in" className="rounded p-1.5 text-slate-400 transition-colors hover:bg-white/10"><ZoomIn className="h-3.5 w-3.5" /></button>
          <button onClick={handlePrint} disabled={!pdfReady || printing} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/[0.10] disabled:opacity-40">
            <Printer className="h-3.5 w-3.5" /> {printing ? 'Recording…' : 'Print PDF'}
          </button>
        </div>
      </div>

      <div className="flex h-8 flex-shrink-0 items-center justify-center gap-2 border-b border-emerald-500/20 bg-emerald-500/10">
        <Shield className="h-3 w-3 text-emerald-400" />
        <span className="text-[10px] font-mono text-emerald-400">PROTECTED VIEW · {userName} · {paper.id} · {new Date().toLocaleString()}</span>
      </div>

      {error ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div role="alert" className="max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
            <div className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Paper access denied</div>
            <p>{error}</p>
            <p className="mt-3 text-xs text-red-300/70">The server rechecks approvals, role, and the access window when serving the PDF.</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">Requesting protected PDF from VaultX…</div>
      ) : (
        <div className="relative flex-1 overflow-auto bg-slate-900 p-4 sm:p-6">
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
            <div className="select-none whitespace-nowrap font-bold tracking-widest text-slate-100/20" style={{ transform: 'rotate(-30deg)', fontSize: `${Math.max(16, zoom * 0.28)}px` }}>
              {userName} · {paper.id}
            </div>
          </div>
          <iframe
            ref={frameRef}
            title={`Protected PDF: ${paper.subject}`}
            src={pdfUrl}
            onLoad={() => setPdfReady(true)}
            className="relative z-0 mx-auto h-full min-h-[70vh] w-full rounded bg-white shadow-xl"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: `${10000 / zoom}%` }}
          />
          <p className="mx-auto mt-3 max-w-4xl text-center text-[10px] text-slate-500">
            The visible watermark is an on-screen overlay only; it does not watermark the PDF or prevent screenshots, copying, or redistribution. Printing uses the browser&apos;s built-in PDF print dialog and records a print request.
          </p>
        </div>
      )}
    </div>
  );
}
