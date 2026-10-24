'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { cachedFetchJson, invalidateAdminCache } from '@/lib/adminCache';

interface Discount {
    _id: string;
    code: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
    minAmount?: number;
    usageCount: number;
    usageLimit?: number;
    expiryDate?: string;
    isActive: boolean;
    applicable: string;
    createdAt: string;
}

interface DiscountFormData {
    code: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;
    minAmount: number;
    usageLimit?: number;
    expiryDate: string;
    isActive: boolean;
}

export default function DiscountsPage() {
    const { alertModal, confirmModal } = useToast();
    const [discounts, setDiscounts] = useState<Discount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState<DiscountFormData>({
        code: '',
        type: 'PERCENTAGE',
        value: 10,
        minAmount: 0,
        usageLimit: 100,
        expiryDate: '',
        isActive: true
    });

    const fetchDiscounts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await cachedFetchJson<{ discounts: Discount[] }>(`/api/admin/discounts?page=${page}&limit=50`, undefined, {
                key: `admin-discounts:${page}`,
            });
            if (!res.ok) throw new Error('Failed to fetch discounts');

            const data = res.data;
            setDiscounts(data.discounts);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading discounts');
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchDiscounts();
    }, [fetchDiscounts]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const res = await fetch('/api/admin/discounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error);
            }

            setShowForm(false);
            setFormData({
                code: '',
                type: 'PERCENTAGE',
                value: 10,
                minAmount: 0,
                usageLimit: 100,
                expiryDate: '',
                isActive: true
            });
            invalidateAdminCache('admin-discounts:');
            fetchDiscounts();
        } catch (err) {
            await alertModal(err instanceof Error ? err.message : 'Error creating discount', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirmModal('Yakin ingin menghapus diskon ini?', 'Konfirmasi Hapus Diskon');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/discounts/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete discount');
            invalidateAdminCache('admin-discounts:');
            fetchDiscounts();
        } catch (err) {
            await alertModal(err instanceof Error ? err.message : 'Error deleting discount', 'error');
        }
    };

    if (loading && !showForm) {
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
                    <h1>Manajemen Diskon</h1>
                    <p className="text-muted text-sm mb-0">Kelola kode diskon dan promo</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className={`btn btn-sm ${showForm ? 'btn-secondary' : 'btn-primary'}`}
                >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    {showForm ? 'Batal' : 'Tambah Diskon'}
                </button>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            {showForm && (
                <div className="card glass-card mb-6 p-6">
                    <h3 className="mb-4">Tambah Diskon Baru</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-2 gap-4 mb-4">
                            <div className="form-group">
                                <label>Kode Diskon (uppercase)</label>
                                <input
                                    type="text"
                                    placeholder="SUMMER50"
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    required
                                    pattern="[A-Z0-9]{3,20}"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tipe</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'PERCENTAGE' | 'FIXED' })}
                                >
                                    <option value="PERCENTAGE">Persentase (%)</option>
                                    <option value="FIXED">Potongan Tetap (Rp)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Nilai Diskon</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.value}
                                    onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Minimum Pembelian (Rp)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.minAmount}
                                    onChange={(e) => setFormData({ ...formData, minAmount: Number(e.target.value) })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Batas Penggunaan</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.usageLimit}
                                    onChange={(e) => setFormData({ ...formData, usageLimit: Number(e.target.value) || undefined })}
                                    placeholder="Unlimited jika kosong"
                                />
                            </div>
                            <div className="form-group">
                                <label>Tanggal Kadaluarsa</label>
                                <input
                                    type="date"
                                    value={formData.expiryDate}
                                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="form-group mb-4">
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                />
                                <span>Aktif</span>
                            </label>
                        </div>
                        <button type="submit" className="btn btn-primary">Simpan Diskon</button>
                    </form>
                </div>
            )}

            <div className="card glass-card overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Tipe</th>
                            <th>Nilai</th>
                            <th>Min. Pembelian</th>
                            <th>Digunakan</th>
                            <th>Kadaluarsa</th>
                            <th>Status</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {discounts.map((discount) => {
                            const isExpired = discount.expiryDate && new Date(discount.expiryDate) < new Date();
                            const isLimitReached = discount.usageLimit && discount.usageCount >= discount.usageLimit;

                            return (
                                <tr key={discount._id} className={!discount.isActive || isExpired ? 'row-muted' : ''}>
                                    <td className="font-semibold font-mono">{discount.code}</td>
                                    <td className="text-sm">{discount.type === 'PERCENTAGE' ? 'Persentase' : 'Tetap'}</td>
                                    <td className="font-medium">
                                        {discount.type === 'PERCENTAGE' ? `${discount.value}%` : `Rp${discount.value.toLocaleString('id-ID')}`}
                                    </td>
                                    <td className="text-sm">
                                        {discount.minAmount ? `Rp${discount.minAmount.toLocaleString('id-ID')}` : '-'}
                                    </td>
                                    <td className="text-sm">
                                        {discount.usageCount} {discount.usageLimit ? `/ ${discount.usageLimit}` : ''}
                                    </td>
                                    <td className="text-sm text-muted">
                                        {discount.expiryDate
                                            ? new Date(discount.expiryDate).toLocaleDateString('id-ID')
                                            : 'Tidak ada'}
                                    </td>
                                    <td>
                                        <span className={`badge ${
                                            !discount.isActive ? 'badge-secondary' :
                                            isExpired ? 'badge-error' :
                                            isLimitReached ? 'badge-warning' :
                                            'badge-success'
                                        }`}>
                                            {!discount.isActive ? 'Nonaktif' : isExpired ? 'Kadaluarsa' : isLimitReached ? 'Habis' : 'Aktif'}
                                        </span>
                                    </td>
                                    <td>
                                        <a href={`/admin/discounts/${discount._id}`} className="btn btn-ghost btn-xs mr-2">
                                            Edit
                                        </a>
                                        <button
                                            onClick={() => handleDelete(discount._id)}
                                            className="btn btn-ghost btn-xs text-error"
                                        >
                                            Hapus
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {discounts.length === 0 && (
                    <div className="p-8 text-center text-muted">
                        <p>Belum ada diskon. Buat diskon baru untuk memulai!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
