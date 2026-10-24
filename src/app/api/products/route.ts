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

// GET products (public or admin)
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const isAdmin = searchParams.get('admin') === 'true';

        if (isAdmin) {
            const adminSession = await getAdminSession();
            if (!adminSession) {
                return NextResponse.json(
                    { error: 'Unauthorized' },
                    { status: 401 }
                );
            }
        }

        await connectDB();

        const query = isAdmin ? {} : { isActive: true };
        const productsQuery = Product.find(query);

        if (!isAdmin) {
            productsQuery.select({ returnContent: 0 });
        }

        const products = await productsQuery
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json(
            { products },
            { 
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0'
                }
            }
        );
    } catch (error) {
        console.error('Error fetching products:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server', products: [] },
            { status: 500 }
        );
    }
}

// POST create new product (admin only)
export async function POST(request: NextRequest) {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await connectDB();

        const body = await request.json();

        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const description = typeof body.description === 'string' ? body.description.trim() : '';
        const category = typeof body.category === 'string' ? body.category.trim() : '';
        const returnType = body.returnType === 'file' ? 'file' : body.returnType === 'link' ? 'link' : null;
        const price = Number(body.price);
        const originalPrice = body.originalPrice === undefined || body.originalPrice === null || body.originalPrice === ''
            ? undefined
            : Number(body.originalPrice);
        const stock = Number.parseInt(String(body.stock ?? 0), 10);
        const isUnlimitedStock = body.isUnlimitedStock !== false;
        const isActive = body.isActive !== false;

        const rawImages = Array.isArray(body.images)
            ? body.images.filter((img: unknown): img is string => typeof img === 'string')
            : [];
        const storedImages: string[] = [];
        for (const img of rawImages) {
            const v = await normalizeMediaValueStored(img, 'product');
            if (v) storedImages.push(v);
        }
        const images = storedImages;
        const thumbnail = (await normalizeMediaValueStored(typeof body.thumbnail === 'string' ? body.thumbnail : '', 'thumb')) || images[0] || '';
        const videoShowcase = typeof body.videoShowcase === 'string' ? normalizeHttpUrl(body.videoShowcase) : undefined;
        const returnContent = typeof body.returnContent === 'string'
            ? (returnType === 'link' ? normalizeHttpUrl(body.returnContent) : body.returnContent.trim())
            : '';
        const tags = Array.isArray(body.tags)
            ? body.tags
                .filter((tag: unknown): tag is string => typeof tag === 'string')
                .map((tag: string) => tag.trim())
                .filter(Boolean)
            : [];

        // Validate required fields
        if (!name || !description || !thumbnail || !returnType || !returnContent || !category) {
            return NextResponse.json(
                { error: 'Field yang diperlukan harus diisi' },
                { status: 400 }
            );
        }

        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json(
                { error: 'Harga produk tidak valid' },
                { status: 400 }
            );
        }

        if (originalPrice !== undefined && (!Number.isFinite(originalPrice) || originalPrice < 0)) {
            return NextResponse.json(
                { error: 'Harga coret tidak valid' },
                { status: 400 }
            );
        }

        if (returnType === 'link' && !isValidHttpUrl(returnContent)) {
            return NextResponse.json(
                { error: 'URL akses produk tidak valid' },
                { status: 400 }
            );
        }

        if (!isUnlimitedStock && (!Number.isFinite(stock) || stock < 0)) {
            return NextResponse.json(
                { error: 'Stok produk tidak valid' },
                { status: 400 }
            );
        }

        if (videoShowcase && !isValidHttpUrl(videoShowcase)) {
            return NextResponse.json(
                { error: 'URL video showcase tidak valid' },
                { status: 400 }
            );
        }

        const product = await Product.create({
            name,
            description,
            price,
            originalPrice,
            thumbnail,
            images: images.length > 0 ? images : [thumbnail],
            videoShowcase,
            returnType,
            returnContent,
            category,
            tags,
            isActive,
            stock: isUnlimitedStock ? 0 : Math.max(0, stock || 0),
            isUnlimitedStock,
            totalSales: 0,
        });

        // Refresh route cache and tagged data used by homepage product list.
        revalidatePath('/', 'layout');
        revalidateTag('products', 'max');

        return NextResponse.json(
            { message: 'Produk berhasil dibuat', product },
            { status: 201 }
        );
    } catch (error) {
        console.error('Create product error:', error);

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
