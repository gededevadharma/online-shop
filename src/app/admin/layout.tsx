'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useBranding } from '@/context/BrandingContext';

interface AdminLayoutProps {
    children: React.ReactNode;
}

// Cache hasil cek session admin di level modul (TTL 5 menit).
// Pindah halaman di dalam /admin tidak perlu hit API lagi —
// tiap hit API lewat rantai proxy butuh ~1 detik.
let adminSessionCache: { ok: boolean; expiresAt: number } | null = null;
const ADMIN_SESSION_TTL = 5 * 60 * 1000;

export function invalidateAdminSessionCache() {
    adminSessionCache = null;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const { storeName: BRAND_NAME, logoUrl: BRAND_LOGO_URL } = useBranding();
    const router = useRouter();
    const pathname = usePathname();
    const [authenticated, setAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Pernah lolos verifikasi di sesi ini (cache, walau kadaluarsa):
    // render shell langsung tanpa overlay loading agar klik tidak tertelan.
    // Verifikasi tetap jalan di background; redirect hanya bila GAGAL.
    const [optimistic] = useState(() => adminSessionCache?.ok === true);

    const checkSession = useCallback(async () => {
        // /admin adalah redirect page, ditangani komponennya sendiri
        if (pathname === '/admin') {
            setLoading(false);
            return;
        }

        // Pakai cache kalau masih segar: pindah halaman jadi instan
        const now = Date.now();
        if (adminSessionCache && adminSessionCache.expiresAt > now) {
            if (!adminSessionCache.ok) {
                setDenied(true);
                router.push('/login?redirect=/admin/dashboard');
                return;
            }
            setAuthenticated(true);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch('/api/admin/session');
            const data = await res.json();

            if (!data.authenticated) {
                adminSessionCache = { ok: false, expiresAt: Date.now() + ADMIN_SESSION_TTL };
                setDenied(true);
                router.push('/login?redirect=/admin/dashboard');
                return;
            }

            adminSessionCache = { ok: true, expiresAt: Date.now() + ADMIN_SESSION_TTL };
            setAuthenticated(true);
        } catch (error) {
            console.error('Error checking session:', error);
            // Network drop sesaat: jangan tendang kalau sebelumnya sudah terverifikasi
            if (adminSessionCache?.ok) {
                setAuthenticated(true);
            } else {
                setDenied(true);
                router.push('/login?redirect=/admin/dashboard');
            }
        } finally {
            setLoading(false);
        }
    }, [pathname, router]);

    useEffect(() => {
        checkSession();
    }, [checkSession]);

    // Close sidebar when route changes
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        invalidateAdminSessionCache();
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/login');
    };

    const navItems = [
        {
            href: '/admin/dashboard',
            label: 'Dashboard',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
        },
        {
            href: '/admin/products',
            label: 'Produk',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
            ),
        },
        {
            href: '/admin/inventory',
            label: 'Inventory',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
            ),
        },
        {
            href: '/admin/orders',
            label: 'Pesanan',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            ),
        },
        {
            href: '/admin/notifications',
            label: 'Notifikasi',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
            ),
        },
        {
            href: '/admin/users',
            label: 'Pengguna',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/reviews',
            label: 'Review',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ),
        },
        {
            href: '/admin/discounts',
            label: 'Diskon',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
            ),
        },
        {
            href: '/admin/support-tickets',
            label: 'Support',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
        },
        {
            href: '/admin/testimonials',
            label: 'Testimoni',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            ),
        },
        {
            href: '/admin/audit-logs',
            label: 'Audit Log',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
            ),
        },
        {
            href: '/admin/settings',
            label: 'Pengaturan',
            icon: (
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            ),
        },
    ];

    // If on admin login page, just render children
    if (pathname === '/admin') {
        return <>{children}</>;
    }

    // Ditolak (sesi tidak valid) → sedang redirect ke login, render kosong.
    if (denied) {
        return null;
    }

    // Belum pernah terverifikasi di sesi ini → tampilkan loading seperti dulu.
    // Kalau sudah pernah lolos (optimistic), langsung render shell tanpa overlay
    // agar klik pengguna tidak tertelan saat verifikasi background berjalan.
    if (loading && !optimistic && !authenticated) {
        return (
            <div className="loading-overlay">
                <div className="spinner"></div>
                <p className="loading-text">Memuat...</p>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.8)',
                        zIndex: 90,
                    }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <Link href="/admin/dashboard" className="sidebar-logo">
                    <Image
                        src={BRAND_LOGO_URL}
                        alt="Online Shop Admin"
                        width={30}
                        height={30}
                        className="sidebar-logo-mark"
                        unoptimized
                    />
                    <span>Online Shop Admin</span>
                </Link>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-divider"></div>

                <div className="flex flex-col gap-1">
                    <a href="/" className="sidebar-link" target="_blank">
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span>Lihat Store</span>
                    </a>

                    <button onClick={handleLogout} className="sidebar-link" style={{ width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer' }}>
                        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Menu Toggle */}
            <button
                className="admin-mobile-toggle"
                onClick={() => setSidebarOpen(true)}
                aria-label="Menu"
            >
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
            </button>

            {/* Main Content */}
            <main key={pathname} className="admin-content">
                {children}
            </main>
        </div>
    );
}
