'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { cachedFetchJson } from '@/lib/adminCache';

interface Order {
    _id: string;
    referenceId: string;
    trxId?: string;
    status: 'pending' | 'paid' | 'failed' | 'cancelled';
    amount: number;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    paymentMethod?: string;
    paymentChannel?: string;
    returnContent?: string;
    paidAt?: string;
    createdAt: string;
    productId: {
        _id: string;
        name: string;
        price: number;
        thumbnail: string;
        category: string;
    };
    userId: {
        _id: string;
        name: string;
        email: string;
    };
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [pagination, setPagination] = useState<Pagination>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
    });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const fetchOrders = useCallback(async (page: number = 1) => {
        setLoading(true);
        try {
            let url = `/api/admin/orders?page=${page}&limit=20`;
            if (statusFilter) {
                url += `&status=${statusFilter}`;
            }
            if (searchQuery) {
                url += `&search=${encodeURIComponent(searchQuery)}`;
            }

            const res = await cachedFetchJson<{ orders: Order[]; pagination: Pagination }>(url, undefined, {
                key: `admin-orders:${url}`,
                ttlMs: 60 * 1000,
            });
            const data = res.data;
            setOrders(data.orders || []);
            setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, searchQuery]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setSearchQuery(searchInput);
    };


    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'paid':
                return <span className="badge badge-success">Berhasil</span>;
            case 'pending':
                return <span className="badge badge-warning">Menunggu</span>;
            case 'failed':
                return <span className="badge badge-error">Gagal</span>;
            case 'cancelled':
                return <span className="badge badge-secondary">Batal</span>;
            default:
                return <span className="badge badge-secondary">{status}</span>;
        }
    };

    if (loading && orders.length === 0) {
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
                    <h1>Pesanan</h1>
                    <p className="text-muted text-sm mb-0">Kelola semua pesanan</p>
                </div>
            </div>

            {/* Filters */}
            <div className="card glass-card mb-5 p-4">
                <form onSubmit={handleSearch} className="flex gap-3 flex-wrap items-end">
                    <div style={{ flex: 1, minWidth: '180px' }}>
                        <label className="form-label text-xs">Cari</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Referensi, nama, email..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                    </div>
                    <div style={{ minWidth: '130px' }}>
                        <label className="form-label text-xs">Status</label>
                        <select
                            className="form-input form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="">Semua</option>
                            <option value="pending">Menunggu</option>
                            <option value="paid">Berhasil</option>
                            <option value="failed">Gagal</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className="btn btn-primary btn-sm">
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Cari
                        </button>
                        {(searchQuery || statusFilter) && (
                            <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                    setSearchQuery('');
                                    setSearchInput('');
                                    setStatusFilter('');
                                }}
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Stats */}
            <div className="mb-4">
                <span className="badge badge-primary">Total: {pagination.total} pesanan</span>
            </div>

            {orders.length === 0 ? (
                <div className="card glass-card empty-state">
                    <div className="empty-state-icon">
                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <h3 className="empty-state-title">
                        {searchQuery || statusFilter ? 'Tidak Ditemukan' : 'Belum Ada Pesanan'}
                    </h3>
                    <p className="empty-state-text">
                        {searchQuery || statusFilter
                            ? 'Tidak ada pesanan yang cocok'
                            : 'Pesanan akan muncul di sini'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="card glass-card">
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Produk</th>
                                        <th className="hide-mobile">Pembeli</th>
                                        <th>Total</th>
                                        <th>Status</th>
                                        <th>Aksi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => (
                                        <tr key={order._id}>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {order.productId && (
                                                        <>
                                                            <div style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: 'var(--radius-md)',
                                                                overflow: 'hidden',
                                                                flexShrink: 0,
                                                                background: 'var(--bg-tertiary)'
                                                            }}>
                                                                <Image
                                                                    src={order.productId.thumbnail || '/store-icon.svg'}
                                                                    alt={order.productId.name}
                                                                    width={40}
                                                                    height={40}
                                                                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                                                    unoptimized
                                                                />
                                                            </div>
                                                            <div style={{ minWidth: 0, flex: 1 }}>
                                                                <span className="text-sm font-medium truncate" style={{ display: 'block', maxWidth: '120px' }}>
                                                                    {order.productId.name}
                                                                </span>
                                                                <code className="text-xs text-muted">{order.referenceId.slice(0, 10)}...</code>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="hide-mobile">
                                                <div>
                                                    <p className="text-sm font-medium mb-0">{order.buyerName}</p>
                                                    <p className="text-xs text-muted mb-0">{order.buyerEmail}</p>
                                                </div>
                                            </td>
                                            <td className="text-primary font-semibold text-sm whitespace-nowrap">
                                                {formatPrice(order.amount)}
                                            </td>
                                            <td>{getStatusBadge(order.status)}</td>
                                            <td>
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Detail"
                                                >
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-5">
                            <button
                                onClick={() => fetchOrders(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="btn btn-secondary btn-sm"
                            >
                                ← Prev
                            </button>
                            <span className="flex items-center px-3 text-sm text-muted">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => fetchOrders(pagination.page + 1)}
                                disabled={pagination.page === pagination.totalPages}
                                className="btn btn-secondary btn-sm"
                            >
                                Next →
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div
                        className="modal"
                        style={{ maxWidth: '480px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ fontSize: '1rem' }}>Detail Pesanan</h3>
                            <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* Status */}
                            <div className="flex justify-between items-center mb-4 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <span className="text-sm text-muted">Status</span>
                                {getStatusBadge(selectedOrder.status)}
                            </div>

                            {/* Reference */}
                            <div className="mb-4">
                                <label className="text-xs text-muted block mb-1">Referensi</label>
                                <code className="text-xs" style={{ wordBreak: 'break-all' }}>{selectedOrder.referenceId}</code>
                            </div>

                            {/* Product */}
                            <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <label className="text-xs text-muted block mb-2">PRODUK</label>
                                {selectedOrder.productId && (
                                    <div className="flex items-center gap-3">
                                        <div style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                            background: 'var(--bg-tertiary)'
                                        }}>
                                            <Image
                                                src={selectedOrder.productId.thumbnail || '/store-icon.svg'}
                                                alt={selectedOrder.productId.name}
                                                width={48}
                                                height={48}
                                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                                unoptimized
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium mb-1">{selectedOrder.productId.name}</p>
                                            <span className="badge badge-secondary" style={{ fontSize: '0.625rem' }}>{selectedOrder.productId.category}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-primary font-bold text-sm">{formatPrice(selectedOrder.amount)}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Buyer */}
                            <div className="p-3 rounded-lg mb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <label className="text-xs text-muted block mb-2">PEMBELI</label>
                                <div className="grid gap-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted">Nama</span>
                                        <span>{selectedOrder.buyerName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted">Email</span>
                                        <a href={`mailto:${selectedOrder.buyerEmail}`} className="text-primary">{selectedOrder.buyerEmail}</a>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted">Telepon</span>
                                        <span>{selectedOrder.buyerPhone}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Timestamps */}
                            <p className="text-xs text-muted">
                                Dibuat: {formatDate(selectedOrder.createdAt)}
                            </p>
                            {selectedOrder.paidAt && (
                                <p className="text-xs text-muted">
                                    Dibayar: {formatDate(selectedOrder.paidAt)}
                                </p>
                            )}

                            <div className="p-3 rounded-lg mt-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <label className="text-xs text-muted block mb-2">INFO PEMBAYARAN</label>
                                <div className="grid gap-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted">Metode</span>
                                        <span>{selectedOrder.paymentMethod || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted">Channel</span>
                                        <span>{selectedOrder.paymentChannel || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted">Transaction ID</span>
                                        <span className="font-mono text-xs">{selectedOrder.trxId || '-'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted">Akses Produk</span>
                                        <span>{selectedOrder.returnContent ? 'Terkirim' : 'Belum terkirim'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
