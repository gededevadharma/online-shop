import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import connectDB from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';
import { getClientIP } from '@/lib/rateLimit';

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
        const action = searchParams.get('action');
        const entity = searchParams.get('entity');
        const adminUsername = searchParams.get('adminUsername');

        const skip = (page - 1) * limit;

        // Build filter
        const filter: Record<string, unknown> = {};
        if (action) filter.action = action;
        if (entity) filter.entity = entity;
        if (adminUsername) filter.adminUsername = adminUsername;

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(filter)
        ]);

        return NextResponse.json({
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching audit logs:', error);
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
        const ipAddress = getClientIP(request);
        const userAgent = request.headers.get('user-agent') || '';

        const log = await AuditLog.create({
            action: body.action,
            entity: body.entity,
            entityId: body.entityId,
            adminUsername: adminSession.username,
            changes: body.changes,
            status: body.status || 'SUCCESS',
            ipAddress,
            userAgent,
            details: body.details
        });

        return NextResponse.json(log, { status: 201 });
    } catch (error) {
        console.error('Error creating audit log:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
