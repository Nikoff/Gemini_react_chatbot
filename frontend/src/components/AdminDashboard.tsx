import { useState, useEffect } from 'react';
import { Users, MessageSquare, ThumbsUp, Shield, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  session: any;
  onClose: () => void;
}

export function AdminDashboard({ session, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
        fetch(`${API_URL}/api/admin/stats`, { headers: { 'Authorization': `Bearer ${session.access_token}` } }),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ role: newRole }),
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
          <h2><Shield size={20} /> Admin Dashboard</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {loading ? (
          <div className="admin-loading">Loading...</div>
        ) : (
          <>
            {stats && (
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <Users size={20} className="icon-blue" />
                  <div className="admin-stat-value">{stats.totalUsers}</div>
                  <div className="admin-stat-label">Users</div>
                </div>
                <div className="admin-stat-card">
                  <MessageSquare size={20} className="icon-emerald" />
                  <div className="admin-stat-value">{stats.totalThreads}</div>
                  <div className="admin-stat-label">Threads</div>
                </div>
                <div className="admin-stat-card">
                  <ThumbsUp size={20} className="icon-purple" />
                  <div className="admin-stat-value">{stats.totalMessages}</div>
                  <div className="admin-stat-label">Messages</div>
                </div>
              </div>
            )}

            <div className="admin-section">
              <h3>Users</h3>
              <div className="admin-user-list">
                {users.map(user => (
                  <div key={user.id} className="admin-user-row">
                    <div className="admin-user-info">
                      <span className="admin-user-email">{user.email}</span>
                      <span className="admin-user-stats">{user.threadCount} threads, {user.messageCount} messages</span>
                    </div>
                    <div className="admin-user-actions">
                      <span className={`admin-role-badge ${user.role}`}>{user.role}</span>
                      <button className="admin-toggle-btn" onClick={() => toggleAdmin(user.id, user.role)}>
                        {user.role === 'admin' ? 'Revoke' : 'Make Admin'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {stats?.recentThreads && stats.recentThreads.length > 0 && (
              <div className="admin-section">
                <h3>Recent Threads</h3>
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
