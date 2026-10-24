import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Branding from '@/models/Branding';
import { BRAND_NAME, BRAND_LOGO_URL } from '@/lib/branding';

// Public: branding toko (nama, logo, favicon) — bisa diubah dari admin panel
export async function GET() {
    try {
        await connectDB();
        const b = await Branding.findOne().lean();

        return NextResponse.json({
            storeName: b?.storeName || BRAND_NAME,
            logoUrl: b?.logoUrl || BRAND_LOGO_URL,
            faviconUrl: b?.faviconUrl || '',
            // untuk cache-busting favicon di client
            updatedAt: (b as { updatedAt?: string } | null)?.updatedAt || null,
        }, { status: 200 });
    } catch (error) {
        console.error('Get branding error:', error);
        return NextResponse.json({
            storeName: BRAND_NAME,
            logoUrl: BRAND_LOGO_URL,
            faviconUrl: '',
        }, { status: 200 });
    }
}
