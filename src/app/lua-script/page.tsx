import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/localdb";
import Product from "@/models/Product";
import "./seo-page.css";

export const metadata: Metadata = {
  title: "Jual Script Lua GTPS & GTPSCloud Murah — Download Instan",
  description:
    "Beli script Lua untuk GTPS dan GTPSCloud: sistem gems, exchange, point, sell system & lainnya. Script Lua Growtopia private server murah, download instan setelah bayar QRIS.",
  keywords: [
    "jual script lua gtps",
    "script lua gtpscloud",
    "beli script lua gtps",
    "lua script growtopia private server",
    "toko script gtps",
    "script lua murah",
  ],
  openGraph: {
    title: "Jual Script Lua GTPS & GTPSCloud Murah — GTShop",
    description:
      "Script Lua untuk server GTPS & GTPSCloud. Download instan, bayar QRIS.",
    type: "website",
  },
};

interface ProductLite {
  _id: string;
  name: string;
  price: number;
  description?: string;
}

async function getProducts(): Promise<ProductLite[]> {
  try {
    await connectDB();
    const products = await Product.find({}).select("_id name price description").lean();
    return (products as Array<{ _id: unknown; name: string; price: number; description?: string }>).map(
      (p) => ({
        _id: String(p._id),
        name: p.name,
        price: p.price,
        description: p.description,
      })
    );
  } catch {
    return [];
  }
}

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

const FAQS = [
  {
    q: "Apa itu script Lua GTPS?",
    a: "Script Lua GTPS adalah kode program berbahasa Lua yang dijalankan di server Growtopia private server (GTPS) untuk menambah fitur — misalnya sistem gems, exchange, point, atau sell system — tanpa mengubah file inti server.",
  },
  {
    q: "Apakah script ini kompatibel dengan GTPSCloud?",
    a: "Ya. Script Lua yang dijual di GTShop ditulis mengikuti API Lua standar yang dipakai GTPS dan GTPSCloud, sehingga bisa dipasang di kedua platform.",
  },
  {
    q: "Bagaimana cara menerima script setelah membeli?",
    a: "Setelah pembayaran QRIS terverifikasi otomatis, isi script langsung tampil di dashboard kamu dan bisa disalin/download seketika. Tidak perlu menunggu admin.",
  },
  {
    q: "Bagaimana cara memasang script Lua di server saya?",
    a: "Umumnya cukup tempel script ke folder scripts server GTPS/GTPSCloud kamu lalu restart server atau reload script sesuai dokumentasi masing-masing platform.",
  },
];

export default async function LuaScriptPage() {
  const products = await getProducts();

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="seo-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="seo-hero">
        <h1>Jual Script Lua GTPS &amp; GTPSCloud Murah</h1>
        <p className="seo-lead">
          GTShop adalah toko script Lua untuk <strong>Growtopia private server (GTPS)</strong> dan{" "}
          <strong>GTPSCloud</strong>. Beli script Lua siap pakai — sistem gems, exchange, point,
          sell system, dan lainnya — dengan pembayaran QRIS otomatis dan download instan.
        </p>
        <Link href="/#products" className="btn btn-primary">
          Lihat Katalog Script
        </Link>
      </section>

      <section className="seo-section">
        <h2>Kenapa Beli Script Lua di GTShop?</h2>
        <ul className="seo-points">
          <li>
            <strong>Kompatibel GTPS &amp; GTPSCloud</strong> — ditulis mengikuti API Lua standar
            kedua platform.
          </li>
          <li>
            <strong>Download instan</strong> — script langsung tampil di dashboard setelah
            pembayaran QRIS terverifikasi otomatis, tanpa menunggu admin.
          </li>
          <li>
            <strong>Harga terjangkau</strong> — mulai dari Rp5.000 per script.
          </li>
          <li>
            <strong>Pembayaran aman</strong> — QRIS via Midtrans dengan verifikasi otomatis.
          </li>
        </ul>
      </section>

      {products.length > 0 && (
        <section className="seo-section">
          <h2>Katalog Script Lua GTPS</h2>
          <div className="seo-product-grid">
            {products.map((p) => (
              <Link key={p._id} href={`/product/${p._id}`} className="seo-product-card">
                <h3>{p.name}</h3>
                {p.description && <p>{p.description.slice(0, 120)}…</p>}
                <span className="seo-price">{formatPrice(p.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="seo-section">
        <h2>Cara Membeli Script Lua GTPS</h2>
        <ol className="seo-steps">
          <li>Pilih script Lua yang kamu butuhkan dari katalog.</li>
          <li>Klik beli dan scan kode QRIS untuk membayar.</li>
          <li>Setelah lunas, script langsung tampil di dashboard dan siap disalin.</li>
          <li>Tempel ke folder scripts server GTPS/GTPSCloud kamu, lalu reload.</li>
        </ol>
      </section>

      <section className="seo-section">
        <h2>Pertanyaan Umum tentang Script Lua GTPS</h2>
        <div className="seo-faq">
          {FAQS.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="seo-cta">
        <h2>Siap Upgrade Server GTPS Kamu?</h2>
        <p>Jelajahi katalog script Lua dan pasang fitur baru dalam hitungan menit.</p>
        <Link href="/#products" className="btn btn-primary">
          Buka Katalog
        </Link>
      </section>
    </main>
  );
}
