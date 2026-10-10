import { useState } from 'react';
import { UserPlus, Search, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { UserRole } from '../data/mockData';
import { apiRequest } from '../services/api';

const roleColors: Record<string, string> = {
  'Admin': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Exam Controller': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Manager 1': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Manager 2': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export default function UserManagementPage({ currentUserId }: { currentUserId: string }) {
  const { users, refreshData, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', department: '', role: 'Manager 1' as UserRole, password: '' });
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async () => {
    setError('');
    setSaving(true);
    try {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify(newUser) });
      setNewUser({ name: '', email: '', department: '', role: 'Manager 1', password: '' });
      setShowAdd(false);
      try {
        await refreshData('Admin');
      } catch (refreshError) {
        setError(`User was created, but the list could not refresh: ${refreshError instanceof Error ? refreshError.message : 'refresh failed.'}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create the user.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    setError('');
    try {
      await apiRequest(`/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !isActive }),
      });
      dispatch({ type: 'TOGGLE_USER_STATUS', userId: id });
      try {
        await refreshData('Admin');
      } catch (refreshError) {
        setError(`User status was updated, but the list could not refresh: ${refreshError instanceof Error ? refreshError.message : 'refresh failed.'}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the user.');
    }
  };

  const handleRemove = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
      dispatch({ type: 'REMOVE_USER', userId: id });
      try {
        await refreshData('Admin');
      } catch (refreshError) {
        setError(`User was deactivated, but the list could not refresh: ${refreshError instanceof Error ? refreshError.message : 'refresh failed.'}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not remove the user.');
    }
    setConfirmRemove(null);
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-200 placeholder:text-slate-600 text-sm outline-none focus:border-blue-500/50 transition-colors";

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">User Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.filter(u => u.status === 'Active').length} active users · {users.length} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}

      {showAdd && (
        <div className="rounded-xl bg-[#0f1728] border border-blue-500/20 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Add New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name *</label>
              <input type="text" className={inputClass} placeholder="Dr. Jane Smith" value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
              <input type="email" className={inputClass} placeholder="jane@vaultx.edu" value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Department</label>
              <input type="text" className={inputClass} placeholder="Computer Science" value={newUser.department} onChange={e => setNewUser(u => ({ ...u, department: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Temporary password * (12+ characters)</label>
              <input type="password" className={inputClass} minLength={12} value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Role</label>
              <select className={`${inputClass} bg-[#0f1728]`} value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value as UserRole }))}>
                <option>Manager 1</option>
                <option>Manager 2</option>
                <option>Exam Controller</option>
                <option>Admin</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-lg border border-white/[0.08] text-slate-400 text-sm hover:text-slate-200 transition-colors">Cancel</button>
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors disabled:opacity-50">{saving ? 'Saving…' : 'Add User'}</button>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-4">
          <p className="text-sm text-red-300 flex-1">Remove <strong>{users.find(u => u.id === confirmRemove)?.name}</strong>? This cannot be undone.</p>
          <button onClick={() => setConfirmRemove(null)} className="text-xs text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={() => handleRemove(confirmRemove)} className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold transition-colors">Remove</button>
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] max-w-sm">
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent text-sm text-slate-300 placeholder:text-slate-600 outline-none flex-1" />
      </div>

      <div className="rounded-xl bg-[#0f1728] border border-white/[0.06] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">User</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Role</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Department</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Last Active</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500">Status</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-xs font-semibold text-blue-300">
                      {u.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{u.name}</div>
                      <div className="text-[10px] text-slate-600">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4">
                  <span className={`text-[10px] font-mono font-medium px-2 py-0.5 rounded border ${roleColors[u.role] ?? 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{u.role}</span>
                </td>
                <td className="py-3.5 px-4 text-xs text-slate-500">{u.department}</td>
                <td className="py-3.5 px-4 text-xs text-slate-500">{u.lastActive}</td>
                <td className="py-3.5 px-4">
                  <button onClick={() => handleToggle(u.id, u.status === 'Active')} disabled={u.id === currentUserId} className={`flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-40 ${u.status === 'Active' ? 'text-emerald-400' : 'text-slate-600'}`}>
                    {u.status === 'Active' ? <><CheckCircle className="w-3.5 h-3.5" /> Active</> : <><XCircle className="w-3.5 h-3.5" /> Inactive</>}
                  </button>
                </td>
                <td className="py-3.5 px-4">
                  <button onClick={() => setConfirmRemove(u.id)} disabled={u.id === currentUserId} className="p-1.5 rounded-md hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors disabled:opacity-40" title="Remove user">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-600">No users found.</div>
        )}
      </div>
    </div>
  );
}
