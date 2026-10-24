import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { getSession } from '@/lib/auth';
import { syncOrderPayment } from '@/lib/paymentSync';

// GET order by reference ID (for checking payment status)
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

        const { searchParams } = new URL(request.url);
        const referenceId = searchParams.get('ref');

        if (!referenceId) {
            return NextResponse.json(
                { error: 'Reference ID tidak ditemukan' },
                { status: 400 }
            );
        }

        const existingOrder = await Order.findOne({
            referenceId,
            userId: session.id
        });

        if (!existingOrder) {
            return NextResponse.json(
                { error: 'Order tidak ditemukan' },
                { status: 404 }
            );
        }

        await syncOrderPayment(referenceId);

        const order = await Order.findOne({
            referenceId,
            userId: session.id
        }).populate('productId', 'name thumbnail price returnType');

        if (!order) {
            return NextResponse.json(
                { error: 'Order tidak ditemukan' },
                { status: 404 }
            );
        }

        // Only return content if payment is successful
        const responseData = {
            id: order._id,
            referenceId: order.referenceId,
            status: order.status,
            amount: order.amount,
            product: order.productId,
            buyerName: order.buyerName,
            buyerEmail: order.buyerEmail,
            buyerPhone: order.buyerPhone,
            trxId: order.trxId,
            paymentMethod: order.paymentMethod,
            paymentChannel: order.paymentChannel,
            paidAt: order.paidAt,
            createdAt: order.createdAt,
            returnContent: order.status === 'paid' ? order.returnContent : null,
            // QRIS: untuk lanjutkan pembayaran pending
            qrCodeUrl: order.qrCodeUrl || null,
            qrExpiresAt: order.qrExpiresAt || null,
        };

        return NextResponse.json({ order: responseData }, { status: 200 });
    } catch (error) {
        console.error('Get order status error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
