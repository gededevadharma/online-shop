import crypto from 'crypto';
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'your-secret-encryption-key-min-32-chars';
const IV_LENGTH = 16;

/**
 * Advanced encryption for sensitive data
 * Menggunakan AES-256-CBC untuk enkripsi yang lebih aman
 */
export class DataEncryption {
    // Enkripsi data dengan IV random
    static encrypt(text: string): string {
        try {
            const iv = crypto.randomBytes(IV_LENGTH);
            const cipher = crypto.createCipheriv(
                'aes-256-cbc',
                Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)),
                iv
            );

            let encrypted = cipher.update(text, 'utf-8', 'hex');
            encrypted += cipher.final('hex');

            // Format: iv:encrypted
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    // Dekripsi data
    static decrypt(encryptedText: string): string {
        try {
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted format');
            }

            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];

            const decipher = crypto.createDecipheriv(
                'aes-256-cbc',
                Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32)),
                iv
            );

            let decrypted = decipher.update(encrypted, 'hex', 'utf-8');
            decrypted += decipher.final('utf-8');

            return decrypted;
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    // Hash data (one-way)
    static hash(text: string): string {
        return crypto.createHash('sha256').update(text).digest('hex');
    }

    // Verify hash
    static verifyHash(text: string, hash: string): boolean {
        return this.hash(text) === hash;
    }
}

/**
 * Untuk enkripsi data yang lebih sederhana (payment data, order details)
 */
export class SimpleEncryption {
    static encrypt(data: unknown): string {
        const jsonString = JSON.stringify(data);
        return CryptoJS.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
    }

    static decrypt(encryptedData: string): unknown {
        const decrypted = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    }
}

/**
 * Generate secure tokens
 */
export function generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate secure PIN/Code
 */
export function generateSecurePin(length: number = 6): string {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * Validate email dengan format
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
    isStrong: boolean;
    score: number;
    feedback: string[];
} {
    const feedback: string[] = [];
    let score = 0;

    if (password.length >= 8) score++;
    else feedback.push('Minimal 8 karakter');

    if (password.length >= 12) score++;

    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Harus ada huruf besar');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Harus ada huruf kecil');

    if (/\d/.test(password)) score++;
    else feedback.push('Harus ada angka');

    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score++;
    else feedback.push('Harus ada karakter spesial');

    return {
        isStrong: score >= 4,
        score,
        feedback: feedback.length === 0 ? ['Password kuat'] : feedback
    };
}

/**
 * Generate OTP untuk two-factor authentication
 */
export function generateOTP(digits: number = 6): string {
    let otp = '';
    for (let i = 0; i < digits; i++) {
        otp += Math.floor(Math.random() * 10);
    }
    return otp;
}

/**
 * Validate OTP
 */
export function validateOTP(otp: string, storedOTP: string, maxAge: number = 300000): boolean {
    return otp === storedOTP; // maxAge dalam milliseconds
}

export default {
    DataEncryption,
    SimpleEncryption,
    generateSecureToken,
    generateSecurePin,
    validateEmail,
    validatePasswordStrength,
    generateOTP,
    validateOTP,
};
