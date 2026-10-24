import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { connectDB } from '@/lib/localdb';
import Order from '@/models/Order';
import { getPublicMidtransConfig } from '@/lib/midtrans';

/**
 * GET /api/orders/[id]/snap-qr
 * Ambil URL gambar QRIS dari transaksi Snap (tanpa membuka popup/iframe Snap).
 * Backend memanggil Snap transaction details API dan mengekstrak result.qris_url.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const clientVer = request.nextUrl.searchParams.get('cv') || '?';
        console.log(`[snap-qr] Request for order: ${id} (cv=${clientVer})`);

        const session = await getSession();
        if (!session || !('id' in session)) {
            return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
        }
        await connectDB();

        const order = await Order.findOne({ _id: id, userId: session.id }).lean();
        if (!order) {
            return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
        }
        if (order.status !== 'pending') {
            return NextResponse.json({ error: 'Pesanan tidak dalam status pending' }, { status: 400 });
        }
        if (!order.snapToken) {
            return NextResponse.json({ error: 'Token Snap tidak ditemukan' }, { status: 400 });
        }

        const pubCfg = await getPublicMidtransConfig();
        const isProduction = !!pubCfg?.isProduction;
        const base = isProduction
            ? 'https://app.midtrans.com'
            : 'https://app.sandbox.midtrans.com';

        // Ambil detail transaksi Snap — berisi result.qris_url
        // Retry cepat 1 detik (dipanggil dalam loop polling frontend)
        let detail: any = null;
        let lastErr = '';
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const res = await fetch(
                    `${base}/snap/v1/transactions/${order.snapToken}`,
                    { headers: { 'Accept': 'application/json' }, cache: 'no-store' }
                );
                if (res.ok) {
                    detail = await res.json();
                    if (detail?.result?.qris_url) break;
                } else {
                    lastErr = `HTTP ${res.status}`;
                }
            } catch (e) {
                lastErr = e instanceof Error ? e.message : 'fetch gagal';
            }
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
        }
        if (!detail?.result) {
            return NextResponse.json(
                { error: 'Gagal mengambil detail pembayaran dari Midtrans' + (lastErr ? `: ${lastErr}` : '') },
                { status: 502 }
            );
        }
        const result = detail.result;

        const qrCodeUrl: string | undefined = result.qris_url;
        if (!qrCodeUrl) {
            return NextResponse.json(
                { error: 'QR belum tersedia untuk transaksi ini', retryable: true },
                { status: 404 }
            );
        }

        // Simpan ke order agar tidak fetch berulang
        const expiresAt = result.qris_expiration_raw
            ? new Date(result.qris_expiration_raw.replace(' +0700', '+07:00')).toISOString()
            : order.snapExpiresAt;

        await Order.findByIdAndUpdate(order._id, {
            qrCodeUrl,
            qrExpiresAt: expiresAt,
        });

        return NextResponse.json({
            qrCodeUrl,
            expiresAt,
            amount: order.amount,
            acquirer: result.qris_acquirer || undefined,
        });
    } catch (error) {
        console.error('snap-qr error:', error);
        return NextResponse.json({ error: 'Gagal mengambil QR pembayaran' }, { status: 500 });
    }
}
