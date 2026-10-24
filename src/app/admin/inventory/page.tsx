'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { cachedFetchJson } from '@/lib/adminCache';

interface InventoryItem {
    _id: string;
    productId: {
        _id: string;
        name: string;
        price: number;
        category: string;
    };
    quantity: number;
    reorderLevel: number;
    sku: string;
    barcode?: string;
    location?: string;
}

export default function InventoryPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted">Memuat...</div>}>
            <InventoryContent />
        </Suspense>
    );
}

function InventoryContent() {
    const searchParams = useSearchParams();
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [lowStockCount, setLowStockCount] = useState(0);

    const fetchInventory = useCallback(async () => {
        try {
            setLoading(true);
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '50',
                lowStock: lowStockOnly.toString()
            });

            const res = await cachedFetchJson<{ inventory: InventoryItem[]; lowStockCount: number }>(`/api/admin/inventory?${query}`, undefined, {
                key: `admin-inventory:${query.toString()}`,
            });
            if (!res.ok) throw new Error('Failed to fetch inventory');

            const data = res.data;
            setInventory(data.inventory);
            setLowStockCount(data.lowStockCount);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error loading inventory');
        } finally {
            setLoading(false);
        }
    }, [page, lowStockOnly]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
        }).format(price);
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
                    <h1>Manajemen Inventory</h1>
                    <p className="text-muted text-sm mb-0">
                        Kelola stok produk Anda ({lowStockCount} produk stok rendah)
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setLowStockOnly(!lowStockOnly)}
                        className={`btn btn-sm ${lowStockOnly ? 'btn-warning' : 'btn-secondary'}`}
                    >
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Stok Rendah ({lowStockCount})
                    </button>
                </div>
            </div>

            {error && (
                <div className="alert alert-error mb-4">
                    <svg width="18" height="18" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span>{error}</span>
                </div>
            )}

            <div className="card glass-card overflow-x-auto">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Kategori</th>
                            <th>SKU</th>
                            <th>Stok Saat Ini</th>
                            <th>Tingkat Reorder</th>
                            <th>Status</th>
                            <th>Lokasi</th>
                            <th>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {inventory.map((item) => (
                            <tr key={item._id} className={item.quantity <= item.reorderLevel ? 'row-warning' : ''}>
                                <td className="font-medium">{item.productId.name}</td>
                                <td className="text-muted text-sm">{item.productId.category}</td>
                                <td className="text-sm">{item.sku}</td>
                                <td>
                                    <span className={`font-medium ${item.quantity <= item.reorderLevel ? 'text-warning' : 'text-success'}`}>
                                        {item.quantity}
                                    </span>
                                </td>
                                <td className="text-sm">{item.reorderLevel}</td>
                                <td>
                                    {item.quantity <= item.reorderLevel ? (
                                        <span className="badge badge-warning">Stok Rendah</span>
                                    ) : (
                                        <span className="badge badge-success">Normal</span>
                                    )}
                                </td>
                                <td className="text-sm text-muted">{item.location || '-'}</td>
                                <td>
                                    <a href={`/admin/inventory/${item._id}`} className="btn btn-ghost btn-xs">
                                        Edit
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {inventory.length === 0 && (
                    <div className="p-8 text-center text-muted">
                        <p>Tidak ada data inventory</p>
                    </div>
                )}
            </div>
        </div>
    );
}
