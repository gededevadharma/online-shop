/**
 * mongodb.ts — shim kompatibilitas.
 * Database sudah 100% lokal via @/lib/localdb (file JSON di ./data).
 * File ini dipertahankan agar import lama `import connectDB from '@/lib/mongodb'`
 * tetap berfungsi tanpa perubahan.
 */
export { connectDB, default } from './localdb';
