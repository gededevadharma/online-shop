import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Order from '@/models/Order';
import User from '@/models/User';
import Product from '@/models/Product';
import { getAdminSession } from '@/lib/auth';
import { syncOrderPayment } from '@/lib/paymentSync';

export async function GET() {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const pendingOrders = await Order.find({ status: 'pending' })
            .select('referenceId')
            .limit(30)
            .lean();

        if (pendingOrders.length > 0) {
            await Promise.all(
                pendingOrders.map((pendingOrder) => syncOrderPayment(pendingOrder.referenceId))
            );
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        // Get various stats
        const [
            totalUsers,
            newUsersToday,
            newUsersThisWeek,
            newUsersThisMonth,
            totalOrders,
            ordersToday,
            ordersThisWeek,
            ordersThisMonth,
            paidOrdersThisMonth,
            paidOrdersLastMonth,
            totalProducts,
            activeProducts,
            topProducts,
            topBuyers,
            recentOrders,
            ordersByStatus,
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startOfToday } }),
            User.countDocuments({ createdAt: { $gte: startOfWeek } }),
            User.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startOfToday } }),
            Order.countDocuments({ createdAt: { $gte: startOfWeek } }),
            Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.find({ status: 'paid', createdAt: { $gte: startOfMonth } }).lean(),
            Order.find({ status: 'paid', createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } }).lean(),
            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.find().sort({ totalSales: -1 }).limit(5).select('name thumbnail totalSales price').lean(),
            (async () => {
                const paid = await Order.find({ status: 'paid' }).select('userId amount').lean();
                const byUser = new Map<string, { totalSpent: number; orderCount: number }>();
                for (const o of paid) {
                    const cur = byUser.get(o.userId) || { totalSpent: 0, orderCount: 0 };
                    cur.totalSpent += o.amount || 0;
                    cur.orderCount += 1;
                    byUser.set(o.userId, cur);
                }
                const top = [...byUser.entries()]
                    .sort((a, b) => b[1].totalSpent - a[1].totalSpent)
                    .slice(0, 5);
                const out = [];
                for (const [uid, v] of top) {
                    const u = await User.findById(uid).select('name email').lean();
                    out.push({ _id: uid, totalSpent: v.totalSpent, orderCount: v.orderCount, user: u ? { name: u.name, email: u.email } : null });
                }
                return out;
            })(),
            Order.find()
                .populate('userId', 'name email')
                .populate('productId', 'name thumbnail')
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
            (async () => {
                const all = await Order.find().select('status amount').lean();
                const m = new Map<string, { count: number; total: number }>();
                for (const o of all) {
                    const cur = m.get(o.status) || { count: 0, total: 0 };
                    cur.count += 1;
                    cur.total += o.amount || 0;
                    m.set(o.status, cur);
                }
                return [...m.entries()].map(([st, v]) => ({ _id: st, count: v.count, total: v.total }));
            })(),
        ]);

        // Calculate revenue
        const revenueThisMonth = paidOrdersThisMonth.reduce((sum, o) => sum + (o.amount || 0), 0);
        const revenueLastMonth = paidOrdersLastMonth.reduce((sum, o) => sum + (o.amount || 0), 0);
        const revenueGrowth = revenueLastMonth > 0
            ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
            : 0;

        // Format orders by status
        const statusMap: Record<string, { count: number; total: number }> = {};
        ordersByStatus.forEach(s => {
            statusMap[s._id] = { count: s.count, total: s.total };
        });

        return NextResponse.json({
            users: {
                total: totalUsers,
                today: newUsersToday,
                thisWeek: newUsersThisWeek,
                thisMonth: newUsersThisMonth,
            },
            orders: {
                total: totalOrders,
                today: ordersToday,
                thisWeek: ordersThisWeek,
                thisMonth: ordersThisMonth,
                byStatus: statusMap,
            },
            revenue: {
                thisMonth: revenueThisMonth,
                lastMonth: revenueLastMonth,
                growth: revenueGrowth,
            },
            products: {
                total: totalProducts,
                active: activeProducts,
                top: topProducts,
            },
            topBuyers,
            recentOrders,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
