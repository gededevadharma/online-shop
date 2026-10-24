import { NextResponse } from 'next/server';
import { getTurnstileSiteKey } from '@/lib/turnstile';

// Public: kembalikan site key untuk widget Turnstile (site key bersifat publik)
export async function GET() {
    try {
        const siteKey = await getTurnstileSiteKey();
        return NextResponse.json({ siteKey }, { status: 200 });
    } catch {
        return NextResponse.json({ siteKey: '' }, { status: 200 });
    }
}
