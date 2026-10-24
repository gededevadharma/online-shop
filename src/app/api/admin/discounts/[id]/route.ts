import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Discount from '@/models/Discount';
import AuditLog from '@/models/AuditLog';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const discount = await Discount.findById(id).lean();

        if (!discount) {
            return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
        }

        return NextResponse.json(discount);
    } catch (error) {
        console.error('Error fetching discount:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();

        const discount = await Discount.findByIdAndUpdate(
            id,
            {
                type: body.type,
                value: body.value,
                minAmount: body.minAmount,
                maxDiscount: body.maxDiscount,
                usageLimit: body.usageLimit,
                expiryDate: body.expiryDate,
                applicable: body.applicable,
                applicableProductIds: body.applicableProductIds,
                applicableCategories: body.applicableCategories,
                isActive: body.isActive
            },
            { new: true }
        );

        if (!discount) {
            return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
        }

        // Create audit log
        await AuditLog.create({
            action: 'UPDATE',
            entity: 'DISCOUNT',
            entityId: id,
            adminUsername: adminSession.username,
            status: 'SUCCESS'
        });

        return NextResponse.json(discount);
    } catch (error) {
        console.error('Error updating discount:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const adminSession = await getAdminSession();
        if (!adminSession) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const discount = await Discount.findByIdAndDelete(id);

        if (!discount) {
            return NextResponse.json({ error: 'Discount not found' }, { status: 404 });
        }

        // Create audit log
        await AuditLog.create({
            action: 'DELETE',
            entity: 'DISCOUNT',
            entityId: id,
            adminUsername: adminSession.username,
            status: 'SUCCESS',
            details: `Deleted discount code ${discount.code}`
        });

        return NextResponse.json({ message: 'Discount deleted successfully' });
    } catch (error) {
        console.error('Error deleting discount:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
