/**
 * placeholder.ts — Placeholder gambar 100% LOKAL (data URI SVG).
 * Pengganti placehold.co & ui-avatars.com — tanpa request eksternal,
 * ringan (beberapa ratus byte), dan instan.
 */

function toDataUri(svg: string): string {
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Kotak placeholder generik, mis. untuk thumbnail produk. */
export function svgPlaceholder(width = 400, height = 225, text = ''): string {
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>` +
        `<rect width='100%' height='100%' fill='#151a24'/>` +
        (text
            ? `<text x='50%' y='50%' fill='#5b6474' font-family='sans-serif' font-size='${Math.round(height / 8)}' text-anchor='middle' dominant-baseline='middle'>${text}</text>`
            : '') +
        `</svg>`;
    return toDataUri(svg);
}

const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#4f46e5'];

/** Avatar inisial nama — pengganti ui-avatars.com. */
export function avatarPlaceholder(name = 'User', size = 96): string {
    const initial = (name.trim().charAt(0) || 'U').toUpperCase();
    let hash = 0;
    for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
    const svg =
        `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>` +
        `<rect width='100%' height='100%' fill='${color}'/>` +
        `<text x='50%' y='50%' fill='#ffffff' font-family='sans-serif' font-weight='bold' font-size='${Math.round(size * 0.45)}' text-anchor='middle' dominant-baseline='middle'>${initial}</text>` +
        `</svg>`;
    return toDataUri(svg);
}
