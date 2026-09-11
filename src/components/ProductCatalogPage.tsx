import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { ProductCategoryRecord, ProductRecord } from '../types/products';
import { getSiteContent } from '../data';
import CourseOfferModal from './CourseOfferModal';
import { applyPageMetadata, getPageMetadata } from '../seo';

function ProductCard({ product }: { product: ProductRecord }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.images.filter(Boolean);

  return (
    <article className="group overflow-hidden border border-[#2c2218]/12 bg-[#f2eadf]">
      <div className="relative aspect-[4/5] overflow-hidden bg-[#d8cec1]">
        {images[imageIndex] ? (
          <img src={images[imageIndex]} alt={product.title} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" />
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
  const slug = (() => {
    try { return decodeURIComponent(window.location.pathname.split('/').filter(Boolean)[1] ?? ''); }
    catch { return ''; }
  })();
  const offer = getSiteContent().courseOffer;
  const [isOfferOpen, setIsOfferOpen] = useState(offer.enabled);
  const [category, setCategory] = useState<ProductCategoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setLoading(true);
    setNotFound(false);
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      applyPageMetadata(getPageMetadata(window.location.pathname, null));
      return;
    }

    fetch(`/api/product-categories/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) {
          setNotFound(true);
          applyPageMetadata(getPageMetadata(window.location.pathname, null));
          return;
        }
        if (!response.ok) throw new Error('Categoria nu a putut fi încărcată.');
        const result = await response.json() as ProductCategoryRecord;
        if (controller.signal.aborted) return;
        setCategory(result);
        applyPageMetadata(getPageMetadata(window.location.pathname, result));
      })
      .catch(() => { if (!controller.signal.aborted) setError('Produsele nu au putut fi încărcate. Încearcă din nou.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [slug, attempt]);

  return (
    <main className="grain-bg min-h-screen bg-[#e8e0d6] text-[#2c2218]">
      <CourseOfferModal content={offer} isOpen={isOfferOpen} onClose={() => setIsOfferOpen(false)} />
      <div className="grain-overlay" />
      <header className="relative z-10 border-b border-[#2c2218]/10 px-6 py-6 md:px-16">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between">
          <a href="/" className="font-display text-xl tracking-tight">IV Concept</a>
          <a
            href="/#lucrari"
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
          >
            ← Toate categoriile
          </a>
        </div>
      </header>

      {loading ? (
        <div className="relative z-10 px-6 py-32 text-center text-sm">Se încarcă produsele…</div>
      ) : error ? (
        <section role="alert" className="relative z-10 px-6 py-32 text-center">
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-6 border-b border-current pb-2">Reîncearcă</button>
        </section>
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
