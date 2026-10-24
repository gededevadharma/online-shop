'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useToast } from '@/context/ToastContext';
import { cachedFetchJson, invalidateAdminCache } from '@/lib/adminCache';

interface Product {
    _id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    thumbnail: string;
    images?: string[];
    videoShowcase?: string;
    returnType: 'link' | 'file';
    returnContent: string;
    category: string;
    tags: string[];
    totalSales: number;
    isActive: boolean;
    stock: number;
    isUnlimitedStock: boolean;
    createdAt: string;
}

interface ProductFormData {
    name: string;
    description: string;
    price: string;
    originalPrice: string;
    thumbnail: string;
    images: string[];
    videoShowcase: string;
    returnType: 'link' | 'file';
    returnContent: string;
    category: string;
    tags: string;
    isActive: boolean;
    stock: string;
    isUnlimitedStock: boolean;
}

const MAX_SAFE_PAYLOAD_BYTES = 3_500_000;
const MAX_IMAGE_UPLOAD_BYTES = 1_200_000;
const MAX_DOWNLOAD_UPLOAD_BYTES = 2_500_000;

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const initialFormData: ProductFormData = {
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    thumbnail: '',
    images: [],
    videoShowcase: '',
    returnType: 'link',
    returnContent: '',
    category: '',
    tags: '',
    isActive: true,
    stock: '0',
    isUnlimitedStock: true,
};

const normalizeExternalUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const normalizeMediaValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';

    // Keep base64/data URL untouched.
    if (trimmed.startsWith('data:')) {
        return trimmed;
    }

    return normalizeExternalUrl(trimmed);
};

const isValidHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

