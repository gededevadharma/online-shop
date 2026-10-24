import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { hashPassword, generateToken, UserPayload } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        // Validate input
        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password harus diisi' },
                { status: 400 }
            );
        }

        // Verify local CAPTCHA
        // Turnstile dinonaktifkan atas permintaan user

        await connectDB();

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return NextResponse.json(
                { error: 'Email sudah terdaftar' },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await User.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            name: email.split('@')[0], // Default name from email part
            phone: '',
        });

        // Generate token
        const payload: UserPayload = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: 'user',
        };
        const token = generateToken(payload);

        // Create response with cookie
        const response = NextResponse.json(
            { message: 'Registrasi berhasil', user: { id: user._id, email: user.email, name: user.name } },
            { status: 201 }
        );

        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
