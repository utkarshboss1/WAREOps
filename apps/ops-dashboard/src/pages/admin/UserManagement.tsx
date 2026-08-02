import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, UserPlus,
  Mail, X, Check, Download, Trash2, Shield, UserCheck
} from 'lucide-react';
import { exportToCsv } from '../../utils/exportCsv';
import { adminApi } from '../../api/client';
import type { User, UserRole } from '../../types';

export interface PendingInvite {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  warehouse: string;
}

const INITIAL_INVITES: PendingInvite[] = [
  { id: 'i1', email: 'new.hire@wh3.jp', role: 'WAREHOUSE_OPERATOR', invitedBy: 'admin@wareops.dev', expiresAt: '2026-08-01', warehouse: 'WH-ALPHA-001' },
  { id: 'i2', email: 'manager.new@alpha.sg', role: 'WAREHOUSE_MANAGER', invitedBy: 'admin@wareops.dev', expiresAt: '2026-08-05', warehouse: 'WH-ALPHA-001' },
];

const ROLES: string[] = ['All', 'WAREHOUSE_OPERATOR', 'WAREHOUSE_SUPERVISOR', 'WAREHOUSE_MANAGER', 'ENTERPRISE_ADMIN'];
const STATUSES: string[] = ['All', 'ACTIVE', 'SUSPENDED', 'PENDING'];

const RoleBadge: React.FC<{ role: string }> = ({ role }) => {
  const map: Record<string, string> = {
    ENTERPRISE_ADMIN: 'bg-purple-500/10 text-purple-400',
    WAREHOUSE_MANAGER: 'bg-indigo-500/10 text-indigo-400',
    WAREHOUSE_SUPERVISOR: 'bg-blue-500/10 text-blue-400',
    WAREHOUSE_OPERATOR: 'bg-slate-800 text-slate-400',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${map[role] || 'bg-slate-800 text-slate-400'}`}>{role.replace('WAREHOUSE_', '')}</span>;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    ACTIVE: 'bg-emerald-500/10 text-emerald-400',
    SUSPENDED: 'bg-red-500/10 text-red-400',
    PENDING: 'bg-amber-500/10 text-amber-400',
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${map[status] || 'bg-slate-800 text-slate-400'}`}>{status}</span>;
};

