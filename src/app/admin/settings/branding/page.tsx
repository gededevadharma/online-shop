'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import ImageCropper from '@/components/ImageCropper';

export default function BrandingSettingsPage() {
    const [storeName, setStoreName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [faviconUrl, setFaviconUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [cropTarget, setCropTarget] = useState<'logo' | 'favicon' | null>(null);
    const [cropSource, setCropSource] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);
    const uploadTarget = useRef<'logo' | 'favicon'>('logo');
    const { showToast } = useToast();
    const router = useRouter();

    const fetchBranding = async () => {
        try {
            const res = await fetch('/api/admin/settings/branding');
            if (!res.ok) {
                if (res.status === 401) { router.push('/admin'); return; }
                throw new Error('Gagal memuat');
            }
            const d = await res.json();
            setStoreName(d.storeName || '');
            setLogoUrl(d.logoUrl || '');
            setFaviconUrl(d.faviconUrl || '');
        } catch {
            showToast('Gagal memuat branding', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranding();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!storeName.trim()) {
            showToast('Nama toko wajib diisi', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings/branding', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeName: storeName.trim(),
                    logoUrl: logoUrl.trim(),
                    faviconUrl: faviconUrl.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
            showToast('Branding tersimpan', 'success');
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
        } finally {
            setSaving(false);
        }
    };

    const openCropper = (target: 'logo' | 'favicon') => {
        const src = target === 'logo' ? logoUrl.trim() : faviconUrl.trim();
        if (!src) {
            showToast('Isi URL gambar dulu sebelum crop', 'error');
            return;
        }
        setCropSource(src);
        setCropTarget(target);
    };

    const handleCropped = (dataUrl: string) => {
        if (cropTarget === 'logo') setLogoUrl(dataUrl);
        else if (cropTarget === 'favicon') setFaviconUrl(dataUrl);
        setCropTarget(null);
        setCropSource('');
        showToast('Hasil crop dimasukkan — jangan lupa Simpan', 'success');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.type.startsWith('image/')) {
            showToast('File harus gambar', 'error');
            return;
        }
        if (f.size > 2_000_000) {
            showToast('Maksimal 2MB', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result);
            // langsung buka cropper dengan file yang diupload
            setCropSource(dataUrl);
            setCropTarget(uploadTarget.current);
        };
        reader.readAsDataURL(f);
        e.target.value = '';
    };

    const previewBox = (url: string, label: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
                width: 56, height: 56, borderRadius: 12, background: '#111',
                border: '1px solid #262626', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
            }}>
                {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                    <span style={{ color: '#525252', fontSize: 11 }}>kosong</span>
                )}
            </div>
            <span style={{ color: '#737373', fontSize: 12 }}>{label}</span>
        </div>
    );

    if (loading) return <div className="admin-loading"><div className="spinner" /></div>;

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Branding Toko</h1>
                <p>Nama toko, logo, dan favicon. Bisa pakai URL gambar atau upload lalu crop persegi.</p>
            </div>

            <form onSubmit={handleSave} className="card card-padded" style={{ maxWidth: 680 }}>
                <div className="form-group">
                    <label>Nama Toko</label>
                    <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Online Shop"
                        maxLength={80}
                    />
                </div>

                <div className="form-group">
                    <label>Logo URL</label>
                    <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://... atau hasil crop"
                        autoComplete="off"
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        {previewBox(logoUrl, 'Preview logo')}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCropper('logo')}>
                            Crop Logo
                        </button>
                    </div>
                </div>

                <div className="form-group">
                    <label>Favicon URL</label>
                    <input
                        type="text"
                        value={faviconUrl}
                        onChange={(e) => setFaviconUrl(e.target.value)}
                        placeholder="https://... (persegi, ideal 64×64+)"
                        autoComplete="off"
                    />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                        {previewBox(faviconUrl, 'Preview favicon')}
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCropper('favicon')}>
                            Crop Favicon
                        </button>
                    </div>
                    <small className="text-muted">Favicon tampil di tab browser. Biarkan pakai logo yang sama bila ragu.</small>
                </div>

                <div className="form-group">
                    <label>Upload & Crop Langsung</label>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { uploadTarget.current = 'logo'; fileRef.current?.click(); }}
                        >
                            Upload untuk Logo
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => { uploadTarget.current = 'favicon'; fileRef.current?.click(); }}
                        >
                            Upload untuk Favicon
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={handleFileUpload}
                        />
                    </div>
                    <small className="text-muted">Maksimal 2MB. Setelah upload, crop lalu hasil otomatis masuk ke field.</small>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Branding'}
                </button>
            </form>

            {cropTarget && cropSource && (
                <ImageCropper
                    imageUrl={cropSource}
                    outputSize={cropTarget === 'favicon' ? 256 : 512}
                    onCrop={handleCropped}
                    onClose={() => { setCropTarget(null); setCropSource(''); }}
                />
            )}
        </div>
    );
}
