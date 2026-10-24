/**
 * Polling QR Snap di background dengan trigger iframe tersembunyi.
 *
 * Latar: QRIS Snap baru di-generate Midtrans setelah halaman pembayaran Snap
 * (redirect_url) dibuka. Iframe tersembunyi memicu generate tanpa menampilkan
 * UI Midtrans ke user. Dipolling tiap 3 detik:
 * - setelah ~30 detik (10x) tanpa QR → onSlow(): tampilkan tombol fallback
 *   "Buka Halaman Pembayaran" (navigasi top-level, dijamin memicu generate)
 * - setelah ~2 menit (40x) tanpa QR → onFailed(): tampilkan "Coba Lagi"
 */
export interface SnapQrPollHandlers {
    onQr: (qrCodeUrl: string, expiresAt?: string) => void;
    onSlow?: () => void;
    onFailed?: () => void;
}

const SLOW_AFTER = 3; // ~9 detik — jika iframe gagal (umum di mobile), langsung tampilkan fallback
const MAX_ATTEMPTS = 40; // ~2 menit
const INTERVAL_MS = 3000;
// Versi klien untuk diagnosis cache (naikkan setiap ubah logika trigger)
const CLIENT_VER = 5;

export function pollSnapQr(orderId: string, redirectUrl: string, handlers: SnapQrPollHandlers): () => void {
    let stopped = false;
    const triggerIframe = document.createElement('iframe');
    // PENTING (mobile): iframe HARUS di dalam viewport agar browser langsung me-load-nya.
    // Jangan pakai left:-9999px (dianggap off-screen → di-throttle, QR lambat 1+ menit).
    // Jangan pakai opacity:0 (dianggap hidden → tidak di-load di sebagian browser mobile).
    // Solusi: 1x1 piksel di pojok kanan-bawah viewport — tak terlihat user, tapi di-load segera.
    triggerIframe.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;border:0;pointer-events:none;';
    triggerIframe.setAttribute('aria-hidden', 'true');
    triggerIframe.setAttribute('title', '');
    triggerIframe.loading = 'eager';
    if (redirectUrl) {
        triggerIframe.src = redirectUrl;
        document.body.appendChild(triggerIframe);
    }

    (async () => {
        let found = false;
        try {
            for (let i = 0; i < MAX_ATTEMPTS && !stopped; i++) {
                await new Promise((r) => setTimeout(r, INTERVAL_MS));
                if (stopped) break;
                if (i === SLOW_AFTER && !found) {
                    try { handlers.onSlow?.(); } catch { /* abaikan */ }
                }
                try {
                    const qrRes = await fetch(`/api/orders/${orderId}/snap-qr?cv=${CLIENT_VER}`, { cache: 'no-store' });
                    const qrData = await qrRes.json();
                    if (qrRes.ok && qrData.qrCodeUrl) {
                        found = true;
                        handlers.onQr(qrData.qrCodeUrl, qrData.expiresAt);
                        break;
                    }
                } catch { /* coba lagi */ }
            }
        } finally {
            try { triggerIframe.remove(); } catch { /* abaikan */ }
        }
        if (!found && !stopped) {
            try { handlers.onFailed?.(); } catch { /* abaikan */ }
        }
    })();

    // kembalikan fungsi stop (dipanggil saat modal ditutup)
    return () => {
        stopped = true;
        try { triggerIframe.remove(); } catch { /* abaikan */ }
    };
}
