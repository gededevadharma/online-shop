'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { cachedFetchJson } from '@/lib/adminCache';
import './notifications.css';

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
    ORDER: '📦',
    PAYMENT: '💰',
    TICKET: '🎫',
    USER: '👤',
    SYSTEM: '⚙️',
};

export default function NotificationsPage() {
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(true);
    const [unreadOnly, setUnreadOnly] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await cachedFetchJson<{ notifications: Notification[]; unread: number }>(
                `/api/admin/notifications?unread=${unreadOnly}`,
                undefined,
                { key: `admin-notifications:${unreadOnly}`, ttlMs: 10 * 1000 }
            );
            const data = res.data;
            setNotifications(data.notifications || []);
            setUnread(data.unread || 0);
        } catch (e) {
            console.error(e);
            showToast('Gagal memuat notifikasi', 'error');
        } finally {
            setLoading(false);
        }
    }, [unreadOnly, showToast]);

    useEffect(() => {
        fetchNotifications();
        const t = setInterval(fetchNotifications, 15000);
        return () => clearInterval(t);
    }, [fetchNotifications]);

    const markAllRead = async () => {
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            });
            if (!res.ok) throw new Error();
            showToast('Semua notifikasi ditandai dibaca', 'success');
            fetchNotifications();
        } catch {
            showToast('Gagal menandai notifikasi', 'error');
        }
    };

    const clearRead = async () => {
        try {
            const res = await fetch('/api/admin/notifications', { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(data.message, 'success');
            fetchNotifications();
        } catch {
            showToast('Gagal menghapus notifikasi', 'error');
        }
    };

    if (loading) return <div className="admin-loading"><div className="spinner" /></div>;

    return (
        <div className="admin-page">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1>Notifikasi {unread > 0 && <span className="badge badge-danger">{unread} baru</span>}</h1>
                    <p>Pemberitahuan order, pembayaran, dan tiket — tersimpan lokal, tanpa Telegram.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className={`btn btn-sm ${unreadOnly ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setUnreadOnly(!unreadOnly)}>
                        {unreadOnly ? 'Semua' : 'Belum dibaca'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Tandai dibaca</button>
                    <button className="btn btn-sm btn-danger" onClick={clearRead}>Hapus yang dibaca</button>
                </div>
            </div>

            <div className="card">
                {notifications.length === 0 ? (
                    <p className="empty-state">Tidak ada notifikasi.</p>
                ) : (
                    <ul className="notif-list">
                        {notifications.map((n) => (
                            <li key={n._id} className={`notif-item ${n.isRead ? '' : 'unread'}`}>
                                <span className="notif-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                                <div className="notif-body">
                                    <div className="notif-title">{n.title}</div>
                                    <div className="notif-message">{n.message}</div>
                                    <div className="notif-time">
                                        {new Date(n.createdAt).toLocaleString('id-ID')}
                                    </div>
                                </div>
                                {!n.isRead && <span className="dot" />}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            
        </div>
    );
}
