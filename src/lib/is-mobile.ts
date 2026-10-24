/**
 * Deteksi perangkat mobile dari user agent.
 * Dipakai untuk split alur pembayaran:
 * - Desktop: QR diekstrak dan tampil di modal white-label (iframe trigger jalan).
 * - Mobile: langsung ke halaman Snap (iframe trigger diblokir browser HP).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
