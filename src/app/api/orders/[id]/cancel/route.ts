import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getSession } from '@/lib/auth';
import { cancelTransaction } from '@/lib/midtrans';
import { syncOrderPayment } from '@/lib/paymentSync';

// POST /api/orders/[id]/cancel — batalkan pembayaran pending milik sendiri
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session || !('id' in session)) {
            return NextResponse.json(
                { error: 'Silakan login terlebih dahulu' },
                { status: 401 }
            );
        }

        const { id } = await params;
        await connectDB();

        const order = await Order.findOne({ _id: id, userId: session.id });
        if (!order) {
            return NextResponse.json(
                { error: 'Order tidak ditemukan' },
                { status: 404 }
            );
        }

        if (order.status !== 'pending') {
            return NextResponse.json(
                { error: `Order sudah ${order.status}, tidak bisa dibatalkan` },
                { status: 400 }
            );
        }

        // Coba batalkan di Midtrans dulu (best effort).
        // Kalau ternyata sudah lunas/kedaluwarsa, sinkronkan status aslinya.
        try {
            await cancelTransaction(order.midtransOrderId || order.referenceId);
        } catch (cancelError) {
            console.warn('Midtrans cancel gagal, sinkronkan status:', cancelError);
            await syncOrderPayment(order.referenceId);
            const refreshed = await Order.findById(order._id);
            if (refreshed && refreshed.status !== 'pending') {
                return NextResponse.json(
                    {
                        error: `Tidak bisa dibatalkan — status pembayaran sudah ${refreshed.status}`,
                        status: refreshed.status,
                    },
                    { status: 400 }
                );
            }
            // Masih pending tapi cancel API gagal: tetap tandai cancelled lokal
            // agar user tidak terjebak (webhook tidak akan mengubahnya lagi
            // karena transaksi QRIS yang dibatalkan tidak bisa settle).
        }

        order.status = 'cancelled';
        await order.save();

        return NextResponse.json(
            { message: 'Pembayaran dibatalkan', order: { id: order._id, status: order.status } },
            { status: 200 }
        );
    } catch (error) {
        console.error('Cancel order error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
