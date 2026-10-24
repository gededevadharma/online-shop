'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSession } from '@/lib/session-client';

/**
 * /admin: bukan halaman login lagi.
 * - Sudah punya akses admin -> ke /admin/dashboard
 * - Sudah login sebagai user biasa (bukan admin) -> ke /
 * - Belum login -> ke /login
 */
export default function AdminIndexPage() {
    const router = useRouter();

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/session');
                const data = await res.json();
                if (data.authenticated) {
                    router.replace('/admin/dashboard');
                    return;
                }
            } catch {
                // network drop sesaat: lanjut cek user session dengan retry
            }
            const udata = await fetchSession();
            // null = network masih bermasalah: jangan redirect membabi-buta,
            // biarkan user tetap di halaman ini (akan dicoba lagi saat navigasi)
            if (udata === null) return;
            if (udata.authenticated) {
                router.replace('/');
            } else {
                router.replace('/login?redirect=/admin/dashboard');
            }
        })();
    }, [router]);

    return (
        <div style={{
            minHeight: '100vh', background: '#000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div className="spinner" />
        </div>
    );
}
