import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import Inventory from '@/models/Inventory';
import AuditLog from '@/models/AuditLog';

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
        const inventory = await Inventory.findByIdAndUpdate(
            id,
            {
                quantity: body.quantity,
                reorderLevel: body.reorderLevel,
                location: body.location,
                updatedat: new Date()
            },
            { new: true }
        );

        if (!inventory) {
            return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
        }

        // Create audit log
        await AuditLog.create({
            action: 'UPDATE',
            entity: 'INVENTORY',
            entityId: id,
            adminUsername: adminSession.username,
            status: 'SUCCESS',
            changes: [
                { field: 'quantity', oldValue: '...', newValue: body.quantity.toString() }
            ]
        });

        return NextResponse.json(inventory);
    } catch (error) {
        console.error('Error updating inventory:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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

        const inventory = await Inventory.findById(id).populate('productId', 'name price');

        if (!inventory) {
            return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
        }

        return NextResponse.json(inventory);
    } catch (error) {
        console.error('Error fetching inventory:', error);
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

        const inventory = await Inventory.findByIdAndDelete(id);

        if (!inventory) {
            return NextResponse.json({ error: 'Inventory not found' }, { status: 404 });
        }

        // Create audit log
        await AuditLog.create({
            action: 'DELETE',
            entity: 'INVENTORY',
            entityId: id,
            adminUsername: adminSession.username,
            status: 'SUCCESS'
        });

        return NextResponse.json({ message: 'Inventory deleted successfully' });
    } catch (error) {
        console.error('Error deleting inventory:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
