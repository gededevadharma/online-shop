// Helper upload media: data URL (base64) disimpan sebagai file fisik di
// public/thumbnails agar tidak membengkakkan JSON database & HTML halaman.
// Tanpa ini, satu thumbnail base64 1MB ikut ter-render di setiap HTML
// (RSC payload) dan membuat halaman lambat dimuat.

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/** Simpan data URL gambar jadi file. Return public path atau '' bila gagal. */
export async function persistDataUrl(dataUrl: string, prefix = 'upload'): Promise<string> {
    const m = /^data:image\/(png|jpe?g|webp|gif);base64,([\s\S]+)$/.exec(dataUrl.trim());
    if (!m) return '';
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
    let buf: Buffer;
    try {
        buf = Buffer.from(m[2], 'base64');
    } catch {
        return '';
    }
    if (buf.length === 0 || buf.length > MAX_BYTES) return '';
    const dir = path.join(process.cwd(), 'public', 'thumbnails');
    await mkdir(dir, { recursive: true });
    const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    await writeFile(path.join(dir, name), buf);
    return `/thumbnails/${name}`;
}

/**
 * Normalisasi nilai media untuk disimpan di database.
 * - data URL -> disimpan jadi file, return public path (tidak lagi base64 di JSON)
 * - http(s) URL -> dipakai apa adanya
 * - path relatif /... -> dipakai apa adanya
 */
export async function normalizeMediaValueStored(value: string, prefix = 'img'): Promise<string> {
    const trimmed = (value || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('data:')) {
        return persistDataUrl(trimmed, prefix);
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('/')) return trimmed;
    return `https://${trimmed}`;
}
