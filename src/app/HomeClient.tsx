'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { svgPlaceholder, avatarPlaceholder } from '@/lib/placeholder';
import { useBranding } from '@/context/BrandingContext';
import Reveal from '@/components/Reveal';
import AnimatedCounter from '@/components/AnimatedCounter';
import { fetchSession } from '@/lib/session-client';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  thumbnail: string;
  category: string;
  totalSales: number;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Testimonial {
  _id: string;
  name: string;
  role: string;
  content: string;
  image: string;
  rating: number;
  isActive: boolean;
}

interface HomeClientProps {
  initialProducts: Product[];
  initialTestimonials: Testimonial[];
}

export default function HomeClient({ initialProducts, initialTestimonials }: HomeClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const { storeName: BRAND_NAME, logoUrl: BRAND_LOGO_URL } = useBranding();

  const categories = ['All', ...Array.from(new Set(products.map(p => p.category)))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const checkSession = useCallback(async () => {
    const data = await fetchSession();
    // data null = network drop sesaat: jangan ubah state user
    if (data?.authenticated && data.user) {
      setUser(data.user);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch sesi saat mount
    checkSession();
    const handleScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [checkSession]);

  const renderStars = (rating: number) => '★'.repeat(rating) + '☆'.repeat(5 - rating);

  const getValidImageUrl = (imageUrl: string, fallbackName: string = 'User') => {
    const fallbackAvatar = avatarPlaceholder(fallbackName);
    if (!imageUrl || typeof imageUrl !== 'string') return fallbackAvatar;
    // Path relatif lokal (mis. /thumbnails/...) langsung dipakai
    if (imageUrl.startsWith('/')) return imageUrl;
    try {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.hostname.includes('growbest-cdn.vercel.app')) return fallbackAvatar;
      return parsedUrl.toString();
    } catch {
      return fallbackAvatar;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const totalSales = products.reduce((sum, p) => sum + (Number(p.totalSales) || 0), 0);

  return (
    <div className="vercel-landing">
      

      {/* Navbar */}
      <nav className={`v-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="v-nav-inner">
          <a href="/" className="v-logo" title={BRAND_NAME}>
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={30} height={30} unoptimized priority />
            <span className="v-logo-text">{BRAND_NAME}</span>
          </a>
          <div className="v-links">
            <Link href="/#products" className="v-link">Produk</Link>
            <Link href="/#features" className="v-link">Fitur</Link>
            <Link href="/#testimonials" className="v-link">Testimoni</Link>
            <Link href="/#faq" className="v-link">FAQ</Link>
          </div>
          <div className="v-nav-cta">
            {user ? (
              <>
                <a href="/dashboard" className="v-btn v-btn-ghost v-btn-sm hide-mobile">Dashboard</a>
                <button onClick={handleLogout} className="v-btn v-btn-ghost v-btn-sm hide-mobile">Keluar</button>
              </>
            ) : (
              <>
                <a href="/login" className="v-btn v-btn-ghost v-btn-sm hide-mobile">Masuk</a>
                <a href="/register" className="v-btn v-btn-primary v-btn-sm">Daftar</a>
              </>
            )}
            <button className="v-burger v-btn v-btn-ghost v-btn-sm" onClick={() => setMobileMenuOpen(true)} aria-label="Menu" style={{ padding: '12px', minWidth: '44px', minHeight: '44px' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="v-mobile-menu">
          <button className="v-mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Tutup">
            <svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          {['Produk|/#products', 'Fitur|/#features', 'Testimoni|/#testimonials', 'FAQ|/#faq'].map((item) => {
            const [label, href] = item.split('|');
            return (
              <Link key={href} href={href} className="v-mobile-link" onClick={() => setMobileMenuOpen(false)}>
                {label}
              </Link>
            );
          })}
          <div style={{ height: 16 }} />
          {user ? (
            <>
              <a href="/dashboard" className="v-btn v-btn-primary" onClick={() => setMobileMenuOpen(false)}>Dashboard</a>
              <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="v-btn v-btn-ghost">Keluar</button>
            </>
          ) : (
            <>
              <a href="/login" className="v-btn v-btn-ghost" onClick={() => setMobileMenuOpen(false)}>Masuk</a>
              <a href="/register" className="v-btn v-btn-primary" onClick={() => setMobileMenuOpen(false)}>Daftar Gratis</a>
            </>
          )}
        </div>
      )}

      {/* Hero */}
      <section className="v-hero">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="v-hero-grid" />
        <div className="v-hero-inner">
          <Reveal><div className="v-pill hero-badge"><span className="v-pill-dot" />Pengiriman instan setelah pembayaran</div></Reveal>
          <Reveal delay={100}><h1 className="v-hero-title">
            Produk Digital Premium,<br />
            <span className="grad gradient-text">Terkirim Dalam Detik.</span>
          </h1></Reveal>
          <Reveal delay={200}><p className="v-hero-sub">
            Toko produk digital terpercaya dengan pembayaran aman —
            QRIS, virtual account, e-wallet, dan kartu. Akses produk langsung otomatis.
          </p></Reveal>
          <Reveal delay={300}><div className="v-hero-actions">
            <Link href="/#products" className="v-btn v-btn-primary v-btn-lg">Jelajahi Produk</Link>
            <a href={user ? '/dashboard' : '/register'} className="v-btn v-btn-ghost v-btn-lg">
              {user ? 'Buka Dashboard' : 'Buat Akun Gratis'}
            </a>
          </div></Reveal>
        </div>
      </section>

      {/* Ticker */}
      <div className="v-ticker">
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div key={dup} className="marquee-group">
              {['Pembayaran Aman & Terenkripsi', 'QRIS & Virtual Account', 'E-Wallet & Kartu Kredit', 'Pengiriman Instan Otomatis', 'Support 24/7', 'Data Terenkripsi'].map((t) => (
                <span key={t + dup} className="v-ticker-item"><span className="v-ticker-dot" />{t}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="v-stats">
        <Reveal delay={0} className="v-stat"><div className="v-stat-value"><AnimatedCounter value={products.length} />+</div><div className="v-stat-label">Produk Tersedia</div></Reveal>
        <Reveal delay={100} className="v-stat"><div className="v-stat-value"><AnimatedCounter value={totalSales} />+</div><div className="v-stat-label">Terjual</div></Reveal>
        <Reveal delay={200} className="v-stat"><div className="v-stat-value">24/7</div><div className="v-stat-label">Layanan Aktif</div></Reveal>
        <Reveal delay={300} className="v-stat"><div className="v-stat-value">100%</div><div className="v-stat-label">Aman</div></Reveal>
      </div>

      {/* Products */}
      <section id="products" className="v-section" style={{ paddingTop: 8 }}>
        <Reveal><div className="v-section-head">
          <span className="v-eyebrow">Katalog</span>
          <h2 className="v-h2">Produk Digital Terbaik</h2>
          <p className="v-sub">Pilih produk favoritmu — bayar mudah, terima akses seketika.</p>
        </div></Reveal>

        <div className="v-toolbar">
          <div className="v-search">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="v-cats">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`v-cat ${selectedCategory === cat ? 'active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="v-grid" aria-busy="true" aria-label="Memuat produk">
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
        ) : filteredProducts.length === 0 ? (
          <div className="v-empty">
            <p style={{ fontSize: 15, margin: 0 }}>Tidak ada produk ditemukan.</p>
            <p style={{ fontSize: 13, margin: '8px 0 0' }}>Coba kata kunci atau kategori lain.</p>
          </div>
        ) : (
          <div className="v-grid">
            {filteredProducts.map((product) => (
              <a href={`/product/${product._id}`} key={product._id} className="v-card v-card-hover">
                <div className="v-card-img">
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="v-discount">-{Math.round((1 - product.price / product.originalPrice) * 100)}%</span>
                  )}
                  <span className="v-sales">
                    <svg width="11" height="11" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" />
                    </svg>
                    {product.totalSales} terjual
                  </span>
                  <Image
                    src={getValidImageUrl(product.thumbnail, product.name) || svgPlaceholder(400, 225, 'No Image')}
                    alt={product.name}
                    width={400}
                    height={225}
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                    loading="lazy"
                    quality={75}
                    sizes="(max-width: 768px) 100vw, 400px"
                  />
                </div>
                <div className="v-card-body">
                  <span className="v-card-cat">{product.category}</span>
                  <h4 className="v-card-title">{product.name}</h4>
                  <p className="v-card-desc">{product.description}</p>
                  <div className="v-card-price">
                    <span className="v-price">{formatPrice(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <span className="v-price-old">{formatPrice(product.originalPrice)}</span>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Features */}
      <section id="features" className="v-section" style={{ paddingTop: 24 }}>
        <Reveal><div className="v-section-head">
          <span className="v-eyebrow">Keunggulan</span>
          <h2 className="v-h2">Kenapa Belanja di Sini?</h2>
          <p className="v-sub">Pengalaman belanja produk digital yang cepat, aman, dan tanpa ribet.</p>
        </div></Reveal>
        <div className="v-feat-grid">
          {[
            { t: 'Kirim Otomatis Instan', d: 'Begitu pembayaran terverifikasi, akses produk langsung muncul — tanpa menunggu admin.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { t: 'Pembayaran Aman', d: 'QRIS, virtual account bank, e-wallet, dan kartu kredit dalam satu checkout yang aman dan terverifikasi otomatis.', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
            { t: 'Showcase Video', d: 'Lihat preview video YouTube langsung di halaman produk sebelum membeli.', icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { t: 'Support Responsif', d: 'Butuh bantuan? Tim kami siap membantu melalui halaman support dan Telegram.', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          ].map((f) => (
            <div key={f.t} className="v-feat">
              <div className="v-feat-icon">
                <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={f.icon} />
                </svg>
              </div>
              <h4>{f.t}</h4>
              <p>{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="v-section" style={{ paddingTop: 24 }}>
          <Reveal><div className="v-section-head">
            <span className="v-eyebrow">Testimoni</span>
            <h2 className="v-h2">Kata Pelanggan</h2>
            <p className="v-sub">Cerita mereka yang sudah berbelanja di {BRAND_NAME}.</p>
          </div></Reveal>
          <div className="v-testi-grid">
            {testimonials.slice(0, 6).map((t) => (
              <div key={t._id} className="v-testi">
                <div className="v-testi-top">
                  <Image
                    src={getValidImageUrl(t.image, t.name)}
                    alt={t.name}
                    width={48}
                    height={48}
                    loading="lazy"
                    style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid #262626' }}
                  />
                  <div>
                    <div className="v-testi-name">{t.name}</div>
                    <div className="v-testi-role">{t.role}</div>
                  </div>
                </div>
                <div className="v-testi-stars">{renderStars(t.rating)}</div>
                <p className="v-testi-text">&ldquo;{t.content}&rdquo;</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="v-section" style={{ paddingTop: 24 }}>
        <Reveal><div className="v-section-head">
          <span className="v-eyebrow">FAQ</span>
          <h2 className="v-h2">Pertanyaan Umum</h2>
        </div></Reveal>
        <div className="v-faq">
          {[
            { q: 'Bagaimana cara membayar?', a: 'Pilih produk, isi data, lalu bayar dengan QRIS, virtual account, e-wallet, atau kartu. Status terverifikasi otomatis.' },
            { q: 'Kapan produk saya terkirim?', a: 'Otomatis segera setelah pembayaran terverifikasi. Link/file akses muncul di halaman status pesanan.' },
            { q: 'Apakah data saya aman?', a: 'Ya. Semua data tersimpan di server kami sendiri, tanpa pihak ketiga. Password dienkripsi.' },
            { q: 'Bagaimana jika pembayaran gagal?', a: 'Hubungi admin lewat halaman Support atau grup Telegram kami. Sertakan nomor referensi order Anda.' },
          ].map((f, i) => (
            <details key={i} className="v-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="v-section" style={{ paddingTop: 24 }}>
        <div className="v-cta">
          <h2>Mulai Belanja Sekarang</h2>
          <p>Bergabung dengan pelanggan yang mempercayai {BRAND_NAME}.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/register" className="v-btn v-btn-primary v-btn-lg">Daftar Gratis</a>
            <Link href="/#products" className="v-btn v-btn-ghost v-btn-lg">Lihat Produk</Link>
          </div>
        </div>
      </section>

      {/* Telegram */}
      <section className="v-section" style={{ paddingTop: 0 }}>
        <div className="v-tg">
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,136,204,.14)', border: '1px solid rgba(0,136,204,.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#29a9eb">
              <path d="M21.9 4.6L2.7 12.1c-.8.3-.8 1.4.1 1.6l4.8 1.5 1.8 5.6c.3.9 1.4 1 1.9.2l2.6-3.1 4.9 3.6c.6.5 1.6.1 1.8-.7l2.9-14.1c.2-1-.9-1.9-1.6-1.1zM8.5 13.1l9.7-6.8c.2-.2.5.1.3.3l-8 7.4-.3 3-1.7-4z" />
            </svg>
          </div>
          <h2>Gabung Grup Telegram</h2>
          <p>Dapatkan notifikasi transaksi, update terbaru, dan support langsung dari tim kami.</p>
          <a href="https://t.me/sky_hosting_gtps" target="_blank" rel="noopener noreferrer" className="v-btn v-btn-primary v-btn-lg">
            Bergabung Sekarang
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="v-footer">
        <div className="v-footer-inner">
          <div className="v-footer-top">
            <div>
              <a href="/" className="v-logo" title={BRAND_NAME}>
                <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={28} height={28} unoptimized />
                <span className="v-logo-text">{BRAND_NAME}</span>
              </a>
              <p className="v-footer-desc">Platform digital store terpercaya dengan pengiriman otomatis.</p>
            </div>
            <div className="v-footer-links">
              <a href="/terms" className="v-footer-link">Syarat & Ketentuan</a>
              <a href="/privacy" className="v-footer-link">Kebijakan Privasi</a>
              <Link href="/#faq" className="v-footer-link">FAQ</Link>
            </div>
          </div>
          <div className="v-footer-bottom">
            <p>© 2026 {BRAND_NAME}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
