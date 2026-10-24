import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { getSession } from '@/lib/auth';
import { createTransaction, getPublicMidtransConfig, chargeQRPayment, getSnapQrisUrl } from '@/lib/midtrans';
import { syncOrderPayment } from '@/lib/paymentSync';
import { v4 as uuidv4 } from 'uuid';

// Batas transaksi pending per user
const MAX_PENDING_PER_USER = 2;
// Masa berlaku pembayaran (menit) — sesuai permintaan: 1 jam
const PAYMENT_EXPIRY_MINUTES = 60;

// POST create new order + Snap transaction (QRIS-only, via snap.pay popup — tanpa redirect)
export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !('id' in session)) {
            return NextResponse.json(
                { error: 'Silakan login terlebih dahulu' },
                { status: 401 }
            );
        }

        const { productId, buyerName, buyerEmail, buyerPhone } = await request.json();

        // Validate input
        if (!productId || !buyerName || !buyerEmail || !buyerPhone) {
            return NextResponse.json(
                { error: 'Semua field harus diisi' },
                { status: 400 }
            );
        }

        await connectDB();

        // Sapu order pending yang sudah kedaluwarsa (QR/Snap lewat masa berlaku
        // tanpa pembayaran) agar tidak menahan slot pending selamanya.
        const nowSweep = new Date();
        const stalePendings = await Order.find({ userId: session.id, status: 'pending' });
        for (const stale of stalePendings) {
            const staleAny = stale as unknown as Record<string, unknown>;
            const expRaw = staleAny.qrExpiresAt || staleAny.snapExpiresAt;
            const createdMs = new Date(String(staleAny.createdAt)).getTime();
            const expMs = expRaw
                ? new Date(String(expRaw)).getTime()
                : createdMs + PAYMENT_EXPIRY_MINUTES * 60_000;
            if (!Number.isNaN(expMs) && expMs <= nowSweep.getTime()) {
                await Order.updateOne(
                    { _id: staleAny._id },
                    { $set: { status: 'cancelled', cancelledReason: 'kedaluwarsa otomatis (sweep)', updatedAt: nowSweep.toISOString() } }
                );
            }
        }

        // Batasi maksimal 2 transaksi pending per user
        const pendingCount = await Order.countDocuments({ userId: session.id, status: 'pending' });
        if (pendingCount >= MAX_PENDING_PER_USER) {
            return NextResponse.json(
                { error: `Kamu punya ${pendingCount} pembayaran pending. Selesaikan atau batalkan dulu sebelum membuat pesanan baru.` },
                { status: 400 }
            );
        }

        // Get product
        const product = await Product.findById(productId);
        if (!product || !product.isActive) {
            return NextResponse.json(
                { error: 'Produk tidak ditemukan atau tidak aktif' },
                { status: 404 }
            );
        }

        // Check stock
        if (!product.isUnlimitedStock && product.stock <= 0) {
            return NextResponse.json(
                { error: 'Stok produk habis' },
                { status: 400 }
            );
        }

        // Generate reference ID
        const referenceId = `ORD-${uuidv4()}`;

        // Create order
        const order = await Order.create({
            userId: session.id,
            productId: product._id,
            referenceId,
            status: 'pending',
            amount: product.price,
            buyerName,
            buyerEmail,
            buyerPhone,
            paymentMethod: product.price === 0 ? 'GRATIS' : 'QRIS',
        });

        // Produk GRATIS (harga 0): langsung tandai lunas dan kirim, tanpa pembayaran
        if (product.price === 0) {
            const { deliverOrder } = await import('@/lib/paymentSync');
            await Order.findByIdAndUpdate(order._id, {
                status: 'paid',
                paidAt: new Date().toISOString(),
            });
            await deliverOrder(order._id.toString());
            return NextResponse.json({
                message: 'Produk gratis berhasil diklaim',
                order: {
                    id: order._id,
                    referenceId: order.referenceId,
                    amount: 0,
                    productName: product.name,
                },
                isFree: true,
            });
        }

        // Strategi pembayaran: coba Core API dulu (QR tampil di modal card sendiri,
        // white-label tanpa branding Midtrans). Kalau channel belum aktif di akun
        // (402 "not activated"), fallback otomatis ke Snap popup QRIS-only.
        const itemDetails = [{
            id: product._id.toString(),
            price: product.price,
            quantity: 1,
            name: product.name.substring(0, 50),
        }];
        const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MINUTES * 60 * 1000).toISOString();

        try {
            const charge = await chargeQRPayment({
                orderId: referenceId,
                grossAmount: product.price,
                firstName: buyerName,
                email: buyerEmail,
                phone: buyerPhone,
                expiryMinutes: PAYMENT_EXPIRY_MINUTES,
                itemDetails,
            });

            await Order.findByIdAndUpdate(order._id, {
                qrCodeUrl: charge.qrCodeUrl,
                qrExpiresAt: expiresAt,
                midtransOrderId: referenceId,
                trxId: charge.transaction_id,
                paymentMethod: charge.payment_type === 'gopay' ? 'GoPay' : 'QRIS',
            });

            return NextResponse.json({
                message: 'Order berhasil dibuat',
                order: {
                    id: order._id,
                    referenceId: order.referenceId,
                    amount: order.amount,
                    productName: product.name,
                },
                qris: {
                    qrCodeUrl: charge.qrCodeUrl,
                    expiresAt,
                    amount: product.price,
                    method: charge.payment_type,
                },
            }, { status: 201 });

        } catch (qrError) {
            const msg = qrError instanceof Error ? qrError.message.toLowerCase() : '';
            const notActivated = msg.includes('not activated');
            if (!notActivated) {
                console.error('QR charge error:', qrError);
                await Order.findByIdAndDelete(order._id);
                return NextResponse.json({ error: 'Gagal membuat pembayaran' }, { status: 500 });
            }
            console.warn('Core API channel belum aktif, fallback ke Snap popup:', qrError);
        }

        // Fallback: Snap transaction (popup snap.pay, tanpa redirect halaman).
        // Metode mengikuti dashboard Midtrans: QRIS + GoPay/GoPayLater.
        try {
            const transaction = await createTransaction({
                orderId: referenceId,
                grossAmount: product.price,
                firstName: buyerName,
                email: buyerEmail,
                phone: buyerPhone,
                appUrl: request.nextUrl.origin,
                enabledPayments: ['qris', 'gopay'],
                expiryMinutes: PAYMENT_EXPIRY_MINUTES,
                itemDetails,
            });

            if (!transaction || !transaction.token) {
                await Order.findByIdAndDelete(order._id);
                return NextResponse.json(
                    { error: 'Gagal membuat pembayaran' },
                    { status: 400 }
                );
            }

            const pubCfg = await getPublicMidtransConfig();

            // Coba ambil QR Snap langsung di sini (beberapa detik) agar frontend
            // sering kali langsung dapat QR tanpa polling. Kalau belum siap,
            // frontend membuka modal dulu dengan status loading + polling mandiri.
            let snapQrUrl: string | undefined;
            let snapQrExpiresAt: string | undefined;
            try {
                const snapQr = await getSnapQrisUrl(transaction.token, { attempts: 3, delayMs: 1500 });
                if (snapQr) {
                    snapQrUrl = snapQr.qrCodeUrl;
                    snapQrExpiresAt = snapQr.expiresAt;
                }
            } catch (e) {
                console.warn('QR Snap belum siap saat order dibuat:', e instanceof Error ? e.message : e);
            }

            await Order.findByIdAndUpdate(order._id, {
                snapToken: transaction.token,
                snapRedirectUrl: transaction.redirect_url,
                snapExpiresAt: expiresAt,
                midtransOrderId: referenceId,
                ...(snapQrUrl ? { qrCodeUrl: snapQrUrl, qrExpiresAt: snapQrExpiresAt || expiresAt } : {}),
            });

            return NextResponse.json({
                message: 'Order berhasil dibuat',
                order: {
                    id: order._id,
                    referenceId: order.referenceId,
                    amount: order.amount,
                    productName: product.name,
                },
                snap: {
                    token: transaction.token,
                    redirectUrl: transaction.redirect_url,
                    qrCodeUrl: snapQrUrl,
                    clientKey: pubCfg.clientKey,
                    isProduction: pubCfg.isProduction,
                    expiresAt: snapQrExpiresAt || expiresAt,
                },
            }, { status: 201 });

        } catch (paymentError) {
            console.error('Snap transaction error:', paymentError);
            await Order.findByIdAndDelete(order._id);

            let paymentErrorMessage = 'Gagal membuat pembayaran';
            if (paymentError instanceof Error && paymentError.message) {
                const lowerMessage = paymentError.message.toLowerCase();
                if (lowerMessage.includes('401') || lowerMessage.includes('access denied') || lowerMessage.includes('unauthorized')) {
                    paymentErrorMessage = 'Konfigurasi pembayaran tidak valid. Silakan hubungi admin.';
                } else {
                    paymentErrorMessage = paymentError.message;
                }
            }

            return NextResponse.json(
                { error: paymentErrorMessage },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error('Create order error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}

// GET user orders
export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session || !('id' in session)) {
            return NextResponse.json(
                { error: 'Silakan login terlebih dahulu' },
                { status: 401 }
            );
        }

        await connectDB();

        const pendingOrders = await Order.find({ userId: session.id, status: 'pending' })
            .select('referenceId')
            .limit(10)
            .lean();

        if (pendingOrders.length > 0) {
            await Promise.all(
                pendingOrders.map((pendingOrder) => syncOrderPayment(pendingOrder.referenceId))
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query: any = { userId: session.id };
        if (status) {
            query.status = status;
        }

        const orders = await Order.find(query)
            .populate('productId', 'name thumbnail price returnType')
            .sort({ createdAt: -1 });

        return NextResponse.json({ orders }, { status: 200 });
    } catch (error) {
        console.error('Get orders error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
