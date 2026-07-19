import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { ProductCategoryRecord } from '../types/products';

export default function SelectedWorkSection() {
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);

  useEffect(() => {
    fetch('/api/product-categories')
      .then((response) => response.ok ? response.json() : [])
      .then((data) => setCategories(data as ProductCategoryRecord[]))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (categories.length > 0 && window.location.hash === '#lucrari') {
      requestAnimationFrame(() => {
        document.getElementById('lucrari')?.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
    }
  }, [categories]);

  if (categories.length === 0) return null;

  return (
    <section id="lucrari" className="relative z-40 m-0 border-t border-zinc-900 bg-[#130a01] px-6 py-24 text-white md:px-16 md:py-32">
      <div className="mx-auto w-full max-w-[1340px]">
        <div className="mb-12 md:mb-16">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#c5a880] md:text-xs">Colecțiile noastre</span>
          <h2 className="mt-3 font-display text-3xl font-light tracking-tight md:text-5xl">Descoperă produsele IV Concept</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {categories.map((category) => (
            <article key={category.id} className="group border border-zinc-800 bg-zinc-950/30 p-5 md:p-7">
              <a href={`/produse/${category.slug}`} className="block">
                <div className="aspect-[4/3] overflow-hidden bg-zinc-900">
                  <img src={category.image} alt={category.title} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]" />
                </div>
                <div className="flex items-end justify-between gap-6 pb-1 pt-7">
                  <div>
                    <span className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Categorie</span>
                    <h3 className="mt-2 font-display text-3xl font-light tracking-tight transition group-hover:text-[#c5a880]">{category.title}</h3>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-zinc-700 transition group-hover:border-[#c5a880] group-hover:text-[#c5a880]">
                    <ArrowUpRight size={18} />
                  </span>
                </div>
                <span className="mt-5 inline-flex border-b border-zinc-700 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-400 transition group-hover:border-[#c5a880] group-hover:text-white">Vezi toate produsele</span>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
