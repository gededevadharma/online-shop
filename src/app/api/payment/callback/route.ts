import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import { handleMidtransNotification } from '@/lib/midtrans';
import { syncOrderPayment } from '@/lib/paymentSync';

// Midtrans webhook callback — dipanggil otomatis oleh Midtrans setiap ada update status
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Log callback for debugging
        console.log('Midtrans Notification:', JSON.stringify(body));

        // Verify signature and fetch fresh status from Midtrans
        let statusResponse: Record<string, string>;
        try {
            statusResponse = await handleMidtransNotification(body);
        } catch (verifyError) {
            console.error('Midtrans webhook verification failed:', verifyError);
            return NextResponse.json(
                { error: 'Invalid webhook signature' },
                { status: 403 }
            );
        }
        const { order_id } = statusResponse;

        await connectDB();

        // Find order
        const order = await Order.findOne({ referenceId: order_id }).populate('productId');
        if (!order) {
            return NextResponse.json(
                { error: 'Order tidak ditemukan' },
                { status: 404 }
            );
        }

        const syncResult = await syncOrderPayment(order_id, statusResponse);
        if (!syncResult?.order) {
            return NextResponse.json(
                { error: 'Order tidak ditemukan' },
                { status: 404 }
            );
        }

        return NextResponse.json({ message: 'OK' });
    } catch (error) {
        console.error('Midtrans callback error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
