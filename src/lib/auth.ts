import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import config from './config';

const JWT_SECRET = config.auth.jwtSecret;

export interface UserPayload {
    id: string;
    email: string;
    name: string;
    role: 'user' | 'admin';
}

export interface AdminPayload {
    username: string;
    role: 'admin';
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: UserPayload | AdminPayload, expiresIn: string = '7d'): string {
    const options: SignOptions = {
        expiresIn: expiresIn as jwt.SignOptions['expiresIn']
    };
    return jwt.sign(payload as object, JWT_SECRET, options);
}

export function verifyToken(token: string): UserPayload | AdminPayload | null {
    try {
        return jwt.verify(token, JWT_SECRET) as UserPayload | AdminPayload;
    } catch {
        return null;
    }
}

export async function getSession(): Promise<UserPayload | AdminPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;

    if (!token) {
        return null;
    }

    return verifyToken(token);
}

export async function getAdminSession(): Promise<AdminPayload | null> {
    const cookieStore = await cookies();

    // 1. Cek admin token (legacy)
    const token = cookieStore.get('admin_token')?.value;
    if (token) {
        const payload = verifyToken(token);
        if (payload && 'role' in payload && payload.role === 'admin') {
            return payload as AdminPayload;
        }
    }

    // 2. Cek user login biasa — jika emailnya email admin, beri akses admin
    const userSession = await getSession();
    const userEmail = userSession && 'email' in userSession ? userSession.email : null;
    if (userEmail && isAdminEmail(userEmail)) {
        return { username: userEmail, role: 'admin' };
    }

    return null;
}

export const ADMIN_EMAIL = 'admin@example.com';

export function isAdminEmail(email?: string | null): boolean {
    if (!email) return false;
    const configured = config.auth.adminEmail || ADMIN_EMAIL;
    return email.toLowerCase() === configured.toLowerCase();
}

export function verifyAdmin(username: string, password: string): boolean {
    const adminUsername = config.auth.adminUsername;
    const adminPassword = config.auth.adminPassword;
    const adminEmail = config.auth.adminEmail || 'admin@example.com';

    const userMatch = username === adminUsername || username.toLowerCase() === adminEmail.toLowerCase();
    return userMatch && password === adminPassword;
}
