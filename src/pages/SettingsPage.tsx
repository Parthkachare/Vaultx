import { useEffect, useState } from 'react';
import { User, Shield, Key, Bell, Monitor, LogOut, CheckCircle, Eye, EyeOff } from 'lucide-react';
import type { AuthUser } from '../services/auth';
import { apiRequest } from '../services/api';

const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-200 placeholder:text-slate-600 text-sm outline-none focus:border-blue-500/50 transition-colors";
const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'password', label: 'Password', icon: Key },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'sessions', label: 'Sessions', icon: Monitor },
];

interface StoredSession {
  id: string;
  userAgent: string;
  ipAddress: string;
  expiresAt: string;
  createdAt: string;
  current: boolean;
}

interface Props {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
}

export default function SettingsPage({ user, onUserUpdated }: Props) {
  const [activeTab, setActiveTab] = useState('profile');
  const [securityPrefs, setSecurityPrefs] = useState<Record<string, boolean>>({
    ...(user.preferences ?? {}),
    loginAlerts: user.preferences?.loginAlerts ?? true,
  });
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    email: true,
    sms: false,
    approval: true,
    security: true,
    exam: false,
    ...(user.notificationPreferences ?? {}),
  });
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: user.name,
    email: user.email,
    department: user.department ?? '',
    phone: user.phone ?? '',
  });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwSaved, setPwSaved] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSessions = async () => {
    setSessionsLoading(true);
    try {
      const currentSessions = await apiRequest<StoredSession[]>('/auth/sessions');
      setSessions(currentSessions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load active sessions.');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') void loadSessions();
  }, [activeTab]);

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    try {
      const result = await apiRequest<{ user: AuthUser }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profile),
      });
      onUserUpdated(result.user);
      setProfileSaved(true);
      window.setTimeout(() => setProfileSaved(false), 2500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async (nextSecurity: Record<string, boolean>, nextNotifications: Record<string, boolean>) => {
    setError('');
    setSaving(true);
    try {
      const result = await apiRequest<{ user: AuthUser }>('/auth/preferences', {
        method: 'PUT',
        body: JSON.stringify({ preferences: nextSecurity, notificationPreferences: nextNotifications }),
      });
      setSecurityPrefs(result.user.preferences ?? nextSecurity);
      setNotifs(result.user.notificationPreferences ?? nextNotifications);
      onUserUpdated(result.user);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key: string) => {
    const next = { ...notifs, [key]: !notifs[key] };
    void savePreferences(securityPrefs, next);
  };

  const toggleLoginAlertPreference = () => {
    const next = { ...securityPrefs, loginAlerts: !securityPrefs.loginAlerts };
    void savePreferences(next, notifs);
  };

  const savePassword = async () => {
    setError('');
    if (newPassword.length < 12) {
      setError('New password must contain at least 12 characters.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError('New password must include uppercase letters, numbers, and symbols.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new password and confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwSaved(true);
      window.setTimeout(() => setPwSaved(false), 2500);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update password.');
    } finally {
      setSaving(false);
    }
  };

  const revokeSession = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadSessions();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not revoke session.');
    }
  };

  const revokeOtherSessions = async () => {
    setError('');
    try {
      await apiRequest('/auth/sessions/revoke-others', { method: 'POST' });
      await loadSessions();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not revoke other sessions.');
    }
  };

  const notificationLabels: Record<string, [string, string]> = {
    email: ['Email Notifications', 'Preference is saved; general notification email delivery is not configured.'],
    sms: ['SMS Alerts', 'Preference is saved; SMS delivery is not configured.'],
    approval: ['Approval Requests', 'Stored preference only; it does not suppress server-created in-app notices.'],
    security: ['Security Alerts', 'Stored preference only; it does not suppress server-created in-app notices.'],
    exam: ['Exam Reminders', 'Stored preference only; exam reminders are not currently generated.'],
  };

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account and security preferences</p>
      </div>
      {error && <p role="alert" className="mb-4 text-xs text-red-400">{error}</p>}
      <div className="flex gap-5 flex-col lg:flex-row">
        <div className="lg:w-44 flex-shrink-0">
          <div className="space-y-0.5">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === tab.id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'}`}>
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-5">
          {activeTab === 'profile' && (
            <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">Profile Information</h2>
              <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-2xl font-bold text-blue-300">{user.name.charAt(0)}</div>
                <div><div className="text-sm font-semibold text-white">{user.name}</div><div className="text-xs text-slate-500">{user.role}</div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name"><input className={inputClass} value={profile.name} onChange={event => setProfile(value => ({ ...value, name: event.target.value }))} /></Field>
                <Field label="Email"><input type="email" className={inputClass} value={profile.email} onChange={event => setProfile(value => ({ ...value, email: event.target.value }))} /></Field>
                <Field label="Department"><input className={inputClass} value={profile.department} onChange={event => setProfile(value => ({ ...value, department: event.target.value }))} /></Field>
                <Field label="Phone"><input type="tel" className={inputClass} value={profile.phone} onChange={event => setProfile(value => ({ ...value, phone: event.target.value }))} /></Field>
              </div>
              <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {profileSaved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">Security Settings</h2>
              <SettingToggle label="Multi-Factor Authentication (OTP)" desc="Required for all sign-ins by platform policy; cannot be disabled." value disabled />
              <SettingToggle label="Login Alert Preference" desc="Saved preference only; alert delivery settings are not yet enforced." value={securityPrefs.loginAlerts} onClick={toggleLoginAlertPreference} disabled={saving} />
              <SettingToggle label="Session Timeout" desc="Automatic idle timeout is not implemented yet." value={false} disabled />
              <SettingToggle label="IP Restriction" desc="Network allow-list enforcement is not implemented yet." value={false} disabled />
            </div>
          )}

          {activeTab === 'password' && (
            <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">Change Password</h2>
              <div>
                <label className={labelClass}>Current Password</label>
                <div className="relative">
                  <input type={showCurrentPw ? 'text' : 'password'} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} placeholder="Enter current password" className={`${inputClass} pr-10`} />
                  <button type="button" onClick={() => setShowCurrentPw(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Field label="New Password"><input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} placeholder="Min 12 chars, include uppercase, numbers & symbols" className={inputClass} /></Field>
              <Field label="Confirm New Password"><input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Repeat new password" className={inputClass} /></Field>
              <p className="text-xs text-slate-600">Password must be at least 12 characters and include uppercase letters, numbers, and symbols.</p>
              <button onClick={savePassword} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                {pwSaved ? <><CheckCircle className="w-4 h-4" /> Updated!</> : saving ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">Notification Preferences</h2>
              <p className="text-xs text-slate-500">Preferences are stored on your account. Email/SMS delivery is not configured; in-app notices are persisted.</p>
              {Object.keys(notificationLabels).map(key => {
                const [label, desc] = notificationLabels[key];
                return <SettingToggle key={key} label={label} desc={desc} value={Boolean(notifs[key])} onClick={() => toggleNotification(key)} disabled={saving} />;
              })}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] p-6 space-y-4">
              <h2 className="text-sm font-semibold text-white">Active Sessions</h2>
              {sessionsLoading && <p className="text-xs text-slate-500">Loading sessions…</p>}
              {!sessionsLoading && sessions.length === 0 && <p className="text-xs text-slate-500">No active sessions were returned by the server.</p>}
              <div className="space-y-3">
                {sessions.map(session => (
                  <div key={session.id} className={`flex items-center gap-4 p-4 rounded-xl border ${session.current ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/[0.02] border-white/[0.04]'}`}>
                    <Monitor className={`w-5 h-5 flex-shrink-0 ${session.current ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-200 truncate">{session.userAgent || 'Unknown device'}</span>
                        {session.current && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Current</span>}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">{session.ipAddress || 'Unknown IP'} · Expires {new Date(session.expiresAt).toLocaleString()}</div>
                    </div>
                    {!session.current && (
                      <button onClick={() => revokeSession(session.id)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                        <LogOut className="w-3.5 h-3.5" /> Revoke
                      </button>
                    )}
                  </div>
                ))}
                {sessions.some(session => !session.current) && (
                  <button onClick={revokeOtherSessions} className="text-xs text-red-400 hover:text-red-300 transition-colors">Revoke all other sessions</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelClass}>{label}</label>{children}</div>;
}

function SettingToggle({ label, desc, value, onClick, disabled = false }: { label: string; desc: string; value: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
      <div><div className="text-sm font-medium text-slate-200">{label}</div><div className="text-xs text-slate-500 mt-0.5">{desc}</div></div>
      <button type="button" role="switch" aria-checked={value} aria-label={label} onClick={onClick} disabled={disabled || !onClick} className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${value ? 'bg-blue-500' : 'bg-white/[0.10]'}`}>
        <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: value ? '22px' : '2px' }} />
      </button>
    </div>
  );
}
