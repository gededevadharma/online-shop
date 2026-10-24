'use client';

import { useState, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useBranding } from '@/context/BrandingContext';
import './auth.css';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { storeName: BRAND_NAME, logoUrl: BRAND_LOGO_URL } = useBranding();
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Login gagal');
                return;
            }

            const redirect = searchParams.get('redirect');
            router.push(redirect && redirect.startsWith('/') ? redirect : '/dashboard');
            router.refresh();
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="v-auth">
            

            <div className="v-auth-bg">
                <div className="v-auth-orb v-auth-orb-1" />
                <div className="v-auth-orb v-auth-orb-2" />
                <div className="v-auth-grid-bg" />
            </div>

            <div className="v-auth-card-wrap">
                <div className="v-auth-card">
                    <div className="v-auth-logo">
                        <a href="/" className="v-auth-logo-inner">
                            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={36} height={36} unoptimized />
                            <span style={{ color: '#fff', fontWeight: 700, fontSize: 18, letterSpacing: '-0.02em' }}>{BRAND_NAME}</span>
                        </a>
                    </div>

                    <h1 className="v-auth-title">Selamat datang kembali</h1>
                    <p className="v-auth-sub">Masuk untuk mengelola pesanan dan produk digitalmu</p>

                    {error && (
                        <div className="v-auth-error">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="v-field">
                            <label className="v-label" htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                className="v-input"
                                placeholder="nama@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="v-field">
                            <label className="v-label" htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                className="v-input"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        <button type="submit" className="v-auth-btn" disabled={loading}>
                            {loading ? 'Memproses...' : 'Masuk'}
                        </button>
                    </form>

                    <div className="v-auth-foot">
                        <p>Belum punya akun? <a href="/register">Daftar gratis</a></p>
                    </div>
                </div>

                <div className="v-auth-back">
                    <a href="/">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Kembali ke beranda
                    </a>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#000' }} />}>
            <LoginForm />
        </Suspense>
    );
}
