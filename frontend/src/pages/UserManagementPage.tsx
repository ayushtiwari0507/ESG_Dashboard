import { useState, useEffect } from 'react';
import api from '../api/client';

interface UserSiteDetail {
  siteId: number;
  site: { name: string; code: string };
}

interface User {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  userSites: UserSiteDetail[];
}

interface Site {
  id: number;
  name: string;
  code: string;
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [msg, setMsg] = useState({ text: '', ok: false });

  // Form state
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'viewer', siteIds: [] as number[] });

  const fetchUsers = async () => {
    try {
      const [userRes, siteRes] = await Promise.all([api.get('/users'), api.get('/sites')]);
      setUsers(userRes.data);
      setSites(siteRes.data);
    } catch (e) {
      setMsg({ text: 'Failed to load users', ok: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const resetForm = () => {
    setForm({ email: '', password: '', fullName: '', role: 'viewer', siteIds: [] });
    setEditUser(null);
    setShowForm(false);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({
      email: u.email,
      password: '',
      fullName: u.fullName,
      role: u.role,
      siteIds: u.userSites.map(us => us.siteId),
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    setMsg({ text: '', ok: false });
    try {
      if (editUser) {
        const payload: any = { email: form.email, fullName: form.fullName, role: form.role, siteIds: form.siteIds };
        if (form.password) payload.password = form.password;
        await api.put(`/users/${editUser.id}`, payload);
        setMsg({ text: 'User updated successfully', ok: true });
      } else {
        await api.post('/users', form);
        setMsg({ text: 'User created successfully', ok: true });
      }
      resetForm();
      fetchUsers();
    } catch (e: any) {
      setMsg({ text: e.response?.data?.error || 'Operation failed', ok: false });
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      setMsg({ text: 'User deactivated', ok: true });
      fetchUsers();
    } catch (e: any) {
      setMsg({ text: e.response?.data?.error || 'Failed to deactivate', ok: false });
    }
  };

  const toggleSite = (siteId: number) => {
    setForm(p => ({
      ...p,
      siteIds: p.siteIds.includes(siteId)
        ? p.siteIds.filter(id => id !== siteId)
        : [...p.siteIds, siteId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">User Management</h1>
          <p className="text-dark-400 mt-1">Manage users, roles, and site access</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary px-6">
          + New User
        </button>
      </div>

      {msg.text && (
        <div className={`${msg.ok ? 'bg-primary-500/10 border-primary-500/30 text-primary-400' : 'bg-red-500/10 border-red-500/30 text-red-400'} border px-4 py-3 rounded-lg mb-6 text-sm`}>
          {msg.ok ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <div className="glass-card p-6 mb-6 border border-primary-500/30">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editUser ? `Edit User: ${editUser.fullName}` : 'Create New User'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                {editUser ? 'New Password (leave blank to keep)' : 'Password'}
              </label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="w-full" placeholder={editUser ? '(unchanged)' : 'Min 8 chars'} />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Full Name</label>
              <input type="text" value={form.fullName} onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} className="w-full">
                <option value="admin">Admin</option>
                <option value="site_user">Site User</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>

          {/* Site Assignment */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-dark-300 mb-2">Assigned Sites</label>
            <div className="flex flex-wrap gap-2">
              {sites.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSite(s.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    form.siteIds.includes(s.id)
                      ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                      : 'border-dark-700 text-dark-400 hover:border-dark-500'
                  }`}
                >
                  {s.name} ({s.code})
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={resetForm} className="px-4 py-2 text-dark-400 hover:text-white border border-dark-700 rounded-lg">Cancel</button>
            <button type="button" onClick={handleSubmit} className="btn-primary px-6">{editUser ? 'Update' : 'Create'}</button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dark-700">
              <th className="text-left p-4 text-dark-300 font-medium">Name</th>
              <th className="text-left p-4 text-dark-300 font-medium">Email</th>
              <th className="text-left p-4 text-dark-300 font-medium">Role</th>
              <th className="text-left p-4 text-dark-300 font-medium">Sites</th>
              <th className="text-left p-4 text-dark-300 font-medium">Status</th>
              <th className="text-right p-4 text-dark-300 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                <td className="p-4 text-white">{u.fullName}</td>
                <td className="p-4 text-dark-300">{u.email}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                    u.role === 'site_user' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>{u.role.replace('_', ' ')}</span>
                </td>
                <td className="p-4 text-dark-400 text-xs">
                  {u.userSites.length > 0 ? u.userSites.map(us => us.site.code).join(', ') : '—'}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => openEdit(u)} className="text-primary-400 hover:text-primary-300 mr-3 text-xs">Edit</button>
                  {u.isActive && (
                    <button onClick={() => handleDeactivate(u.id)} className="text-red-400 hover:text-red-300 text-xs">Deactivate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
