import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Discount from '@/models/Discount';
import AuditLog from '@/models/AuditLog';

export async function GET(request: NextRequest) {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const active = searchParams.get('active');

        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};
        if (active !== null) {
            filter.isActive = active === 'true';
        }

        const [discounts, total] = await Promise.all([
            Discount.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Discount.countDocuments(filter)
        ]);

        return NextResponse.json({
            discounts,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        console.error('Error fetching discounts:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();

        // Validate code format
        if (!/^[A-Z0-9]{3,20}$/.test(body.code)) {
            return NextResponse.json({
                error: 'Code harus uppercase, 3-20 karakter alphanumeric'
            }, { status: 400 });
        }

        // Check if code exists
        const existing = await Discount.findOne({ code: body.code });
        if (existing) {
            return NextResponse.json({ error: 'Kode diskon sudah ada' }, { status: 400 });
        }

        const discount = await Discount.create({
            code: body.code,
            type: body.type,
            value: body.value,
            minAmount: body.minAmount,
            maxDiscount: body.maxDiscount,
            usageLimit: body.usageLimit,
            expiryDate: body.expiryDate,
            applicable: body.applicable || 'ALL',
            applicableProductIds: body.applicableProductIds,
            applicableCategories: body.applicableCategories,
            isActive: body.isActive !== false
        });

        // Create audit log
        await AuditLog.create({
            action: 'CREATE',
            entity: 'DISCOUNT',
            entityId: discount._id.toString(),
            adminUsername: adminSession.username,
            status: 'SUCCESS',
            details: `Created discount code ${body.code}`
        });

        return NextResponse.json(discount, { status: 201 });
    } catch (error) {
        console.error('Error creating discount:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
