'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BRAND_LOGO_URL } from '@/lib/branding';

export default function AdminSettingsPage() {
    const [settings, setSettings] = useState({
        storeName: 'Online Shop',
        storeDescription: 'Your online game-item store.',
        contactEmail: 'admin@example.com',
        contactPhone: '',
        storeLogo: BRAND_LOGO_URL,
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ type: '', text: '' });

        await new Promise(resolve => setTimeout(resolve, 1000));

        setMessage({ type: 'success', text: 'Pengaturan berhasil disimpan!' });
        setLoading(false);
    };

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Pengaturan</h1>
                    <p className="text-muted text-sm mb-0">Konfigurasi store</p>
                </div>
            </div>

            <div className="card glass-card p-4 mb-4">
                <div className="settings-branding-header">
                    <div className="settings-branding-logo-wrap">
                        <Image
                            src={settings.storeLogo || BRAND_LOGO_URL}
                            alt={settings.storeName}
                            width={56}
                            height={56}
                            className="settings-branding-logo"
                            unoptimized
                        />
                    </div>
                    <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--neutral-100)' }}>{settings.storeName}</p>
                        <p className="text-xs text-muted">Logo akan dipakai untuk navbar, dashboard, dan admin panel.</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 settings-grid">
                {/* Branding */}
                <div className="card glass-card">
                    <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Branding Toko</h4>
                    </div>
                    <div className="p-4">
                        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div>
                                <p className="text-sm font-medium">Nama, Logo & Favicon</p>
                                <p className="text-xs text-muted">Atur via URL + crop tool persegi</p>
                            </div>
                            <a href="/admin/settings/branding" className="btn btn-primary btn-sm">
                                Atur Branding
                            </a>
                        </div>
                    </div>
                </div>

                {/* Payment & Security */}
                <div className="flex flex-col gap-4">
                    {/* Payment */}
                    <div className="card glass-card">
                        <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Pembayaran</h4>
                        </div>
                        <div className="p-4">
                            <div className="alert alert-info mb-4">
                                <span className="text-xs">Atur API Key Midtrans di halaman Pengaturan Midtrans</span>
                            </div>

                            <div className="p-3 rounded-lg flex items-center gap-3 mb-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: 'var(--gradient-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <svg width="20" height="20" fill="none" stroke="var(--bg-primary)" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Midtrans</p>
                                    <p className="text-xs text-success">● Terkonfigurasi</p>
                                </div>
                            </div>

                            <a 
                                href="/admin/settings/midtrans"
                                className="btn btn-primary btn-sm"
                                style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}
                            >
                                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Atur API Key
                            </a>
                        </div>
                    </div>

                    {/* Turnstile */}
                    <div className="card glass-card">
                        <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Cloudflare Turnstile</h4>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-col gap-3">
                                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="flex items-center gap-2">
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: 'linear-gradient(135deg, #f6821f 0%, #fbad41 100%)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <svg width="20" height="20" fill="none" stroke="white" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Turnstile</p>
                                            <p className="text-xs text-muted">Anti-bot Cloudflare</p>
                                        </div>
                                    </div>

                                    <a
                                        href="/admin/settings/turnstile"
                                        className="btn btn-primary btn-sm"
                                        style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}
                                    >
                                        Atur Key
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="card glass-card">
                        <div className="p-4" style={{ borderBottom: '1px solid var(--glass-border)' }}>
                            <h4 style={{ fontSize: '0.9375rem', marginBottom: 0 }}>Keamanan</h4>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-col gap-3">
                                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="flex items-center gap-2">
                                        <svg width="14" height="14" fill="none" stroke="var(--success)" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-sm">Password Hashing</span>
                                    </div>
                                    <span className="badge badge-success">Aktif</span>
                                </div>
                                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="flex items-center gap-2">
                                        <svg width="14" height="14" fill="none" stroke="var(--success)" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-sm">JWT Auth</span>
                                    </div>
                                    <span className="badge badge-success">Aktif</span>
                                </div>
                                <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                    <div className="flex items-center gap-2">
                                        <svg width="14" height="14" fill="none" stroke="var(--success)" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span className="text-sm">HttpOnly Cookies</span>
                                    </div>
                                    <span className="badge badge-success">Aktif</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