// ─── Invite Modal ──────────────────────────────────────────────────────────────
const InviteModal: React.FC<{ onClose: () => void; onInvite: (invite: PendingInvite) => void }> = ({ onClose, onInvite }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('WAREHOUSE_OPERATOR');
  const [warehouse, setWarehouse] = useState('WH-ALPHA-001');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    await adminApi.inviteUser({
      email,
      role,
      warehouse_ids: [warehouse],
    });

    onInvite({
      id: `i-${Date.now()}`,
      email,
      role,
      invitedBy: 'admin@wareops.dev',
      expiresAt: '2026-08-15',
      warehouse,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#0d1424] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-6">
          <h2 className="text-base font-semibold text-slate-100">Invite New User</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Email Address</label>
            <input
              type="email"
              required
              placeholder="user@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Role</label>
            <div className="space-y-2">
              {(['WAREHOUSE_OPERATOR', 'WAREHOUSE_SUPERVISOR', 'WAREHOUSE_MANAGER'] as UserRole[]).map(r => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`w-full rounded-xl border p-3 text-left transition-all
                    ${role === r ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'}`}
                >
                  <div className="flex items-center justify-between">
                    <RoleBadge role={r} />
                    {role === r && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">Warehouse Assignment</label>
            <select
              value={warehouse}
              onChange={e => setWarehouse(e.target.value)}
              className="w-full rounded-xl bg-[#080d1a] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="WH-ALPHA-001">WH-ALPHA-001</option>
              <option value="WH-BETA-002">WH-BETA-002</option>
              <option value="WH-GAMMA-003">WH-GAMMA-003</option>
              <option value="WH-DELTA-004">WH-DELTA-004</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-5 py-2.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button type="submit" className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors shadow-lg shadow-indigo-500/20">
            <Mail className="h-4 w-4" /> Send Invite
          </button>
        </div>
      </form>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export default function UserManagement() {
  const [userList, setUserList] = useState<User[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>(INITIAL_INVITES);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await adminApi.getUsers();
        setUserList(users);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    loadUsers();
  }, []);

  const filtered = useMemo(() => userList.filter(u =>
    (search === '' || u.display_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())) &&
    (roleFilter === 'All' || u.role === roleFilter) &&
    (statusFilter === 'All' || u.status === statusFilter)
  ), [userList, search, roleFilter, statusFilter]);

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const updated = await adminApi.updateUser(user.id, { status: newStatus });
    setUserList(prev => prev.map(u => u.id === user.id ? updated : u));
    if (selectedUser?.id === user.id) setSelectedUser(updated);
  };

  const handleRoleChange = async (user: User, newRole: UserRole) => {
    const updated = await adminApi.updateUser(user.id, { role: newRole });
    setUserList(prev => prev.map(u => u.id === user.id ? updated : u));
    if (selectedUser?.id === user.id) setSelectedUser(updated);
  };

  const handleDeleteUser = (userId: string) => {
    setUserList(prev => prev.filter(u => u.id !== userId));
    if (selectedUser?.id === userId) setSelectedUser(null);
  };

  const handleRevokeInvite = (inviteId: string) => {
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  };

  return (
    <div className={`space-y-6 transition-all ${selectedUser ? 'lg:pr-[416px]' : ''}`}>
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onInvite={inv => setPendingInvites(prev => [inv, ...prev])}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-400 mb-1">Administrator</p>
          <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{userList.length} registered platform users</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            onClick={() => {
              const headers = ['User ID', 'Name', 'Email', 'Role', 'Status', 'Last Login'];
              const rows = filtered.map(u => [u.id, u.display_name, u.email, u.role, u.status, u.last_login_at || 'N/A']);
              exportToCsv('user_roster_export', headers, rows);
            }}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-300 transition-all cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" /> Invite User
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-white/[0.04] border border-white/[0.08] pl-9 pr-4 py-2.5 text-sm text-slate-300 placeholder-slate-600 outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="rounded-xl bg-[#080d1a] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
        >
          {ROLES.map(r => <option key={r} value={r}>{r === 'All' ? 'All Roles' : r.replace('WAREHOUSE_', '')}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl bg-[#080d1a] border border-white/[0.08] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-colors"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s}</option>)}
        </select>
        <span className="text-xs text-slate-500">{filtered.length} users</span>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-white/[0.04]">
              {['User', 'Role', 'Status', 'Last Active', 'Actions'].map(h => (
                <th key={h} className="px-6 py-3.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filtered.map(user => (
              <tr
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className="hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 font-mono">
                      {user.display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{user.display_name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onClick={e => e.stopPropagation()}
                    onChange={e => handleRoleChange(user, e.target.value as UserRole)}
                    className="bg-[#080d1a] border border-white/10 rounded-lg text-xs text-indigo-300 font-semibold px-2 py-1 outline-none"
                  >
                    <option value="WAREHOUSE_OPERATOR">OPERATOR</option>
                    <option value="WAREHOUSE_SUPERVISOR">SUPERVISOR</option>
                    <option value="WAREHOUSE_MANAGER">MANAGER</option>
                    <option value="ENTERPRISE_ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleStatus(user); }}
                    className="cursor-pointer"
                  >
                    <StatusBadge status={user.status} />
                  </button>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500 font-mono">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Recently'}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteUser(user.id); }}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                    title="Delete User"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Invites */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-slate-200">Pending Invites</span>
            <span className="rounded-full bg-amber-500/10 text-amber-400 px-2 py-0.5 text-[10px] font-bold">{pendingInvites.length}</span>
          </div>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {pendingInvites.map(inv => (
            <div key={inv.id} className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Mail className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">{inv.email}</p>
                  <p className="text-xs text-slate-500">Invited by {inv.invitedBy} · Expires {inv.expiresAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <RoleBadge role={inv.role} />
                <button
                  onClick={() => handleRevokeInvite(inv.id)}
                  className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-all cursor-pointer"
                >
                  Revoke Invite
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
