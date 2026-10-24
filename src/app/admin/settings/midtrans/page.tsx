'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

interface MidtransSettings {
    serverKey?: string;
    clientKey?: string;
    isProduction: boolean;
    merchantId?: string;
    qrPaymentMethod?: 'qris' | 'gopay';
    hasSettings?: boolean;
    lastUpdated?: string;
    updatedBy?: string;
}

export default function MidtransSettingsPage() {
    const [serverKey, setServerKey] = useState('');
    const [clientKey, setClientKey] = useState('');
    const [isProduction, setIsProduction] = useState(true);
    const [merchantId, setMerchantId] = useState('');
    const [qrPaymentMethod, setQrPaymentMethod] = useState<'qris' | 'gopay'>('qris');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentSettings, setCurrentSettings] = useState<MidtransSettings | null>(null);
    const { showToast } = useToast();
    const router = useRouter();

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings/midtrans');
            if (!response.ok) {
                if (response.status === 401) {
                    router.push('/admin');
                    return;
                }
                throw new Error('Failed to fetch settings');
            }

            const data = await response.json();
            setCurrentSettings(data);
            setIsProduction(data.isProduction);
            setMerchantId(data.merchantId || '');
            setQrPaymentMethod(data.qrPaymentMethod === 'gopay' ? 'gopay' : 'qris');
            setServerKey('');
            setClientKey('');
        } catch (error) {
            console.error('Error fetching settings:', error);
            showToast('Gagal memuat pengaturan', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const res = await fetch('/api/admin/settings/midtrans', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverKey: serverKey.trim(),
                    clientKey: clientKey.trim(),
                    isProduction,
                    merchantId: merchantId.trim(),
                    qrPaymentMethod,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');
            showToast('Konfigurasi Midtrans tersimpan', 'success');
            setServerKey('');
            setClientKey('');
            fetchSettings();
        } catch (e) {
            showToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="admin-loading"><div className="spinner" /></div>;

    return (
        <div className="admin-page">
            <div className="page-header">
                <h1>Midtrans</h1>
                <p>Payment gateway — Server Key & Client Key. Kosongkan field key untuk memakai yang tersimpan.</p>
                {currentSettings?.lastUpdated && (
                    <small>Terakhir diubah oleh {currentSettings.updatedBy || '-'} — {new Date(currentSettings.lastUpdated).toLocaleString('id-ID')}</small>
                )}
            </div>

            <form onSubmit={handleSave} className="card card-padded" style={{ maxWidth: 640 }}>
                <div className="form-group">
                    <label>Mode</label>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <label><input type="radio" checked={isProduction} onChange={() => setIsProduction(true)} /> Production</label>
                        <label><input type="radio" checked={!isProduction} onChange={() => setIsProduction(false)} /> Sandbox</label>
                    </div>
                </div>

                <div className="form-group">
                    <label>Server Key {currentSettings?.hasSettings && <small className="text-muted">(tersimpan: {currentSettings.serverKey})</small>}</label>
                    <input type="password" value={serverKey} onChange={(e) => setServerKey(e.target.value)}
                        placeholder="Mid-server-..." autoComplete="off" />
                </div>

                <div className="form-group">
                    <label>Client Key {currentSettings?.hasSettings && <small className="text-muted">(tersimpan: {currentSettings.clientKey})</small>}</label>
                    <input type="password" value={clientKey} onChange={(e) => setClientKey(e.target.value)}
                        placeholder="Mid-client-..." autoComplete="off" />
                </div>

                <div className="form-group">
                    <label>Merchant ID (opsional)</label>
                    <input type="text" value={merchantId} onChange={(e) => setMerchantId(e.target.value)}
                        placeholder="G-..." autoComplete="off" />
                </div>

                <div className="form-group">
                    <label>Metode QR Checkout</label>
                    <select
                        value={qrPaymentMethod}
                        onChange={(e) => setQrPaymentMethod(e.target.value as 'qris' | 'gopay')}
                        className="form-control"
                    >
                        <option value="qris">QRIS — bisa discan e-wallet / m-banking apa saja</option>
                        <option value="gopay">GoPay — QR khusus aplikasi GoPay</option>
                    </select>
                    <small className="text-muted">
                        Pilih GoPay sementara jika channel QRIS di akun Midtrans belum aktif
                        (error &quot;Payment channel is not activated&quot;).
                    </small>
                </div>

                <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                </button>
            </form>
        </div>
    );
}
