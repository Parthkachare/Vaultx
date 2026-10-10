import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, ChevronLeft, Lock, Shield, Info } from 'lucide-react';
import * as authService from '../services/auth';
import type { AuthUser } from '../services/auth';

interface Props {
  onLogin: (user: AuthUser) => void;
  startupError?: string;
}

const S = {
  input: {
    width: '100%', padding: '10px 14px', borderRadius: '8px',
    background: '#191927', border: '1px solid #2a2a44',
    color: '#e2e2f0', outline: 'none', fontSize: '14px',
  } as React.CSSProperties,
  label: { display: 'block', fontSize: '12px', fontWeight: 500, color: '#6a6a8a', marginBottom: '6px' } as React.CSSProperties,
};

export default function LoginPage({ onLogin, startupError = '' }: Props) {
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const challenge = await authService.login(email, password);
      setPendingEmail(email.trim().toLowerCase());
      setGeneratedOtp(challenge._devOtp ?? '');
      setOtp(['', '', '', '', '', '']);
      setStep('otp');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await authService.verifyOtp(pendingEmail, otp.join(''));
      onLogin(user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'OTP verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSubmitting(true);
    try {
      const challenge = await authService.login(pendingEmail, password);
      setGeneratedOtp(challenge._devOtp ?? '');
      setOtp(['', '', '', '', '', '']);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not resend OTP.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
  };

  const handleOtpKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i - 1}`)?.focus();
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0b0b11' }}>

      {/* Left — solid branded panel */}
      <div className="hidden lg:flex flex-col w-[420px] flex-shrink-0 relative overflow-hidden" style={{ background: 'linear-gradient(160deg,#13112a 0%,#0d0d18 60%,#0b0b11 100%)' }}>
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#a78bfa 1px,transparent 1px),linear-gradient(90deg,#a78bfa 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Glows */}
        <div className="absolute top-32 left-10 w-64 h-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#7c3aed,transparent 70%)' }} />
        <div className="absolute bottom-20 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#a78bfa,transparent 70%)' }} />

        <div className="relative flex flex-col flex-1 p-10">
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-violet" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
              <Lock className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-xl tracking-tight">VaultX</p>
              <p className="text-[10px] font-mono tracking-widest" style={{ color: '#5a3a8a' }}>SECURE VAULT SYSTEM</p>
            </div>
          </div>

          <div className="mt-20 mb-12">
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Zero-trust paper security
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: '#7a7a9a' }}>
              AES-256-GCM encryption, dual-manager authorization, and server-enforced time locks — before any paper can be accessed.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: '🔐', text: 'AES-256-GCM encrypted at rest' },
              { icon: '✅', text: 'Dual manager approval required' },
              { icon: '⏱', text: 'Server-time locked access windows' },
              { icon: '📋', text: 'Immutable audit trail for every action' },
            ].map(f => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-base flex-shrink-0">{f.icon}</span>
                <span className="text-sm" style={{ color: '#6a6a8a' }}>{f.text}</span>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-10">
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl" style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.15)' }}>
              <Shield className="w-4 h-4 flex-shrink-0" style={{ color: '#34d399' }} />
              <span className="text-xs" style={{ color: '#34d399' }}>
                <span className="font-semibold">System Secure</span>
                <span className="ml-2" style={{ color: '#2a8a6a' }}>— TLS 1.3 + AES-256-GCM</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right — login panel, glass morphism card */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {step === 'login' ? (
            <>
              {/* Mobile logo */}
              <div className="flex items-center gap-2 mb-8 lg:hidden">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-white text-lg">VaultX</span>
              </div>

              <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
              <p className="text-sm mb-8" style={{ color: '#4a4a6a' }}>Sign in to access the secure vault.</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label style={S.label}>Email address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="you@institution.edu"
                    style={S.input}
                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor='#7c3aed'}
                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor='#2a2a44'}
                  />
                </div>
                <div>
                  <label style={S.label}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      style={{ ...S.input, paddingRight: '40px' }}
                      onFocus={e => (e.currentTarget as HTMLElement).style.borderColor='#7c3aed'}
                      onBlur={e => (e.currentTarget as HTMLElement).style.borderColor='#2a2a44'}
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#4a4a6a', background: 'none', border: 'none', cursor: 'pointer' }}>
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {(error || startupError) && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#f87171' }}>
                    {error || startupError}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white transition-all glow-violet"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', marginTop: '8px' }}
                  disabled={submitting}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.9'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}
                >
                  {submitting ? 'Signing in…' : 'Continue'} <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('login'); setError(''); setOtp(['','','','','','']); }}
                className="flex items-center gap-1.5 text-sm mb-8 transition-colors"
                style={{ color: '#4a4a6a', background: 'none', border: 'none', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#9898b8'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#4a4a6a'}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 glow-violet" style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}>
                <Shield className="w-6 h-6 text-white" />
              </div>

              <h1 className="text-2xl font-bold text-white mb-1">Verify identity</h1>
              <p className="text-sm mb-6" style={{ color: '#4a4a6a' }}>OTP for <span style={{ color: '#9898b8' }}>{pendingEmail}</span></p>

              {/* OTP display — glass card */}
              {generatedOtp && (
                <div className="mb-5 p-4 rounded-xl glass">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#a78bfa' }} />
                    <div>
                      <p style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, marginBottom: '4px' }}>Development OTP</p>
                      <p style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, letterSpacing: '8px', color: '#e2e2f0' }}>{generatedOtp}</p>
                      <p style={{ fontSize: '10px', color: '#4a4a6a', marginTop: '4px' }}>This development-only code is never returned in production.</p>
                    </div>
                  </div>
                </div>
              )}
              {!generatedOtp && <p className="mb-5 text-xs text-slate-500">Enter the one-time code sent to your registered email.</p>}

              <form onSubmit={handleOtp} className="space-y-5">
                <div className="flex gap-2 justify-between">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`otp-${i}`}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKey(i, e)}
                      style={{
                        width: '48px', height: '52px', borderRadius: '10px',
                        background: '#191927', border: `1px solid ${digit ? '#7c3aed' : '#2a2a44'}`,
                        textAlign: 'center', fontSize: '20px', fontFamily: 'monospace',
                        fontWeight: 700, color: '#e2e2f0', outline: 'none',
                      }}
                      onFocus={e => (e.currentTarget as HTMLElement).style.borderColor='#7c3aed'}
                      onBlur={e => (e.currentTarget as HTMLElement).style.borderColor=digit ? '#7c3aed' : '#2a2a44'}
                    />
                  ))}
                </div>

                {error && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: '13px', color: '#f87171' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm text-white glow-violet"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)' }}
                >
                  {submitting ? 'Verifying…' : 'Verify & Sign in'} <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={submitting}
                  className="w-full text-xs py-1 transition-colors"
                  style={{ color: '#3a3a58', background: 'none', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color='#6a6a8a'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color='#3a3a58'}
                >
                  Resend OTP
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
