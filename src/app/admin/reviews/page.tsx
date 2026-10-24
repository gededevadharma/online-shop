'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from '@/context/ToastContext';
import { cachedFetchJson, invalidateAdminCache } from '@/lib/adminCache';

interface Review {
    _id: string;
    productId: {
        _id: string;
        name: string;
        thumbnail: string;
    };
    userId: {
        name: string;
        email: string;
    };
    rating: number;
    title: string;
    comment: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
}

export default function ReviewsPage() {
    const { alertModal, confirmModal } = useToast();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

    const fetchReviews = useCallback(async () => {
        try {
            setLoading(true);
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                status: filter === 'ALL' ? '' : filter
            });

            const res = await cachedFetchJson<{ reviews: Review[] }>(`/api/admin/reviews?${query}`, undefined, {
                key: `admin-reviews:${query.toString()}`,
            });
            if (!res.ok) throw new Error('Failed to fetch reviews');

            const data = res.data;
            setReviews(data.reviews);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading reviews');
        } finally {
            setLoading(false);
        }
    }, [page, filter]);

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

    const handleStatusChange = async (reviewId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/reviews/${reviewId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error('Failed to update review');
            invalidateAdminCache('admin-reviews:');
            fetchReviews();
        } catch (err) {
            await alertModal(err instanceof Error ? err.message : 'Error updating review', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        const confirmed = await confirmModal('Yakin ingin menghapus review ini?', 'Konfirmasi Hapus Review');
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete review');
            invalidateAdminCache('admin-reviews:');
            fetchReviews();
        } catch (err) {
            await alertModal(err instanceof Error ? err.message : 'Error deleting review', 'error');
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
                    <h1>Manajemen Review</h1>
                    <p className="text-muted text-sm mb-0">Kelola ulasan produk dari pembeli</p>
                </div>
                <div className="flex gap-2">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((status) => (
                        <button
                            key={status}
                            onClick={() => { setFilter(status); setPage(1); }}
                            className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-secondary'}`}
                        >
                            {status === 'ALL' ? 'Semua' : status === 'PENDING' ? 'Menunggu' : status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <span>{error}</span>
                </div>
            )}

            <div className="space-y-4">
                {reviews.map((review) => (
                    <div key={review._id} className="card glass-card p-4">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-semibold mb-1">{review.title}</h4>
                                <p className="text-sm text-muted">
                                    {review.userId.name} • {review.productId.name}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xl">{'⭐'.repeat(review.rating)}</span>
                                <span className={`badge ${
                                    review.status === 'APPROVED' ? 'badge-success' :
                                    review.status === 'REJECTED' ? 'badge-error' :
                                    'badge-warning'
                                }`}>
                                    {review.status === 'PENDING' ? 'Menunggu' : review.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                                </span>
                            </div>
                        </div>

                        <p className="text-sm mb-3 p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            {review.comment}
                        </p>

                        <div className="text-xs text-muted mb-3">
                            {new Date(review.createdAt).toLocaleString('id-ID')}
                        </div>

                        {review.status === 'PENDING' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleStatusChange(review._id, 'APPROVED')}
                                    className="btn btn-success btn-sm flex-1"
                                >
                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Setujui
                                </button>
                                <button
                                    onClick={() => handleStatusChange(review._id, 'REJECTED')}
                                    className="btn btn-error btn-sm flex-1"
                                >
                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    Tolak
                                </button>
                            </div>
                        )}
                        <button
                            onClick={() => handleDelete(review._id)}
                            className="btn btn-ghost btn-sm text-error w-full mt-2"
                        >
                            Hapus
                        </button>
                    </div>
                ))}

                {reviews.length === 0 && (
                    <div className="text-center p-8 text-muted">
                        <p>Tidak ada review {filter !== 'ALL' ? 'dengan status ini' : ''}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
