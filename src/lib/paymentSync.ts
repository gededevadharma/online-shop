/**
 * paymentSync.ts — Sinkronisasi status pembayaran dari Midtrans ke database lokal.
 */
import Order from '@/models/Order';
import Product from '@/models/Product';
import connectDB from '@/lib/mongodb';
import { getTransactionStatus } from '@/lib/midtrans';
import { notifyAdmin } from '@/lib/notify';

interface MidtransStatusLike {
    order_id?: string;
    transaction_status?: string;
    fraud_status?: string;
    payment_type?: string;
    transaction_id?: string;
    transaction_time?: string;
    settlement_time?: string;
    store?: string;
    permata_va_number?: string;
    biller_code?: string;
    bill_key?: string;
    va_numbers?: Array<{ bank?: string; va_number?: string }>;
}

function normalizeOrderStatus(midtransStatus?: string, fraudStatus?: string): {
    status: 'pending' | 'paid' | 'failed' | 'cancelled';
    shouldDeliver: boolean;
} {
    if (midtransStatus === 'capture') {
        if (fraudStatus === 'challenge') {
            return { status: 'pending', shouldDeliver: false };
        }

        if (fraudStatus === 'accept') {
            return { status: 'paid', shouldDeliver: true };
        }
    }

    if (midtransStatus === 'settlement') {
        return { status: 'paid', shouldDeliver: true };
    }

    if (midtransStatus === 'cancel' || midtransStatus === 'deny' || midtransStatus === 'expire' || midtransStatus === 'failure') {
        return { status: 'failed', shouldDeliver: false };
    }

    if (midtransStatus === 'refund' || midtransStatus === 'partial_refund' || midtransStatus === 'chargeback') {
        return { status: 'cancelled', shouldDeliver: false };
    }

    return { status: 'pending', shouldDeliver: false };
}

function extractPaymentChannel(statusData: MidtransStatusLike): string | undefined {
    if (Array.isArray(statusData.va_numbers) && statusData.va_numbers.length > 0) {
        const va = statusData.va_numbers[0];
        if (va.bank && va.va_number) {
            return `${va.bank.toUpperCase()} ${va.va_number}`;
        }
    }

    if (statusData.permata_va_number) {
        return `PERMATA ${statusData.permata_va_number}`;
    }

    if (statusData.biller_code && statusData.bill_key) {
        return `${statusData.biller_code}/${statusData.bill_key}`;
    }

    if (statusData.store) {
        return statusData.store;
    }

    return undefined;
}

/**
 * Sinkronkan satu order dengan status terbaru dari Midtrans.
 * Mengembalikan { order, justDelivered } atau null bila order tak ditemukan.
 */
export async function syncOrderPayment(referenceId: string, statusData?: MidtransStatusLike) {
    await connectDB();

    const order = await Order.findOne({ referenceId });
    if (!order) return null;

    let data = statusData;
    if (!data) {
        try {
            data = (await getTransactionStatus(referenceId)) as MidtransStatusLike;
        } catch (e) {
            console.warn('syncOrderPayment: gagal ambil status Midtrans', e);
            return { order, justDelivered: false };
        }
    }

    const { status, shouldDeliver } = normalizeOrderStatus(data.transaction_status, data.fraud_status);
    const wasPaid = order.status === 'paid';

    order.status = status;
    order.paymentMethod = data.payment_type || order.paymentMethod || 'E-Payment';
    order.paymentChannel = extractPaymentChannel(data) || order.paymentChannel;
    if (data.transaction_id) order.trxId = data.transaction_id;
    if (status === 'paid' && !order.paidAt) {
        order.paidAt = data.settlement_time || data.transaction_time || new Date().toISOString();
    }

    let justDelivered = false;

    if (shouldDeliver && !order.isDelivered) {
        const product = await Product.findById(order.productId);
        if (product) {
            order.returnContent = product.returnContent;
            if (!product.isUnlimitedStock && product.stock > 0) {
                product.stock = Math.max(0, product.stock - 1);
            }
            product.totalSales = (product.totalSales || 0) + 1;
            await product.save();
        }
        order.isDelivered = true;
        order.deliveredAt = new Date().toISOString();
        justDelivered = true;
    }

    await order.save();

    if (justDelivered && !wasPaid) {
        const product = await Product.findById(order.productId);
        await notifyAdmin(
            'PAYMENT',
            'Pembayaran BERHASIL (Midtrans)',
            `${(product as { name?: string } | null)?.name || 'Produk'} — Rp ${order.amount.toLocaleString('id-ID')} oleh ${order.buyerName}. Ref: ${referenceId}`,
            { orderId: order._id, referenceId }
        );
    }

    const populated = await Order.findOne({ referenceId }).populate('productId');
    return { order: populated || order, justDelivered };
}

export async function deliverOrder(orderId: string) {
    const order = await Order.findById(orderId).populate('productId');
    if (!order || order.status !== 'paid' || order.isDelivered) return order;
    const product = order.productId as { returnContent?: string } | string | null | undefined;
    if (product && typeof product === 'object') {
        order.returnContent = product.returnContent;
    }
    order.isDelivered = true;
    order.deliveredAt = new Date().toISOString();
    await order.save();
    return order;
}

export default { syncOrderPayment, deliverOrder };
