/**
 * notify.ts — Pusat notifikasi LOKAL (pengganti Telegram Bot API).
 * Semua notifikasi disimpan di database lokal dan dibaca lewat
 * halaman Admin > Notifikasi. Tanpa API eksternal.
 */
import Notification from '@/models/Notification';

export type NotifyType = 'ORDER' | 'PAYMENT' | 'TICKET' | 'USER' | 'SYSTEM';

export async function notifyAdmin(
    type: NotifyType,
    title: string,
    message: string,
    data?: Record<string, unknown>
): Promise<void> {
    try {
        await Notification.create({ type, title, message, data: data || {}, isRead: false });
    } catch (e) {
        console.error('notifyAdmin gagal:', e);
    }
}

export async function getUnreadCount(): Promise<number> {
    try {
        return await Notification.countDocuments({ isRead: false });
    } catch {
        return 0;
    }
}

export async function markAllRead(): Promise<void> {
    await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
}

/** Kompatibilitas: pengganti sendTelegramNotification lama. */
export async function sendTelegramNotification(data: {
    orderId: string; customerName: string; customerEmail: string;
    productName: string; amount: number;
    status: 'success' | 'pending' | 'failed';
    paymentMethod?: string; transactionId?: string;
}): Promise<{ success: boolean }> {
    const title =
        data.status === 'success' ? 'Pembayaran BERHASIL' :
        data.status === 'pending' ? 'Pembayaran MENUNGGU' : 'Pembayaran GAGAL';
    await notifyAdmin(
        'PAYMENT', title,
        `${data.productName} — Rp ${data.amount.toLocaleString('id-ID')} oleh ${data.customerName} (${data.customerEmail})`,
        { orderId: data.orderId, paymentMethod: data.paymentMethod, transactionId: data.transactionId }
    );
    return { success: true };
}

export async function sendGroupNotification(data: {
    orderId: string; customerName: string; productName: string;
    amount: number; status: string;
}): Promise<void> {
    await notifyAdmin(
        'ORDER', 'Transaksi Baru',
        `Order ${data.orderId}: ${data.productName} Rp ${data.amount.toLocaleString('id-ID')} oleh ${data.customerName} — ${data.status}`,
        { orderId: data.orderId }
    );
}

export default { notifyAdmin, getUnreadCount, markAllRead, sendTelegramNotification, sendGroupNotification };
