'use client';

import { useState, useEffect, useCallback } from 'react';
import { cachedFetchJson } from '@/lib/adminCache';

interface Analytics {
    users: {
        total: number;
        today: number;
        thisWeek: number;
        thisMonth: number;
    };
    orders: {
        total: number;
        today: number;
        thisWeek: number;
        thisMonth: number;
        byStatus: Record<string, { count: number; total: number }>;
    };
    revenue: {
        thisMonth: number;
        lastMonth: number;
        growth: string | number;
    };
    products: {
        total: number;
        active: number;
        top: Array<{
            _id: string;
            name: string;
            thumbnail: string;
            totalSales: number;
            price: number;
        }>;
    };
    topBuyers: Array<{
        _id: string;
        totalSpent: number;
        orderCount: number;
        user: {
            name: string;
            email: string;
        };
    }>;
    recentOrders: Array<{
        _id: string;
        referenceId: string;
        amount: number;
        status: string;
        createdAt: string;
        userId?: { name: string; email: string };
        productId?: { name: string; thumbnail: string };
    }>;
}

interface TicketStats {
    open: number;
    inProgress: number;
    resolved: number;
    urgent: number;
}

interface InventoryStats {
    total: number;
    lowStock: number;
}

export default function AdminDashboardPage() {
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await cachedFetchJson<Analytics>('/api/admin/analytics', undefined, {
                key: 'admin-dashboard-analytics',
                ttlMs: 2 * 60 * 1000,
            });
            const data = res.data;
            setAnalytics(data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        const map: Record<string, { class: string; label: string }> = {
            paid: { class: 'badge-success', label: 'Berhasil' },
            pending: { class: 'badge-warning', label: 'Menunggu' },
            failed: { class: 'badge-error', label: 'Gagal' },
            expired: { class: 'badge-secondary', label: 'Expired' },
        };
        const s = map[status] || { class: 'badge-secondary', label: status };
        return <span className={`badge ${s.class}`}>{s.label}</span>;
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
                    <h1>Dashboard</h1>
                    <p className="text-muted text-sm mb-0">Selamat datang di Admin Panel</p>
                </div>
                <a href="/admin/products" className="btn btn-primary btn-sm">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="hide-mobile">Tambah Produk</span>
                </a>
            </div>

            {/* Main Stats */}
            <div className="stats-grid mb-6">
                <div className="card glass-card stat-card">
                    <div className="stat-value">{formatPrice(analytics?.revenue.thisMonth || 0)}</div>
                    <div className="stat-label">Pendapatan Bulan Ini</div>
                    {analytics?.revenue.growth && Number(analytics.revenue.growth) !== 0 && (
                        <div className={`text-xs mt-1 ${Number(analytics.revenue.growth) > 0 ? 'text-success' : 'text-error'}`}>
                            {Number(analytics.revenue.growth) > 0 ? '↑' : '↓'} {Math.abs(Number(analytics.revenue.growth))}% dari bulan lalu
                        </div>
                    )}
                </div>
                <div className="card glass-card stat-card">
                    <div className="stat-value">{analytics?.orders.total || 0}</div>
                    <div className="stat-label">Total Pesanan</div>
                </div>
                <div className="card glass-card stat-card">
                    <div className="stat-value">{analytics?.products.active || 0}</div>
                    <div className="stat-label">Produk Aktif</div>
                </div>
                <div className="card glass-card stat-card">
                    <div className="stat-value">{analytics?.users.total || 0}</div>
                    <div className="stat-label">Total Users</div>
                </div>
            </div>

            {/* Activity Stats */}
            <div className="grid grid-3 gap-4 mb-6">
                <div className="card glass-card p-4">
                    <h4 className="text-sm text-muted mb-3">User Baru</h4>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between">
                            <span className="text-sm">Hari Ini</span>
                            <span className="font-bold text-primary">{analytics?.users.today || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted">Minggu Ini</span>
                            <span className="font-medium">{analytics?.users.thisWeek || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted">Bulan Ini</span>
                            <span className="font-medium">{analytics?.users.thisMonth || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="card glass-card p-4">
                    <h4 className="text-sm text-muted mb-3">Pesanan</h4>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between">
                            <span className="text-sm">Hari Ini</span>
                            <span className="font-bold text-primary">{analytics?.orders.today || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted">Minggu Ini</span>
                            <span className="font-medium">{analytics?.orders.thisWeek || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted">Bulan Ini</span>
                            <span className="font-medium">{analytics?.orders.thisMonth || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="card glass-card p-4">
                    <h4 className="text-sm text-muted mb-3">Status Pesanan</h4>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></span>
                                Berhasil
                            </span>
                            <span className="font-bold text-success">{analytics?.orders.byStatus?.paid?.count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                                Pending
                            </span>
                            <span className="font-medium">{analytics?.orders.byStatus?.pending?.count || 0}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm flex items-center gap-2">
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }}></span>
                                Gagal
                            </span>
                            <span className="font-medium">{analytics?.orders.byStatus?.failed?.count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="card glass-card mb-6 p-4">
                <h4 className="mb-3" style={{ fontSize: '0.9375rem' }}>Aksi Cepat</h4>
                <div className="flex gap-2 flex-wrap">
                    <a href="/admin/products" className="btn btn-secondary btn-sm">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Produk
                    </a>
                    <a href="/admin/orders" className="btn btn-secondary btn-sm">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        </svg>
                        Lihat Pesanan
                    </a>
                    <a href="/admin/users" className="btn btn-secondary btn-sm">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />
                        </svg>
                        Kelola Users
                    </a>
                    <a href="/admin/testimonials" className="btn btn-secondary btn-sm">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Testimoni
                    </a>
                    <a href="/" className="btn btn-secondary btn-sm" target="_blank">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Lihat Store
                    </a>
                </div>
            </div>

            {/* Three Column Layout */}
            <div className="grid grid-3 gap-4">
                {/* Recent Orders */}
                <div className="card glass-card">
                    <div className="p-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Pesanan Terbaru</h4>
                        <a href="/admin/orders" className="btn btn-ghost btn-sm">Lihat</a>
                    </div>
                    <div className="p-4">
                        {!analytics?.recentOrders?.length ? (
                            <p className="text-muted text-sm text-center p-4">Belum ada pesanan</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {analytics.recentOrders.slice(0, 5).map((order) => (
                                    <div
                                        key={order._id}
                                        className="flex justify-between items-center p-3 rounded-lg"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}
                                    >
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <p className="font-medium text-sm truncate">{order.productId?.name || 'Unknown'}</p>
                                            <p className="text-xs text-muted">{order.userId?.name || 'Guest'}</p>
                                        </div>
                                        <div className="text-right" style={{ flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                                            <p className="text-primary font-semibold text-sm">{formatPrice(order.amount)}</p>
                                            <div className="mt-1">{getStatusBadge(order.status)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="card glass-card">
                    <div className="p-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Produk Terlaris</h4>
                        <a href="/admin/products" className="btn btn-ghost btn-sm">Lihat</a>
                    </div>
                    <div className="p-4">
                        {!analytics?.products.top?.length ? (
                            <p className="text-muted text-sm text-center p-4">Belum ada data</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {analytics.products.top.map((product, index) => (
                                    <div
                                        key={product._id}
                                        className="flex justify-between items-center p-3 rounded-lg"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}
                                    >
                                        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: 'var(--radius-md)',
                                                background: index < 3 ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '0.75rem',
                                                color: index < 3 ? 'var(--bg-primary)' : 'var(--neutral-400)',
                                                flexShrink: 0
                                            }}>
                                                {index + 1}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <p className="font-medium text-sm truncate">{product.name}</p>
                                                <p className="text-xs text-muted">{formatPrice(product.price)}</p>
                                            </div>
                                        </div>
                                        <div className="text-right" style={{ flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                                            <p className="font-bold text-primary">{product.totalSales}</p>
                                            <p className="text-xs text-muted">terjual</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Buyers */}
                <div className="card glass-card">
                    <div className="p-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Top Pembeli</h4>
                        <a href="/admin/users" className="btn btn-ghost btn-sm">Lihat</a>
                    </div>
                    <div className="p-4">
                        {!analytics?.topBuyers?.length ? (
                            <p className="text-muted text-sm text-center p-4">Belum ada data</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {analytics.topBuyers.map((buyer, index) => (
                                    <div
                                        key={buyer._id}
                                        className="flex justify-between items-center p-3 rounded-lg"
                                        style={{ background: 'rgba(255,255,255,0.02)' }}
                                    >
                                        <div className="flex items-center gap-3" style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '50%',
                                                background: index < 3 ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.1)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: 'bold',
                                                fontSize: '0.75rem',
                                                color: 'white',
                                                flexShrink: 0
                                            }}>
                                                {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                                            </div>
                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                <p className="font-medium text-sm truncate">{buyer.user?.name || 'Unknown'}</p>
                                                <p className="text-xs text-muted">{buyer.orderCount} pesanan</p>
                                            </div>
                                        </div>
                                        <div className="text-right" style={{ flexShrink: 0, marginLeft: 'var(--space-3)' }}>
                                            <p className="font-bold text-accent text-sm">{formatPrice(buyer.totalSpent)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