export default function AdminProductsPage() {
    const { showToast, confirmModal } = useToast();
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [formData, setFormData] = useState<ProductFormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(0);
    const [uploadedReturnFileName, setUploadedReturnFileName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchProducts = useCallback(async () => {
        try {
            const res = await cachedFetchJson<{ products: Product[] }>('/api/products?admin=true', undefined, {
                key: 'admin-products',
            });
            const data = res.data;
            setProducts(data.products || []);
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const openCreateModal = () => {
        setEditingProduct(null);
        setFormData(initialFormData);
        setUploadedReturnFileName('');
        setError('');
        setSuccess('');
        setShowModal(true);
    };

    const openEditModal = (product: Product) => {
        setEditingProduct(product);
        setFormData({
            name: product.name,
            description: product.description,
            price: product.price.toString(),
            originalPrice: product.originalPrice?.toString() || '',
            thumbnail: product.thumbnail,
            images: product.images && product.images.length > 0 ? product.images : [product.thumbnail],
            videoShowcase: product.videoShowcase || '',
            returnType: product.returnType,
            returnContent: product.returnContent,
            category: product.category,
            tags: product.tags.join(', '),
            isActive: product.isActive,
            stock: product.stock.toString(),
            isUnlimitedStock: product.isUnlimitedStock,
        });
        if (product.returnType === 'file' && product.returnContent.startsWith('data:')) {
            setUploadedReturnFileName('File tersimpan');
        } else {
            setUploadedReturnFileName('');
        }
        setError('');
        setSuccess('');
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        if (uploadingImages > 0) {
            setError('Upload gambar masih berjalan. Tunggu sampai selesai, lalu simpan kembali.');
            setSaving(false);
            return;
        }

        const trimmedName = formData.name.trim();
        const trimmedDescription = formData.description.trim();
        const trimmedCategory = formData.category.trim();
        const parsedPrice = Number(formData.price);
        const parsedOriginalPrice = formData.originalPrice.trim() ? Number(formData.originalPrice) : undefined;
        const parsedStock = Number.parseInt(formData.stock, 10) || 0;

        if (!trimmedName || !trimmedDescription || !trimmedCategory) {
            setError('Nama, deskripsi, dan kategori wajib diisi.');
            setSaving(false);
            return;
        }

        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            setError('Harga produk tidak valid.');
            setSaving(false);
            return;
        }

        if (parsedOriginalPrice !== undefined && (!Number.isFinite(parsedOriginalPrice) || parsedOriginalPrice < 0)) {
            setError('Harga coret tidak valid.');
            setSaving(false);
            return;
        }

        const normalizedImages = formData.images
            .map((img) => normalizeMediaValue(img))
            .filter(Boolean);
        const normalizedThumbnail = normalizeMediaValue(formData.thumbnail || normalizedImages[0] || '');

        if (!normalizedThumbnail) {
            setError('Minimal 1 gambar produk wajib ditambahkan.');
            setSaving(false);
            return;
        }

        if (formData.returnType === 'link') {
            const normalizedReturnUrl = normalizeExternalUrl(formData.returnContent);
            if (!isValidHttpUrl(normalizedReturnUrl)) {
                setError('URL akses produk tidak valid.');
                setSaving(false);
                return;
            }
        }

        const payload = {
            name: trimmedName,
            description: trimmedDescription,
            price: parsedPrice,
            originalPrice: parsedOriginalPrice,
            thumbnail: normalizedThumbnail,
            images: normalizedImages.length > 0 ? normalizedImages : [normalizedThumbnail],
            videoShowcase: normalizeExternalUrl(formData.videoShowcase) || undefined,
            returnType: formData.returnType,
            returnContent: formData.returnType === 'link'
                ? normalizeExternalUrl(formData.returnContent)
                : formData.returnContent.trim(),
            category: trimmedCategory,
            tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
            isActive: formData.isActive,
            stock: Math.max(0, parsedStock),
            isUnlimitedStock: formData.isUnlimitedStock,
        };

        const payloadSize = new Blob([JSON.stringify(payload)]).size;
        if (payloadSize > MAX_SAFE_PAYLOAD_BYTES) {
            setError('Data produk terlalu besar untuk diproses. Kurangi jumlah/ukuran file upload atau gunakan URL eksternal.');
            setSaving(false);
            return;
        }

        try {
            const url = editingProduct
                ? `/api/products/${editingProduct._id}`
                : '/api/products';

            const res = await fetch(url, {
                method: editingProduct ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const raw = await res.text();
            let data: { error?: string } = {};
            if (raw) {
                try {
                    data = JSON.parse(raw);
                } catch {
                    data = { error: raw };
                }
            }

            if (!res.ok) {
                setError(data.error || 'Gagal menyimpan produk');
                return;
            }

            setSuccess(editingProduct ? 'Produk berhasil diupdate!' : 'Produk berhasil dibuat!');
            invalidateAdminCache('admin-products');
            fetchProducts();
            setTimeout(() => {
                setShowModal(false);
                setFormData(initialFormData);
            }, 1000);
        } catch {
            setError('Terjadi kesalahan. Silakan coba lagi.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (productId: string) => {
        const confirmed = await confirmModal('Apakah Anda yakin ingin menghapus produk ini?', 'Konfirmasi Hapus Produk');
        if (!confirmed) {
            return;
        }

        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                showToast('Gagal menghapus produk', 'error');
                return;
            }

            showToast('Produk berhasil dihapus', 'success');
            invalidateAdminCache('admin-products');
            fetchProducts();
        } catch {
            showToast('Terjadi kesalahan saat menghapus', 'error');
        }
    };

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

    const isUploadedReturnFileDataUrl =
        formData.returnType === 'file' && formData.returnContent.startsWith('data:');

    const returnContentInputValue = isUploadedReturnFileDataUrl
        ? (uploadedReturnFileName || 'File terunggah')
        : formData.returnContent;

    return (
        <div>
            <div className="admin-header">
                <div>
                    <h1>Produk</h1>
                    <p className="text-muted text-sm mb-0">Kelola produk digital Anda</p>
                </div>
                <button onClick={openCreateModal} className="btn btn-primary btn-sm">
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-3 gap-3 mb-6">
                <div className="card glass-card stat-card">
                    <div className="stat-value">{products.length}</div>
                    <div className="stat-label">Total</div>
                </div>
                <div className="card glass-card stat-card">
                    <div className="stat-value">{products.filter(p => p.isActive).length}</div>
                    <div className="stat-label">Aktif</div>
                </div>
                <div className="card glass-card stat-card">
                    <div className="stat-value">{products.reduce((sum, p) => sum + p.totalSales, 0)}</div>
                    <div className="stat-label">Terjual</div>
                </div>
            </div>

            {products.length === 0 ? (
                <div className="card glass-card empty-state">
                    <div className="empty-state-icon">
                        <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                    </div>
                    <h3 className="empty-state-title">Belum Ada Produk</h3>
                    <p className="empty-state-text">Mulai tambahkan produk digital pertama</p>
                    <button onClick={openCreateModal} className="btn btn-primary">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Tambah Produk
                    </button>
                </div>
            ) : (
                <div className="card glass-card">
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Produk</th>
                                    <th>Harga</th>
                                    <th className="hide-mobile">Terjual</th>
                                    <th>Stok</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map((product) => (
                                    <tr key={product._id}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: 'var(--radius-md)',
                                                    overflow: 'hidden',
                                                    flexShrink: 0,
                                                    background: 'var(--bg-tertiary)'
                                                }}>
                                                    <Image
                                                        src={product.thumbnail || '/store-icon.svg'}
                                                        alt={product.name}
                                                        width={48}
                                                        height={48}
                                                        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                                                        unoptimized
                                                    />
                                                </div>
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <p className="font-medium text-sm truncate" style={{ maxWidth: '180px' }}>{product.name}</p>
                                                    <span className="badge badge-secondary" style={{ padding: '2px 6px', fontSize: '0.625rem' }}>{product.category}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <p className="text-primary font-semibold text-sm">{formatPrice(product.price)}</p>
                                                {product.originalPrice && product.originalPrice > product.price && (
                                                    <p className="text-xs text-muted" style={{ textDecoration: 'line-through' }}>
                                                        {formatPrice(product.originalPrice)}
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="hide-mobile">
                                            <span className="font-bold">{product.totalSales}</span>
                                        </td>
                                        <td>
                                            {product.isUnlimitedStock ? (
                                                <span className="badge badge-accent">Unlimited</span>
                                            ) : (
                                                <span className={`badge ${product.stock > 0 ? 'badge-primary' : 'badge-danger'}`}>
                                                    Stock: {product.stock}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {product.isActive ? (
                                                <span className="badge badge-success">Aktif</span>
                                            ) : (
                                                <span className="badge badge-secondary">Off</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => openEditModal(product)}
                                                    className="btn btn-secondary btn-sm btn-icon"
                                                    title="Edit"
                                                >
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product._id)}
                                                    className="btn btn-danger btn-sm btn-icon"
                                                    title="Hapus"
                                                >
                                                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div
                        className="modal"
                        style={{ maxWidth: '520px' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <h3 className="modal-title" style={{ fontSize: '1rem' }}>
                                {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="modal-body">
                                {error && (
                                    <div className="alert alert-error mb-4">
                                        <span className="text-sm">{error}</span>
                                    </div>
                                )}
                                {success && (
                                    <div className="alert alert-success mb-4">
                                        <span className="text-sm">{success}</span>
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label text-sm">Nama Produk *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Masukkan nama produk"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label text-sm">Deskripsi *</label>
                                    <textarea
                                        className="form-input form-textarea"
                                        placeholder="Jelaskan produk..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                        style={{ minHeight: '80px' }}
                                    />
                                </div>

                                <div className="grid grid-2 gap-3">
                                    <div className="form-group">
                                        <label className="form-label text-sm">Harga (IDR) *</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="100000"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label text-sm">Harga Coret</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            placeholder="Opsional"
                                            value={formData.originalPrice}
                                            onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-2 gap-3 mb-3">
                                    <div className="form-group">
                                        <label className="form-label text-sm">Stok Produk</label>
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="number"
                                                className="form-input"
                                                placeholder="99"
                                                value={formData.stock}
                                                onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                                disabled={formData.isUnlimitedStock}
                                                min="0"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg w-full" style={{ background: 'rgba(255,255,255,0.02)', height: '42px', border: '1px solid var(--glass-border)' }}>
                                            <input
                                                type="checkbox"
                                                className="form-checkbox"
                                                checked={formData.isUnlimitedStock}
                                                onChange={(e) => setFormData({ ...formData, isUnlimitedStock: e.target.checked })}
                                            />
                                            <span className="font-medium text-sm">Unlimited Stock</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label text-sm">Kategori *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Software, Template, dll"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label text-sm">Galeri Produk (Gambar pertama jadi thumbnail) *</label>

                                    {/* Image List */}
                                    <div className="grid grid-3 gap-2 mb-3">
                                        {formData.images.map((img, idx) => (
                                            <div key={idx} className="relative group" style={{ aspectRatio: '1/1' }}>
                                                <div style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                                                    <Image
                                                        src={img}
                                                        alt={`Product ${idx}`}
                                                        width={100}
                                                        height={100}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        unoptimized
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newImages = formData.images.filter((_, i) => i !== idx);
                                                        setFormData(prev => ({ ...prev, images: newImages, thumbnail: newImages[0] || '' }));
                                                    }}
                                                    className="absolute top-1 right-1 btn btn-danger btn-xs btn-icon opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                                {idx === 0 && (
                                                    <span className="absolute bottom-1 left-1 badge badge-primary" style={{ fontSize: '0.6rem', padding: '2px 4px' }}>Main</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Add Image Input */}
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            className="form-input flex-1"
                                            placeholder="https://... (URL Gambar)"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = e.currentTarget.value;
                                                    if (val) {
                                                        const normalized = normalizeMediaValue(val);
                                                        if (!normalized) {
                                                            return;
                                                        }
                                                        setFormData(prev => {
                                                            if (prev.images.includes(normalized)) {
                                                                return prev;
                                                            }
                                                            const newImages = [...prev.images, normalized];
                                                            return { ...prev, images: newImages, thumbnail: newImages[0] };
                                                        });
                                                        e.currentTarget.value = '';
                                                    }
                                                }
                                            }}
                                            onBlur={(e) => {
                                                const val = e.target.value;
                                                if (val) {
                                                    const normalized = normalizeMediaValue(val);
                                                    if (!normalized) {
                                                        return;
                                                    }
                                                    setFormData(prev => {
                                                        if (prev.images.includes(normalized)) {
                                                            return prev;
                                                        }
                                                        const newImages = [...prev.images, normalized];
                                                        return { ...prev, images: newImages, thumbnail: newImages[0] };
                                                    });
                                                    e.target.value = '';
                                                }
                                            }}
                                        />
                                        <label className="btn btn-secondary btn-sm cursor-pointer whitespace-nowrap">
                                            + Upload
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept="image/*"
                                                multiple
                                                onChange={(e) => {
                                                    const files = Array.from(e.target.files || []);
                                                    if (files.length === 0) return;

                                                    const oversizedFiles = files.filter((file) => file.size > MAX_IMAGE_UPLOAD_BYTES);
                                                    if (oversizedFiles.length > 0) {
                                                        showToast(
                                                            `Sebagian gambar terlalu besar. Maksimal ${formatBytes(MAX_IMAGE_UPLOAD_BYTES)} per file.`,
                                                            'error'
                                                        );
                                                    }

                                                    const validFiles = files.filter((file) => file.size <= MAX_IMAGE_UPLOAD_BYTES);
                                                    if (validFiles.length === 0) {
                                                        e.target.value = '';
                                                        return;
                                                    }

                                                    setUploadingImages(prev => prev + validFiles.length);

                                                    validFiles.forEach(file => {
                                                        const reader = new FileReader();
                                                        reader.onloadend = () => {
                                                            const base64String = reader.result as string;
                                                            setFormData(prev => {
                                                                const newImages = [...prev.images, base64String];
                                                                return { ...prev, images: newImages, thumbnail: newImages[0] };
                                                            });
                                                            setUploadingImages(prev => Math.max(0, prev - 1));
                                                        };
                                                        reader.onerror = () => {
                                                            setUploadingImages(prev => Math.max(0, prev - 1));
                                                        };
                                                        reader.readAsDataURL(file);
                                                    });
                                                    showToast(`${validFiles.length} gambar berhasil diupload`, 'success');
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    </div>
                                    {uploadingImages > 0 && (
                                        <p className="text-xs" style={{ color: 'var(--warning)' }}>
                                            Sedang memproses {uploadingImages} gambar...
                                        </p>
                                    )}
                                    <p className="text-xs text-muted">Paste URL lalu tekan Enter, atau upload file (maks {formatBytes(MAX_IMAGE_UPLOAD_BYTES)} per gambar).</p>
                                </div>

                                <div className="form-group">
                                    <label className="form-label text-sm">URL Video (Opsional)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Paste link YouTube / Vimeo / Mega / .mp4"
                                        value={formData.videoShowcase}
                                        onChange={(e) => setFormData({ ...formData, videoShowcase: e.target.value })}
                                    />
                                    <p className="text-xs text-muted mt-2">
                                        Cukup paste link video. Format Mega file seperti mega.nz/file/...#... akan dikonversi otomatis ke mode embed.
                                    </p>
                                </div>

                                <div className="grid grid-2 gap-3">
                                    <div className="form-group">
                                        <label className="form-label text-sm">Tipe Produk *</label>
                                        <select
                                            className="form-input form-select"
                                            value={formData.returnType}
                                            onChange={(e) => {
                                                const nextType = e.target.value as 'link' | 'file';
                                                const shouldClearDataUrl = nextType === 'link' && formData.returnContent.startsWith('data:');
                                                setFormData({
                                                    ...formData,
                                                    returnType: nextType,
                                                    returnContent: shouldClearDataUrl ? '' : formData.returnContent,
                                                });
                                                if (shouldClearDataUrl) {
                                                    setUploadedReturnFileName('');
                                                }
                                            }}
                                        >
                                            <option value="link">Link Akses</option>
                                            <option value="file">File Download</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label text-sm">
                                            {formData.returnType === 'link' ? 'URL Akses' : 'File (URL atau Upload)'} *
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type={formData.returnType === 'link' ? 'url' : 'text'}
                                                className="form-input flex-1"
                                                placeholder={formData.returnType === 'link' ? "https://..." : "https://... atau upload file"}
                                                value={returnContentInputValue}
                                                readOnly={isUploadedReturnFileDataUrl}
                                                title={isUploadedReturnFileDataUrl ? uploadedReturnFileName || 'File terunggah siap disimpan' : undefined}
                                                onChange={(e) => {
                                                    setFormData({ ...formData, returnContent: e.target.value });
                                                    if (uploadedReturnFileName) {
                                                        setUploadedReturnFileName('');
                                                    }
                                                }}
                                                required
                                            />
                                            {formData.returnType === 'file' && isUploadedReturnFileDataUrl && (
                                                <button
                                                    type="button"
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, returnContent: '' }));
                                                        setUploadedReturnFileName('');
                                                    }}
                                                >
                                                    Ganti
                                                </button>
                                            )}
                                            {formData.returnType === 'file' && (
                                                <label className="btn btn-secondary btn-sm cursor-pointer whitespace-nowrap">
                                                    Upload
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;

                                                            if (file.size > MAX_DOWNLOAD_UPLOAD_BYTES) {
                                                                showToast(
                                                                    `File terlalu besar. Maksimal ${formatBytes(MAX_DOWNLOAD_UPLOAD_BYTES)} untuk upload langsung. Gunakan URL eksternal untuk file besar.`,
                                                                    'error'
                                                                );
                                                                e.target.value = '';
                                                                return;
                                                            }

                                                            const reader = new FileReader();
                                                            reader.onloadend = () => {
                                                                const base64String = reader.result as string;
                                                                setFormData(prev => ({ ...prev, returnContent: base64String }));
                                                                setUploadedReturnFileName(file.name);
                                                                showToast('File berhasil diupload', 'success');
                                                                e.target.value = '';
                                                            };
                                                            reader.onerror = () => {
                                                                showToast('Gagal membaca file', 'error');
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                    />
                                                </label>
                                            )}
                                        </div>
                                        {formData.returnType === 'file' && isUploadedReturnFileDataUrl && (
                                            <p className="text-xs text-muted mt-2" style={{ wordBreak: 'break-word' }}>
                                                File siap disimpan: {uploadedReturnFileName || 'File terunggah'}
                                            </p>
                                        )}
                                        {formData.returnType === 'file' && (
                                            <p className="text-xs text-muted mt-2">
                                                Upload langsung maksimal {formatBytes(MAX_DOWNLOAD_UPLOAD_BYTES)}. Untuk file besar gunakan URL eksternal.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                                        <input
                                            type="checkbox"
                                            className="form-checkbox"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        <div>
                                            <span className="font-medium text-sm">Produk Aktif</span>
                                            <p className="text-xs text-muted mb-0">Tampilkan di store</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setShowModal(false)}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={saving}
                                >
                                    {saving ? (
                                        <>
                                            <span className="spinner spinner-sm"></span>
                                            Simpan...
                                        </>
                                    ) : (
                                        'Simpan'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
