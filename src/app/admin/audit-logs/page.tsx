'use client';

import { useState, useEffect, useCallback } from 'react';
import { cachedFetchJson } from '@/lib/adminCache';

interface AuditLog {
    _id: string;
    action: string;
    entity: string;
    entityId?: string;
    adminUsername: string;
    status: 'SUCCESS' | 'FAILED';
    details?: string;
    ipAddress?: string;
    createdAt: string;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState('');

    const fetchLogs = useCallback(async () => {
        try {
            setLoading(true);
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '100',
                ...(actionFilter && { action: actionFilter }),
                ...(entityFilter && { entity: entityFilter })
            });

            const res = await cachedFetchJson<{ logs: AuditLog[] }>(`/api/admin/audit-logs?${query}`, undefined, {
                key: `admin-audit-logs:${query.toString()}`,
            });
            if (!res.ok) throw new Error('Failed to fetch audit logs');

            const data = res.data;
            setLogs(data.logs);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading logs');
        } finally {
            setLoading(false);
        }
    }, [page, actionFilter, entityFilter]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return 'text-success';
            case 'UPDATE': return 'text-info';
            case 'DELETE': return 'text-error';
            case 'LOGIN': return 'text-primary';
            case 'LOGOUT': return 'text-warning';
            default: return 'text-neutral-400';
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center p-8" style={{ minHeight: '50vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Audit Log & Keamanan</h1>
                    <p className="text-muted text-sm mb-0">Riwayat aktivitas admin dan sistem keamanan</p>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            <div className="card glass-card mb-4 p-4">
                <div className="grid grid-4 gap-2">
                    <select
                        value={actionFilter}
                        onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                        className="form-control"
                    >
                        <option value="">Semua Aksi</option>
                        <option value="CREATE">Buat</option>
                        <option value="UPDATE">Ubah</option>
                        <option value="DELETE">Hapus</option>
                        <option value="LOGIN">Login</option>
                        <option value="LOGOUT">Logout</option>
                        <option value="EXPORT">Export</option>
                    </select>
                    <select
                        value={entityFilter}
                        onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                        className="form-control"
                    >
                        <option value="">Semua Entity</option>
                        <option value="PRODUCT">Produk</option>
                        <option value="ORDER">Pesanan</option>
                        <option value="USER">User</option>
                        <option value="ADMIN">Admin</option>
                        <option value="SETTINGS">Pengaturan</option>
                    </select>
                </div>
            </div>

            <div className="card glass-card overflow-x-auto">
                <table className="admin-table text-sm">
                    <thead>
                        <tr>
                            <th>Waktu</th>
                            <th>Admin</th>
                            <th>Aksi</th>
                            <th>Entity</th>
                            <th>Status</th>
                            <th>IP Address</th>
                            <th>Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr
                                key={log._id}
                                className={log.status === 'FAILED' ? 'row-warning' : ''}
                            >
                                <td className="text-xs whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString('id-ID')}
                                </td>
                                <td className="font-medium text-sm">
                                    {log.adminUsername}
                                </td>
                                <td className={`font-semibold text-sm ${getActionColor(log.action)}`}>
                                    {log.action}
                                </td>
                                <td className="text-sm">{log.entity}</td>
                                <td>
                                    <span className={`badge ${log.status === 'SUCCESS' ? 'badge-success' : 'badge-error'}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="text-xs text-muted font-mono">
                                    {log.ipAddress || '-'}
                                </td>
                                <td className="text-xs text-muted truncate" title={log.details}>
                                    {log.details || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {logs.length === 0 && (
                    <div className="p-8 text-center text-muted">
                        <p>Tidak ada log audit</p>
                    </div>
                )}
            </div>

            {/* Security Tips */}
            <div className="card glass-card mt-4 p-4 bg-gradient-accent/10">
                <h4 className="mb-2 flex items-center gap-2">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    Tips Keamanan
                </h4>
                <ul className="text-sm text-muted space-y-1 ml-6">
                    <li>• Jaga kerahasiaan username dan password admin</li>
                    <li>• Periksa audit log secara berkala untuk aktivitas mencurigakan</li>
                    <li>• Logout saat selesai bekerja dilayar publik</li>
                    <li>• Gunakan password yang kuat dengan kombinasi huruf, angka, dan simbol</li>
                </ul>
            </div>
        </div>
    );
}
