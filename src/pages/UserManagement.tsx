/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  Users, Search, CheckCircle2, XCircle, ArrowUpDown,
  Trash2, Shield, Clock, Loader2, UserCheck, UserX,
  ToggleLeft, ToggleRight, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUsers, useAppSettings } from '../hooks/queries';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

interface UserRecord {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  photo_url: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login: string | null;
}

type ModalAction = {
  type: 'approve' | 'reject' | 'delete' | 'role';
  user: UserRecord;
  newRole?: string;
} | null;

export function UserManagement() {
  const { appUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading: loading } = useUsers();
  const { data: appSettings } = useAppSettings();
  const systemAccess = appSettings?.system_access ?? true;

  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalAction>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Filtered Users ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    if (filter !== 'all' && u.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
    all: users.length,
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleApprove = async (user: UserRecord) => {
    setActionLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Superadmin session not found');

      const { error } = await supabase
        .from('users')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: currentUser.id,
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.name} has been approved! ✅`);
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (user: UserRecord) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'rejected' })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.name} has been rejected`);
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = async (user: UserRecord, newRole: string) => {
    setActionLoading(true);
    try {
      // Check limits
      if (newRole === 'admin') {
        const adminCount = users.filter(u => u.role === 'admin' && u.email !== user.email).length;
        if (adminCount >= 5) {
          toast.error('Maximum 5 admin accounts allowed');
          setActionLoading(false);
          return;
        }
      }
      if (newRole === 'superadmin') {
        toast.error('Cannot assign Superadmin role');
        setActionLoading(false);
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.name} role changed to ${newRole} 🔄`);
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to change role');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (user: UserRecord) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id);
      if (error) throw error;
      toast.success(`${user.name} has been deleted 🗑️`);
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleSystemAccess = async () => {
    try {
      const newAccess = !systemAccess;
      const { error } = await supabase.from('app_settings').upsert({ id: 'app', system_access: newAccess });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success(`System Access is now ${newAccess ? 'ON' : 'OFF'}`);
    } catch (err: any) {
      toast.error('Failed to update system access');
    }
  };


  // ── Format Date ─────────────────────────────────────────────────────────────
  const formatDate = (d: string | null) => {
    if (!d) return '—';
    try {
      return new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return d;
    }
  };

  // ── Role Badge Class ────────────────────────────────────────────────────────
  const roleBadgeClass = (role: string) => {
    if (role === 'superadmin') return 'um-role-badge um-role-superadmin';
    if (role === 'admin') return 'um-role-badge um-role-admin';
    return 'um-role-badge um-role-volunteer';
  };

  const statusBadgeClass = (status: string) => {
    if (status === 'approved') return 'um-status-badge um-status-approved';
    if (status === 'rejected') return 'um-status-badge um-status-rejected';
    return 'um-status-badge um-status-pending';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading && users.length === 0) {
    // Return empty shell, let it fetch without showing a spinner
    return <div className="um-page min-h-screen bg-gray-50" />;
  }

  return (
    <div className="um-page">
      {/* ── Global System Access ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${systemAccess ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <Settings size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">GLOBAL SYSTEM ACCESS</h2>
            <p className="text-sm text-gray-500">If OFF, admins and volunteers cannot log in.</p>
          </div>
        </div>
        <button
          onClick={handleToggleSystemAccess}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
            systemAccess ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {systemAccess ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          {systemAccess ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* ── Header ── */}
      <div className="um-header">
        <h1 className="um-title">
          <Shield className="text-orange-500" size={24} />
          User Management
        </h1>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or username..."
            className="um-search"
            id="input-search-users"
          />
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="um-tabs">
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`um-tab ${filter === f ? 'active' : ''}`}
            id={`tab-filter-${f}`}
          >
            {f === 'pending' && <Clock size={14} className="inline mr-1" />}
            {f === 'approved' && <UserCheck size={14} className="inline mr-1" />}
            {f === 'rejected' && <UserX size={14} className="inline mr-1" />}
            {f === 'all' && <Users size={14} className="inline mr-1" />}
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="um-badge">{counts[f]}</span>
          </button>
        ))}
      </div>

      {/* ── User Cards Grid ── */}
      {filteredUsers.length === 0 ? (
        <div className="um-empty">
          <div className="um-empty-icon">
            {filter === 'pending' ? '📭' : filter === 'rejected' ? '🚫' : '👥'}
          </div>
          <p>No {filter === 'all' ? '' : filter} users found.</p>
        </div>
      ) : (
        <div className="um-grid">
          {filteredUsers.map((user) => (
            <div key={user.id} className="um-card">
              <div className="um-card-header">
                <div className="um-avatar">
                  {user.photo_url ? (
                    <img src={user.photo_url} alt={user.name} />
                  ) : (
                    user.name?.charAt(0)?.toUpperCase() || '?'
                  )}
                </div>
                <div className="um-user-info">
                  <p className="um-user-name">{user.name}</p>
                  <p className="um-user-email">{user.email}</p>
                  {user.username && <p className="um-user-username">@{user.username}</p>}
                </div>
              </div>

              <div className="um-badges">
                <span className={roleBadgeClass(user.role)}>
                  {user.role === 'superadmin' ? '👑 ' : user.role === 'admin' ? '🛡️ ' : '🙏 '}
                  {user.role}
                </span>
                <span className={statusBadgeClass(user.status)}>
                  {user.status}
                </span>
              </div>

              <div className="um-meta">
                <span>📅 Joined: {formatDate(user.created_at)}</span>
                {user.approved_at && <span>✅ Approved: {formatDate(user.approved_at)}</span>}
                {user.last_login && <span>🔑 Last Login: {formatDate(user.last_login)}</span>}
              </div>

              {/* Actions — hide for superadmin's own card and other superadmins */}
              {user.role !== 'superadmin' && (
                <div className="um-actions">
                  {user.status === 'pending' && (
                    <>
                      <button
                        onClick={() => setModal({ type: 'approve', user })}
                        className="um-action-btn um-btn-approve"
                        id={`btn-approve-${user.email}`}
                      >
                        <CheckCircle2 size={14} /> Approve
                      </button>
                      <button
                        onClick={() => setModal({ type: 'reject', user })}
                        className="um-action-btn um-btn-reject"
                        id={`btn-reject-${user.email}`}
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </>
                  )}

                  {user.status === 'rejected' && (
                    <button
                      onClick={() => setModal({ type: 'approve', user })}
                      className="um-action-btn um-btn-approve"
                    >
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  )}

                  {user.status === 'approved' && (
                    <button
                      onClick={() => setModal({ type: 'reject', user })}
                      className="um-action-btn um-btn-reject"
                    >
                      <XCircle size={14} /> Revoke
                    </button>
                  )}

                  <button
                    onClick={() => setModal({
                      type: 'role',
                      user,
                      newRole: user.role === 'admin' ? 'volunteer' : 'admin',
                    })}
                    className="um-action-btn um-btn-role"
                    id={`btn-role-${user.email}`}
                  >
                    <ArrowUpDown size={14} />
                    {user.role === 'admin' ? '→ Volunteer' : '→ Admin'}
                  </button>

                  <button
                    onClick={() => setModal({ type: 'delete', user })}
                    className="um-action-btn um-btn-delete"
                    id={`btn-delete-${user.email}`}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}

              {user.role === 'superadmin' && (
                <div className="text-xs text-purple-500 font-bold mt-1">
                  👑 Superadmin — Cannot be modified
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Confirmation Modal ── */}
      {modal && (
        <div className="um-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="um-modal">
            <h3>
              {modal.type === 'approve' && '✅ Approve User'}
              {modal.type === 'reject' && '❌ Reject User'}
              {modal.type === 'role' && '🔄 Change Role'}
              {modal.type === 'delete' && '🗑️ Delete User'}
            </h3>
            <p>
              {modal.type === 'approve' && `Approve ${modal.user.name}? They will be able to login and access the app.`}
              {modal.type === 'reject' && `Reject ${modal.user.name}? They will not be able to login.`}
              {modal.type === 'role' && `Change ${modal.user.name}'s role from ${modal.user.role} to ${modal.newRole}?`}
              {modal.type === 'delete' && `Permanently delete ${modal.user.name}'s account? This cannot be undone.`}
            </p>
            <div className="um-modal-actions">
              <button
                onClick={() => setModal(null)}
                className="um-modal-btn um-modal-cancel"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (modal.type === 'approve') handleApprove(modal.user);
                  if (modal.type === 'reject') handleReject(modal.user);
                  if (modal.type === 'role') handleRoleChange(modal.user, modal.newRole!);
                  if (modal.type === 'delete') handleDelete(modal.user);
                }}
                className={`um-modal-btn ${modal.type === 'delete' ? 'um-modal-danger' : 'um-modal-confirm'}`}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 size={16} className="animate-spin inline mr-1" />
                ) : null}
                {modal.type === 'approve' && 'Approve'}
                {modal.type === 'reject' && 'Reject'}
                {modal.type === 'role' && 'Change Role'}
                {modal.type === 'delete' && 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
