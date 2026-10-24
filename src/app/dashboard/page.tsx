'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBranding } from '@/context/BrandingContext';
import { fetchSession } from '@/lib/session-client';
import ConfirmModal from '@/components/ConfirmModal';
import QRISPaymentModal, { type QRISPayment } from '@/components/QRISPaymentModal';
import { pollSnapQr } from '@/lib/snap-qr-poll';
import { isMobileDevice } from '@/lib/is-mobile';
import SnapIframeModal, { type SnapIframePayment } from '@/components/SnapIframeModal';
import './dashboard.css';

interface ModalState {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    onConfirm: () => void;
}

interface Order {
    _id: string;
    referenceId: string;
    status: 'pending' | 'paid' | 'failed' | 'cancelled';
    amount: number;
    returnContent?: string;
    paidAt?: string;
    createdAt: string;
    qrCodeUrl?: string;
    qrExpiresAt?: string;
    snapToken?: string;
    snapRedirectUrl?: string;
    snapExpiresAt?: string;
    productId: {
        _id: string;
        name: string;
        thumbnail: string;
        price: number;
        returnType: string;
    };
}

interface User {
    id: string;
    name: string;
    email: string;
}

function DashboardContent() {
    const { storeName: BRAND_NAME, logoUrl: BRAND_LOGO_URL } = useBranding();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'paid' | 'pending'>('all');
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [modal, setModal] = useState<ModalState | null>(null);
    const [modalBusy, setModalBusy] = useState(false);
    const [qrisPayment, setQrisPayment] = useState<QRISPayment | null>(null);
    /** Simpan redirectUrl Snap terakhir agar tombol "Coba Lagi" bisa poll ulang. */
    const lastSnapRedirectUrl = useRef('');
    /** Stop polling QR saat modal ditutup / poll baru dimulai. */
    const pollSnapQrStop = useRef<(() => void) | null>(null);
    const [qrisOpen, setQrisOpen] = useState(false);
    const [snapPayment, setSnapPayment] = useState<SnapIframePayment | null>(null);
    const [snapOpen, setSnapOpen] = useState(false);

    const closeModal = useCallback(() => {
        setModal(null);
        setModalBusy(false);
    }, []);

    /** Pengganti alert() — modal card info. */
    const showInfo = useCallback((title: string, message: string) => {
        setModal({
            title,
            message,
            confirmText: 'OK',
            onConfirm: () => setModal(null),
        });
    }, []);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const checkSession = useCallback(async () => {
        const data = await fetchSession();
        // null = network drop sesaat: jangan tendang user ke /login
        if (!data) return;
        if (!data.authenticated) {
            router.push('/login');
            return;
        }
        setUser(data.user);
    }, [router]);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await fetch('/api/orders');
            const data = await res.json();
            setOrders(data.orders || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    // Lanjutkan pembayaran pending: modal QR white-label kalau ada,
    // kalau tidak buka lagi popup Snap dengan token tersimpan
    /** Mulai polling QR Snap untuk pembayaran ini (dipakai juga oleh tombol "Coba Lagi"). */
    const startSnapQrPoll = useCallback((orderId: string, redirectUrl: string) => {
        lastSnapRedirectUrl.current = redirectUrl;
        pollSnapQrStop.current?.();
        pollSnapQrStop.current = pollSnapQr(orderId, redirectUrl, {
            onQr: (qrCodeUrl, expiresAt) => {
                setQrisPayment((prev) =>
                    prev && prev.orderId === orderId
                        ? { ...prev, qrCodeUrl, qrSlow: false, qrFailed: false, expiresAt: expiresAt || prev.expiresAt }
                        : prev
                );
            },
            onSlow: () => {
                setQrisPayment((prev) =>
                    prev && prev.orderId === orderId && !prev.qrCodeUrl ? { ...prev, qrSlow: true } : prev
                );
            },
            onFailed: () => {
                setQrisPayment((prev) =>
                    prev && prev.orderId === orderId && !prev.qrCodeUrl ? { ...prev, qrFailed: true } : prev
                );
            },
        });
    }, []);

    const handleContinuePayment = useCallback(async (order: Order) => {
        setActionBusy(order._id);
        try {
            const res = await fetch(`/api/payment/status?ref=${encodeURIComponent(order.referenceId)}`, {
                cache: 'no-store',
            });
            const data = await res.json();
            if (!res.ok) {
                showInfo('Gagal', data.error || 'Gagal memuat pembayaran');
                return;
            }
            const o = data.order;
            if (o.status === 'paid') {
                showInfo('Sudah Lunas', 'Pembayaran ini sudah lunas!');
                fetchOrders();
                return;
            }
            if (o.status !== 'pending') {
                showInfo('Tidak Valid', 'Pembayaran ini sudah tidak valid. Silakan buat pesanan baru.');
                fetchOrders();
                return;
            }

            // Tipe 1: QR white-label (Core API) — tampilkan di modal card sendiri
            if (order.qrCodeUrl && order.qrExpiresAt) {
                if (new Date(order.qrExpiresAt).getTime() <= Date.now()) {
                    showInfo('Kedaluwarsa', 'Kode QR sudah kedaluwarsa. Silakan buat pesanan baru.');
                    fetchOrders();
                    return;
                }
                setQrisPayment({
                    referenceId: order.referenceId,
                    orderId: order._id,
                    qrCodeUrl: order.qrCodeUrl,
                    expiresAt: order.qrExpiresAt,
                    amount: order.amount,
                    productName: order.productId?.name || 'Produk',
                    method: o.paymentMethod === 'GoPay' ? 'gopay' : 'qris',
                });
                setQrisOpen(true);
                return;
            }

            // Tipe 2: Snap — modal SELALU dibuka langsung (tidak menunggu QR).
            // Kalau QR belum siap, modal tampil dengan status loading dan QR
            // diambil via polling background sampai tersedia.
            const snapToken = order.snapToken;
            const snapExpiresAt = order.snapExpiresAt;
            if (!snapToken) {
                showInfo('Tidak Valid', 'Token pembayaran tidak ditemukan. Silakan buat pesanan baru.');
                return;
            }
            if (snapExpiresAt && new Date(snapExpiresAt).getTime() <= Date.now()) {
                showInfo('Kedaluwarsa', 'Waktu pembayaran habis. Silakan buat pesanan baru.');
                fetchOrders();
                return;
            }
            // Mobile: langsung buka halaman Snap di tab baru
            // (ekstraksi QR via iframe tidak jalan di browser HP).
            if (isMobileDevice() && order.snapRedirectUrl) {
                window.open(order.snapRedirectUrl, '_blank', 'noopener');
                return;
            }
            const basePayment: QRISPayment = {
                referenceId: order.referenceId,
                orderId: order._id,
                qrCodeUrl: '',
                expiresAt: snapExpiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                amount: order.amount,
                productName: order.productId?.name || 'Produk',
                method: 'qris' as const,
                snapRedirectUrl: order.snapRedirectUrl,
            };
            // Coba ambil QR sekali dulu (cepat) agar sering langsung tampil
            try {
                const qrRes = await fetch(`/api/orders/${order._id}/snap-qr`, { cache: 'no-store' });
                const qrData = await qrRes.json();
                if (qrRes.ok && qrData.qrCodeUrl) {
                    basePayment.qrCodeUrl = qrData.qrCodeUrl;
                    basePayment.expiresAt = qrData.expiresAt || basePayment.expiresAt;
                }
            } catch { /* lanjut dengan loading state */ }
            setQrisPayment(basePayment);
            setQrisOpen(true);
            // QR belum dapat → polling background via helper (trigger iframe + retry)
            if (!basePayment.qrCodeUrl) {
                startSnapQrPoll(order._id, order.snapRedirectUrl || '');
            }
        } catch {
            showInfo('Koneksi Terputus', 'Periksa internet Anda dan coba lagi.');
        } finally {
            setActionBusy(null);
        }
    }, [fetchOrders, showInfo, startSnapQrPoll]);

    // Batalkan pembayaran pending (konfirmasi via modal card)
    const handleCancelPayment = useCallback(async (order: Order) => {
        setModal({
            title: 'Batalkan Pembayaran?',
            message: `Batalkan pembayaran ${order.referenceId} (${order.productId?.name || 'produk'} — ${formatPrice(order.amount)})? Tindakan ini tidak bisa dibatalkan.`,
            confirmText: 'Ya, Batalkan',
            cancelText: 'Kembali',
            danger: true,
            onConfirm: async () => {
                setModalBusy(true);
                try {
                    const res = await fetch(`/api/orders/${order._id}/cancel`, { method: 'POST' });
                    const data = await res.json();
                    if (!res.ok) {
                        setModal({
                            title: 'Gagal',
                            message: data.error || 'Gagal membatalkan pembayaran',
                            confirmText: 'OK',
                            onConfirm: () => setModal(null),
                        });
                        return;
                    }
                    closeModal();
                    fetchOrders();
                } catch {
                    setModal({
                        title: 'Koneksi Terputus',
                        message: 'Periksa internet Anda dan coba lagi.',
                        confirmText: 'OK',
                        onConfirm: () => setModal(null),
                    });
                } finally {
                    setModalBusy(false);
                }
            },
        });
    }, [fetchOrders, closeModal]);

    const pendingOrders = orders.filter((o) => o.status === 'pending');

    useEffect(() => {
        checkSession();
        fetchOrders();
    }, [checkSession, fetchOrders]);

    useEffect(() => {
        const requestedTab = searchParams.get('tab');
        if (requestedTab === 'paid' || requestedTab === 'pending' || requestedTab === 'all') {
            setActiveTab(requestedTab);
        }
    }, [searchParams]);

    // Setelah Snap onSuccess, halaman produk mengarahkan ke /dashboard?paid=1.
    // Sinkronkan order pending dengan Midtrans secara otomatis supaya user
    // langsung dapat konfirmasi "lunas" + produk terkirim, tanpa harus
    // menekan "Lanjutkan Bayar" dulu. Berjalan sekali per kunjungan.
    const paidSyncDone = useRef(false);
    useEffect(() => {
        if (searchParams.get('paid') !== '1' || paidSyncDone.current || loading) return;
        const pendings = orders.filter((o) => o.status === 'pending');
        paidSyncDone.current = true;
        (async () => {
            try {
                let becamePaid = false;
                for (const o of pendings) {
                    const res = await fetch(
                        `/api/payment/status?ref=${encodeURIComponent(o.referenceId)}`,
                        { cache: 'no-store' }
                    );
                    const data = await res.json();
                    if (res.ok && data.order?.status === 'paid') becamePaid = true;
                }
                await fetchOrders();
                if (becamePaid) {
                    showInfo(
                        'Pembayaran Berhasil',
                        'Pembayaranmu sudah lunas dan produk telah dikirim. Cek riwayat pesananmu.'
                    );
                }
            } catch {
                // Gagal sinkron diam-diam — user tetap bisa tekan
                // "Lanjutkan Bayar" untuk cek ulang secara manual.
                await fetchOrders();
            } finally {
                router.replace('/dashboard');
            }
        })();
    }, [searchParams, loading, orders, fetchOrders, showInfo, router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
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
                return <span className="badge badge-secondary">Dibatalkan</span>;
            default:
                return <span className="badge badge-secondary">{status}</span>;
        }
    };

    const filteredOrders = orders.filter((order) => {
        if (activeTab === 'all') return true;
        return order.status === activeTab;
    });

    const paidOrders = orders.filter((o) => o.status === 'paid');

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p className="loading-text">Memuat dashboard...</p>
            </div>
        );
    }

    return (
        <div style={{ paddingTop: 'var(--space-5)', paddingBottom: 'var(--space-10)', minHeight: '100vh' }}>
            <div className="container">
                {/* Header */}
                <div className="flex justify-between items-center mb-6" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                    <a href="/" className="navbar-logo" title={BRAND_NAME}>
                        <Image
                            src={BRAND_LOGO_URL}
                            alt={BRAND_NAME}
                            width={40}
                            height={40}
                            className="navbar-logo-mark"
                            unoptimized
                        />
                        <span className="navbar-logo-text">{BRAND_NAME}</span>
                    </a>
                    <div className="flex gap-3 items-center">
                        <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Logout
                        </button>
                    </div>
                </div>

                {/* Welcome Card */}
                <div className="card glass-card p-5 mb-6">
                    <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: 'var(--gradient-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            color: 'var(--bg-primary)',
                            flexShrink: 0
                        }}>
                            {user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>
                                Halo, {user?.name}!
                            </h2>
                            <p className="text-muted text-sm">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Pending Payment Banner */}
                {pendingOrders.length > 0 && (
                    <div className="pending-banner mb-6">
                        <div className="pending-banner-head">
                            <span className="pending-banner-icon">⏳</span>
                            <div>
                                <h3>Kamu punya {pendingOrders.length} pembayaran pending</h3>
                                <p>Selesaikan pembayaranmu sebelum kode QR kedaluwarsa.</p>
                            </div>
                        </div>
                        <div className="pending-list">
                            {pendingOrders.map((o) => (
                                <div key={o._id} className="pending-item">
                                    <div className="pending-info">
                                        <div className="pending-name">{o.productId?.name || 'Produk'}</div>
                                        <div className="pending-meta">
                                            {formatPrice(o.amount)} · {o.referenceId}
                                        </div>
                                    </div>
                                    <div className="pending-actions">
                                        <button
                                            className="btn btn-primary btn-sm"
                                            disabled={actionBusy === o._id}
                                            onClick={() => handleContinuePayment(o)}
                                        >
                                            {actionBusy === o._id ? 'Memuat...' : 'Lanjutkan Bayar'}
                                        </button>
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={actionBusy === o._id}
                                            onClick={() => handleCancelPayment(o)}
                                        >
                                            Batalkan
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-3 gap-4 mb-6">
                    <div className="card glass-card stat-card">
                        <div className="stat-value">{orders.length}</div>
                        <div className="stat-label">Total Pesanan</div>
                    </div>
                    <div className="card glass-card stat-card">
                        <div className="stat-value">{paidOrders.length}</div>
                        <div className="stat-label">Berhasil</div>
                    </div>
                    <div className="card glass-card stat-card">
                        <div className="stat-value" style={{ fontSize: 'clamp(0.875rem, 2vw, 1.25rem)' }}>
                            {formatPrice(paidOrders.reduce((sum, o) => sum + o.amount, 0))}
                        </div>
                        <div className="stat-label">Total Belanja</div>
                    </div>
                </div>

                {/* Buyer Menu */}
                <div className="card glass-card p-4 mb-6">
                    <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                        <div>
                            <h3 style={{ fontSize: '1rem', marginBottom: '0.25rem' }}>Menu Buyer</h3>
                            <p className="text-xs text-muted mb-0">Lihat semua item yang pernah Anda beli dan akses ulang kapan saja.</p>
                        </div>
                        <Link href="/dashboard?tab=paid" className="btn btn-primary btn-sm">
                            Produk Saya ({paidOrders.length})
                        </Link>
                    </div>
                </div>

                {/* My Products */}
                {paidOrders.length > 0 && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 style={{ fontSize: '1.125rem' }}>Produk Saya</h3>
                            <span className="badge badge-primary">{paidOrders.length} produk</span>
                        </div>
                        <div className="grid grid-2 gap-4">
                            {paidOrders.map((order) => (
                                <div key={order._id} className="card glass-card">
                                    <div className="card-image" style={{ aspectRatio: '16/9' }}>
                                        <Image
                                            src={order.productId?.thumbnail || '/store-icon.svg'}
                                            alt={order.productId?.name || 'Product'}
                                            width={400}
                                            height={225}
                                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                            unoptimized
                                        />
                                    </div>
                                    <div className="card-body">
                                        <h4 className="card-title truncate">{order.productId?.name}</h4>
                                        <p className="text-xs text-muted mb-3">
                                            Dibeli {formatDate(order.paidAt || order.createdAt)}
                                        </p>
                                        {order.returnContent && (
                                            <a
                                                href={order.returnContent}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={order.productId?.returnType === 'file' ? `product-${order.productId.name}` : undefined}
                                                className="btn btn-primary btn-sm w-full"
                                            >
                                                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                                {order.productId?.returnType === 'link' ? 'Akses' : 'Download'}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Orders History */}
                <div className="card glass-card">
                    <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <h3 style={{ marginBottom: '0', fontSize: '1rem' }}>Riwayat Transaksi</h3>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 p-4" style={{ borderBottom: '1px solid var(--glass-border)', flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            Semua ({orders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('paid')}
                            className={`btn btn-sm ${activeTab === 'paid' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            Berhasil ({paidOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('pending')}
                            className={`btn btn-sm ${activeTab === 'pending' ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            Menunggu ({orders.filter(o => o.status === 'pending').length})
                        </button>
                    </div>

                    {filteredOrders.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">
                                <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h4 className="empty-state-title">Belum Ada Transaksi</h4>
                            <p className="empty-state-text">
                                {activeTab === 'all' ? 'Mulai berbelanja untuk melihat transaksi' : 'Tidak ada transaksi dengan status ini'}
                            </p>
                            <a href="/" className="btn btn-primary btn-sm">
                                Mulai Belanja
                            </a>
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="flex flex-col gap-3">
                                {filteredOrders.map((order) => (
                                    <div
                                        key={order._id}
                                        className="flex items-center gap-4 p-3 rounded-xl transition"
                                        style={{ background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}
                                    >
                                        <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', overflow: 'hidden', flexShrink: 0 }}>
                                            <Image
                                                src={order.productId?.thumbnail || '/store-icon.svg'}
                                                alt={order.productId?.name || 'Product'}
                                                width={48}
                                                height={48}
                                                style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                                unoptimized
                                            />
                                        </div>
                                        <div className="flex-1" style={{ minWidth: '120px' }}>
                                            <p className="font-medium text-sm truncate">{order.productId?.name}</p>
                                            <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                                        </div>
                                        <div className="text-right" style={{ flexShrink: 0 }}>
                                            <p className="text-primary font-semibold text-sm">{formatPrice(order.amount)}</p>
                                            <div className="mt-1">{getStatusBadge(order.status)}</div>
                                        </div>
                                        {order.status === 'paid' && order.returnContent && (
                                            <a
                                                href={order.returnContent}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download={order.productId?.returnType === 'file' ? `product-${order.productId.name}` : undefined}
                                                className="btn btn-primary btn-sm"
                                                style={{ flexShrink: 0 }}
                                            >
                                                Akses
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Back to Store */}
                <div className="text-center mt-6">
                    <a href="/" className="btn btn-secondary">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Kembali ke Store
                    </a>
                </div>
            </div>

            {modal && (
                <ConfirmModal
                    open={true}
                    title={modal.title}
                    message={modal.message}
                    confirmText={modal.confirmText}
                    cancelText={modal.cancelText}
                    danger={modal.danger}
                    busy={modalBusy}
                    onConfirm={modal.onConfirm}
                    onClose={closeModal}
                />
            )}

            <QRISPaymentModal
                open={qrisOpen}
                payment={qrisPayment}
                onClose={() => {
                    pollSnapQrStop.current?.();
                    pollSnapQrStop.current = null;
                    setQrisOpen(false);
                    setQrisPayment(null);
                    fetchOrders();
                }}
                onPaid={() => fetchOrders()}
                onRetryQr={() => {
                    if (qrisPayment) {
                        const base = { ...qrisPayment, qrSlow: false, qrFailed: false, qrCodeUrl: '' };
                        setQrisPayment(base);
                        startSnapQrPoll(qrisPayment.orderId, lastSnapRedirectUrl.current);
                    }
                }}
            />

            <SnapIframeModal
                open={snapOpen}
                payment={snapPayment}
                onClose={() => {
                    setSnapOpen(false);
                    setSnapPayment(null);
                    fetchOrders();
                }}
                onPaid={() => fetchOrders()}
            />

            
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense fallback={
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p className="loading-text">Memuat dashboard...</p>
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}
