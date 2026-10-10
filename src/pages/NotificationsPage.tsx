import { useState } from 'react';
import { Shield, Upload, AlertTriangle, CheckCircle, Clock, Lock, Bell, Printer } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiRequest } from '../services/api';

const iconMap: Record<string, React.ElementType> = {
  Shield, Upload, AlertTriangle, CheckCircle, Clock, Lock, Bell, Printer,
};

export default function NotificationsPage() {
  const { notifications, dispatch } = useApp();
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const unread = notifications.filter(n => n.unread).length;

  const markAllRead = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest<{ modifiedCount: number }>('/notifications/read-all', { method: 'POST' });
      dispatch({ type: 'MARK_ALL_READ' });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update notifications.');
    } finally {
      setSaving(false);
    }
  };

  const markRead = async (id: string | number) => {
    if (typeof id !== 'string') return;
    setError('');
    try {
      await apiRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
      dispatch({ type: 'MARK_NOTIF_READ', id });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update notification.');
    }
  };

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">{unread} unread</p>
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} disabled={saving} className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50">{saving ? 'Saving…' : 'Mark all as read'}</button>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-8 h-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No notifications.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map(n => {
            const Icon = iconMap[n.iconName] ?? Bell;
            return (
              <div
                key={n.id}
                onClick={() => n.unread && markRead(n.id)}
                onKeyDown={event => {
                  if (n.unread && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    void markRead(n.id);
                  }
                }}
                role={n.unread ? 'button' : undefined}
                tabIndex={n.unread ? 0 : undefined}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${n.unread ? 'cursor-pointer bg-[#0f1728] border-white/[0.08] hover:border-white/[0.14]' : 'cursor-default bg-white/[0.02] border-white/[0.04]'}`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 border ${n.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm font-semibold ${n.unread ? 'text-white' : 'text-slate-400'}`}>{n.title}</span>
                    {n.unread && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                  <span className="text-[10px] text-slate-700 font-mono mt-1 block">{n.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
