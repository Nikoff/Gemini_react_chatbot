import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Users, MessageSquare, ThumbsUp, Shield, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { api } from '../utils/apiClient';

interface User {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  threadCount: number;
  messageCount: number;
}

interface Stats {
  totalUsers: number;
  totalThreads: number;
  totalMessages: number;
  totalFeedbacks: number;
  recentThreads: { id: string; title: string; createdAt: string; user: { email: string } }[];
}

interface Props {
  session: Session;
  onClose: () => void;
}

export function AdminDashboard({ session, onClose }: Props) {
  const { t } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [usersData, statsData] = await Promise.all([
        api<User[]>('/api/admin/users', { token: session.access_token }),
        api<Stats>('/api/admin/stats', { token: session.access_token }),
      ]);
      setUsers(usersData);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await api(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        body: { role: newRole },
        token: session.access_token,
      });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="admin-dashboard" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Shield size={20} /> {t('admin.title')}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="admin-loading">{t('admin.loading')}</div>
        ) : (
          <>
            {stats && (
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <Users size={20} className="icon-blue" />
                  <div className="admin-stat-value">{stats.totalUsers}</div>
                  <div className="admin-stat-label">{t('admin.users')}</div>
                </div>
                <div className="admin-stat-card">
                  <MessageSquare size={20} className="icon-emerald" />
                  <div className="admin-stat-value">{stats.totalThreads}</div>
                  <div className="admin-stat-label">{t('admin.threads')}</div>
                </div>
                <div className="admin-stat-card">
                  <ThumbsUp size={20} className="icon-purple" />
                  <div className="admin-stat-value">{stats.totalMessages}</div>
                  <div className="admin-stat-label">{t('admin.messages')}</div>
                </div>
              </div>
            )}

            <div className="admin-section">
              <h3>{t('admin.users')}</h3>
              <div className="admin-user-list">
                {users.map(user => (
                  <div key={user.id} className="admin-user-row">
                    <div className="admin-user-info">
                      <span className="admin-user-email">{user.email}</span>
                      <span className="admin-user-stats">{user.threadCount} {t('admin.threads').toLowerCase()}, {user.messageCount} {t('admin.messages').toLowerCase()}</span>
                    </div>
                    <div className="admin-user-actions">
                      <span className={`admin-role-badge ${user.role}`}>{user.role}</span>
                      <button className="admin-toggle-btn" onClick={() => toggleAdmin(user.id, user.role)}>
                        {user.role === 'admin' ? t('admin.revoke') : t('admin.makeAdmin')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {stats?.recentThreads && stats.recentThreads.length > 0 && (
              <div className="admin-section">
                <h3>{t('admin.recentThreads')}</h3>
                <div className="admin-thread-list">
                  {stats.recentThreads.map(thread => (
                    <div key={thread.id} className="admin-thread-row">
                      <span className="admin-thread-title">{thread.title}</span>
                      <span className="admin-thread-user">{thread.user.email}</span>
                      <span className="admin-thread-date">{new Date(thread.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
