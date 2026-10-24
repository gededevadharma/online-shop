import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Testimonial from '@/models/Testimonial';

// GET active testimonials (cached)
export async function GET() {
    try {
        await connectDB();

        const testimonials = await Testimonial.find({ isActive: true })
            .sort({ createdAt: -1 })
            .select('-__v');

        const response = NextResponse.json({ testimonials }, { status: 200 });

        // Add Cache-Control header
        // s-maxage=3600: Cache in CDN for 1 hour
        // stale-while-revalidate=86400: Serve stale content for up to 1 day while updating in bg
        response.headers.set(
            'Cache-Control',
            'public, s-maxage=3600, stale-while-revalidate=86400'
        );

        return response;
    } catch (error) {
        console.error('Get testimonials error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
