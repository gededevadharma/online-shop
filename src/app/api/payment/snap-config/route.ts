import { NextResponse } from 'next/server';
import { getPublicMidtransConfig } from '@/lib/midtrans';

// Public: client key + environment untuk Snap.js (client key memang public by design)
export async function GET() {
    try {
        const cfg = await getPublicMidtransConfig();
        return NextResponse.json(
            { clientKey: cfg.clientKey, isProduction: cfg.isProduction },
            { status: 200 }
        );
    } catch {
        return NextResponse.json({ error: 'Konfigurasi pembayaran belum tersedia' }, { status: 500 });
    }
}
