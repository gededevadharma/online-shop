// Skeleton loading untuk halaman landing (/).
// Tampil selama server component page.tsx mengambil data — menggantikan
// tampilan kosong/berantakan dengan scaffold grid yang rapi + shimmer.
export default function Loading() {
    return (
        <div className="vercel-landing" aria-busy="true" aria-label="Memuat halaman">
            {/* Navbar skeleton */}
            <nav className="v-nav">
                <div className="v-nav-inner">
                    <div className="skeleton" style={{ width: 120, height: 28 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[0, 1, 2, 3].map((i) => (
                            <div key={i} className="skeleton" style={{ width: 64, height: 32 }} />
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div className="skeleton" style={{ width: 80, height: 36 }} />
                        <div className="skeleton" style={{ width: 80, height: 36 }} />
                    </div>
                </div>
            </nav>

            {/* Hero skeleton */}
            <section className="v-hero">
                <div className="v-hero-inner">
                    <div className="skeleton" style={{ width: 260, height: 30, borderRadius: 999, margin: '0 auto 28px' }} />
                    <div className="skeleton" style={{ width: '80%', height: 56, margin: '0 auto 16px' }} />
                    <div className="skeleton" style={{ width: '60%', height: 56, margin: '0 auto 24px' }} />
                    <div className="skeleton" style={{ width: '45%', height: 22, margin: '0 auto 40px' }} />
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <div className="skeleton" style={{ width: 180, height: 52, borderRadius: 10 }} />
                        <div className="skeleton" style={{ width: 180, height: 52, borderRadius: 10 }} />
                    </div>
                </div>
            </section>

            {/* Ticker skeleton */}
            <div className="v-ticker">
                <div className="skeleton" style={{ width: '100%', height: 20, borderRadius: 0 }} />
            </div>

            {/* Stats skeleton */}
            <div className="v-stats">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="v-stat">
                        <div className="skeleton" style={{ width: 80, height: 36, margin: '0 auto 8px' }} />
                        <div className="skeleton" style={{ width: 110, height: 16, margin: '0 auto' }} />
                    </div>
                ))}
            </div>

            {/* Product grid skeleton — scaffold utama */}
            <section className="v-section" style={{ paddingTop: 8 }}>
                <div className="v-section-head">
                    <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 999, margin: '0 auto 20px' }} />
                    <div className="skeleton" style={{ width: 320, height: 40, margin: '0 auto 16px' }} />
                    <div className="skeleton" style={{ width: 420, height: 20, margin: '0 auto' }} />
                </div>
                <div className="v-toolbar">
                    <div className="skeleton" style={{ width: 360, height: 44, borderRadius: 10 }} />
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="skeleton" style={{ width: 90, height: 36, borderRadius: 999 }} />
                        ))}
                    </div>
                </div>
                <div className="v-grid">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="v-card" style={{ border: '1px solid #1f1f1f' }}>
                            <div className="skeleton" style={{ aspectRatio: '16/9', borderRadius: 0 }} />
                            <div className="v-card-body">
                                <div className="skeleton" style={{ width: 90, height: 12, marginBottom: 8 }} />
                                <div className="skeleton" style={{ width: '85%', height: 18, marginBottom: 8 }} />
                                <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 6 }} />
                                <div className="skeleton" style={{ width: '70%', height: 14, marginBottom: 16 }} />
                                <div className="skeleton" style={{ width: 120, height: 22 }} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features skeleton */}
            <section className="v-section" style={{ paddingTop: 24 }}>
                <div className="v-section-head">
                    <div className="skeleton" style={{ width: 300, height: 40, margin: '0 auto 16px' }} />
                    <div className="skeleton" style={{ width: 400, height: 20, margin: '0 auto' }} />
                </div>
                <div className="v-feat-grid">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="v-feat">
                            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 8, marginBottom: 20 }} />
                            <div className="skeleton" style={{ width: '70%', height: 18, marginBottom: 8 }} />
                            <div className="skeleton" style={{ width: '100%', height: 14, marginBottom: 6 }} />
                            <div className="skeleton" style={{ width: '85%', height: 14 }} />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
