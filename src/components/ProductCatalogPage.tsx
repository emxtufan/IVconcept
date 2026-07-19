import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ProductCategoryRecord, ProductRecord } from '../types/products';

function ProductCard({ product }: { product: ProductRecord }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.images.filter(Boolean);

  return (
    <article className="group overflow-hidden border border-[#2c2218]/12 bg-[#f2eadf]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#d8cec1]">
        {images[imageIndex] ? (
          <img src={images[imageIndex]} alt={product.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-[#2c2218]/35">Imagine indisponibilă</div>
        )}
        {images.length > 1 && (
          <div className="absolute bottom-4 right-4 flex gap-2">
            <button type="button" aria-label="Imaginea anterioară" onClick={() => setImageIndex((value) => (value - 1 + images.length) % images.length)} className="grid h-10 w-10 place-items-center rounded-full bg-[#130a01]/80 text-white backdrop-blur">
              <ArrowLeft size={15} />
            </button>
            <button type="button" aria-label="Imaginea următoare" onClick={() => setImageIndex((value) => (value + 1) % images.length)} className="grid h-10 w-10 place-items-center rounded-full bg-[#130a01]/80 text-white backdrop-blur">
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
      <div className="p-6 md:p-7">
        <div className="flex items-start justify-between gap-5">
          <h2 className="font-display text-2xl font-light tracking-tight">{product.title}</h2>
          <span className="shrink-0 text-sm font-semibold text-[#8b6847]">{product.price}</span>
        </div>
        <p className="mt-4 text-sm font-light leading-7 text-[#2c2218]/65">{product.description}</p>
        <div className="mt-6 border-t border-[#2c2218]/10 pt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2c2218]/45">
          Dimensiune: <span className="text-[#2c2218]/80">{product.dimensions}</span>
        </div>
      </div>
    </article>
  );
}

export default function ProductCatalogPage() {
  const slug = decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] ?? '');
  const [category, setCategory] = useState<ProductCategoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    fetch(`/api/product-categories/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (response.status === 404) {
          setNotFound(true);
          return;
        }
        if (!response.ok) throw new Error('Categoria nu a putut fi încărcată.');
        setCategory(await response.json() as ProductCategoryRecord);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <main className="grain-bg min-h-screen bg-[#e8e0d6] text-[#2c2218]">
      <div className="grain-overlay" />
      <header className="relative z-10 border-b border-[#2c2218]/10 px-6 py-6 md:px-16">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between">
          <a href="/" className="font-display text-xl tracking-tight">IV Concept</a>
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                window.location.href = '/#lucrari';
              }
            }}
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
          >
            ← Toate categoriile
          </button>
        </div>
      </header>

      {loading ? (
        <div className="relative z-10 px-6 py-32 text-center text-sm">Se încarcă produsele…</div>
      ) : notFound || !category ? (
        <section className="relative z-10 px-6 py-32 text-center">
          <h1 className="font-display text-4xl font-light">Categoria nu a fost găsită.</h1>
          <a href="/#lucrari" className="mt-8 inline-flex border-b border-[#2c2218] pb-2 text-xs uppercase tracking-[0.18em]">Vezi categoriile</a>
        </section>
      ) : (
        <>
          <section className="relative z-10 px-6 pb-20 pt-20 md:px-16 md:pb-28 md:pt-28">
            <div className="mx-auto grid max-w-[1340px] gap-10 md:grid-cols-2 md:items-end">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#9b744e]">Colecție IV Concept</span>
                <h1 className="mt-5 font-display text-5xl font-light tracking-[-0.05em] md:text-8xl">{category.title}</h1>
                <p className="mt-6 text-xs uppercase tracking-[0.18em] text-[#2c2218]/45">{category.products.length} {category.products.length === 1 ? 'produs' : 'produse'}</p>
              </div>
              {category.image && <img src={category.image} alt={category.title} className="aspect-[16/9] w-full object-cover" />}
            </div>
          </section>
          <section className="relative z-10 border-t border-[#2c2218]/10 px-6 py-20 md:px-16 md:py-28">
            <div className="mx-auto max-w-[1340px]">
              {category.products.length ? (
                <div className="grid grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3">
                  {category.products.map((product) => <ProductCard key={product.id} product={product} />)}
                </div>
              ) : (
                <p className="border border-[#2c2218]/10 px-6 py-12 text-center text-sm text-[#2c2218]/50">Nu există încă produse în această categorie.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
