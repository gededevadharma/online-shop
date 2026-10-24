import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import connectDB from '@/lib/mongodb';
import Product from '@/models/Product';
import { getAdminSession } from '@/lib/auth';
import { normalizeMediaValueStored } from '@/lib/media-upload';

const normalizeHttpUrl = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const isDataUrl = (value: string) => value.startsWith('data:');

const normalizeMediaValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return isDataUrl(trimmed) ? trimmed : normalizeHttpUrl(trimmed);
};

const isValidHttpUrl = (value: string) => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

// GET single product
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await connectDB();

        const { id } = await params;
        const adminSession = await getAdminSession();

        const product = await Product.findById(id).select(
            adminSession ? {} : { returnContent: 0 }
        );

        if (!product) {
            return NextResponse.json(
                { error: 'Produk tidak ditemukan' },
                { status: 404 }
            );
        }

        const response = NextResponse.json({ product }, { status: 200 });

        // Smart Caching: No cache for admin, aggressive cache for public
        if (adminSession) {
            response.headers.set('Cache-Control', 'no-store, max-age=0');
        } else {
            // Cache for 1 hour, revalidate in background for 1 day
            response.headers.set(
                'Cache-Control',
                'public, s-maxage=3600, stale-while-revalidate=300'
            );
        }

        return response;
    } catch (error) {
        console.error('Get product error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}

// PUT update product (admin only)
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();

        const { id } = await params;
        const body = await request.json();

        const updateData: Record<string, unknown> = {};

        if ('name' in body) {
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name) {
                return NextResponse.json({ error: 'Nama produk tidak valid' }, { status: 400 });
            }
            updateData.name = name;
        }

        if ('description' in body) {
            const description = typeof body.description === 'string' ? body.description.trim() : '';
            if (!description) {
                return NextResponse.json({ error: 'Deskripsi produk tidak valid' }, { status: 400 });
            }
            updateData.description = description;
        }

        if ('category' in body) {
            const category = typeof body.category === 'string' ? body.category.trim() : '';
            if (!category) {
                return NextResponse.json({ error: 'Kategori produk tidak valid' }, { status: 400 });
            }
            updateData.category = category;
        }

        if ('price' in body) {
            const price = Number(body.price);
            if (!Number.isFinite(price) || price < 0) {
                return NextResponse.json({ error: 'Harga produk tidak valid' }, { status: 400 });
            }
            updateData.price = price;
        }

        if ('originalPrice' in body) {
            if (body.originalPrice === '' || body.originalPrice === null || body.originalPrice === undefined) {
                updateData.originalPrice = undefined;
            } else {
                const originalPrice = Number(body.originalPrice);
                if (!Number.isFinite(originalPrice) || originalPrice < 0) {
                    return NextResponse.json({ error: 'Harga coret tidak valid' }, { status: 400 });
                }
                updateData.originalPrice = originalPrice;
            }
        }

        if ('returnType' in body) {
            if (body.returnType !== 'link' && body.returnType !== 'file') {
                return NextResponse.json({ error: 'Tipe produk tidak valid' }, { status: 400 });
            }
            updateData.returnType = body.returnType;
        }

        if ('returnContent' in body) {
            const currentReturnType = (updateData.returnType || body.returnType) as 'link' | 'file' | undefined;
            if (typeof body.returnContent !== 'string' || !body.returnContent.trim()) {
                return NextResponse.json({ error: 'Konten produk tidak valid' }, { status: 400 });
            }

            const normalizedReturn = currentReturnType === 'link'
                ? normalizeHttpUrl(body.returnContent)
                : body.returnContent.trim();

            if (currentReturnType === 'link' && !isValidHttpUrl(normalizedReturn)) {
                return NextResponse.json({ error: 'URL akses produk tidak valid' }, { status: 400 });
            }

            updateData.returnContent = normalizedReturn;
        }

        if ('videoShowcase' in body) {
            if (!body.videoShowcase) {
                updateData.videoShowcase = undefined;
            } else if (typeof body.videoShowcase === 'string') {
                const normalizedVideo = normalizeHttpUrl(body.videoShowcase);
                if (!isValidHttpUrl(normalizedVideo)) {
                    return NextResponse.json({ error: 'URL video showcase tidak valid' }, { status: 400 });
                }
                updateData.videoShowcase = normalizedVideo;
            }
        }

        if ('images' in body) {
            if (!Array.isArray(body.images)) {
                return NextResponse.json({ error: 'Format galeri produk tidak valid' }, { status: 400 });
            }

            const normalizedImages: string[] = [];
            for (const img of body.images.filter((x: unknown): x is string => typeof x === 'string')) {
                const v = await normalizeMediaValueStored(img, 'product');
                if (v) normalizedImages.push(v);
            }

            updateData.images = normalizedImages;
        }

        if ('thumbnail' in body) {
            const normalizedThumbnail = typeof body.thumbnail === 'string' ? await normalizeMediaValueStored(body.thumbnail, 'thumb') : '';
            if (!normalizedThumbnail) {
                return NextResponse.json({ error: 'Thumbnail produk tidak valid' }, { status: 400 });
            }
            updateData.thumbnail = normalizedThumbnail;
        }

        if ('tags' in body) {
            const tags = Array.isArray(body.tags)
                ? body.tags
                    .filter((tag: unknown): tag is string => typeof tag === 'string')
                    .map((tag: string) => tag.trim())
                    .filter(Boolean)
                : [];
            updateData.tags = tags;
        }

        if ('isActive' in body) {
            updateData.isActive = body.isActive !== false;
        }

        if ('isUnlimitedStock' in body) {
            updateData.isUnlimitedStock = body.isUnlimitedStock !== false;
        }

        if ('stock' in body) {
            const stock = Number.parseInt(String(body.stock ?? 0), 10);
            if (!Number.isFinite(stock) || stock < 0) {
                return NextResponse.json({ error: 'Stok produk tidak valid' }, { status: 400 });
            }
            updateData.stock = stock;
        }

        if (
            (updateData.isUnlimitedStock === false || body.isUnlimitedStock === false) &&
            updateData.stock !== undefined &&
            typeof updateData.stock === 'number' &&
            updateData.stock < 0
        ) {
            return NextResponse.json({ error: 'Stok produk tidak valid' }, { status: 400 });
        }

        if (Array.isArray(updateData.images) && !updateData.thumbnail) {
            const firstImage = (updateData.images as string[])[0];
            if (firstImage) {
                updateData.thumbnail = firstImage;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Tidak ada data yang diupdate' }, { status: 400 });
        }

        const product = await Product.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!product) {
            return NextResponse.json(
                { error: 'Produk tidak ditemukan' },
                { status: 404 }
            );
        }

        // Revalidate cache
        revalidatePath('/', 'layout');
        revalidatePath(`/product/${id}`);
        revalidateTag('products', 'max');

        return NextResponse.json(
            { message: 'Produk berhasil diupdate', product },
            { status: 200 }
        );
    } catch (error) {
        console.error('Update product error:', error);

        if (error instanceof Error) {
            return NextResponse.json(
                { error: error.message || 'Terjadi kesalahan server' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}

// DELETE product (admin only)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();

        const { id } = await params;
        const product = await Product.findByIdAndDelete(id);

        if (!product) {
            return NextResponse.json(
                { error: 'Produk tidak ditemukan' },
                { status: 404 }
            );
        }

        // Revalidate cache
        revalidatePath('/', 'layout');
        revalidatePath(`/product/${id}`);
        revalidateTag('products', 'max');

        return NextResponse.json(
            { message: 'Produk berhasil dihapus' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Delete product error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
