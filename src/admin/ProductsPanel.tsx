import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProductCategoryRecord } from '../types/products';
import { uploadFilesWithProgress } from './uploadClient';

const inputClass = 'h-11 w-full rounded-xl border border-[#2c2218]/15 bg-[#fffaf4] px-4 text-sm outline-none focus:border-[#b38b60]';
const buttonClass = 'rounded-full bg-[#2c2218] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-40';

export default function ProductsPanel() {
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);
  const [categoryTitle, setCategoryTitle] = useState('');
  const [categoryImage, setCategoryImage] = useState<File | null>(null);
  const [openCategory, setOpenCategory] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    const response = await fetch('/api/product-categories');
    if (!response.ok) throw new Error('Nu am putut încărca produsele.');
    setCategories(await response.json() as ProductCategoryRecord[]);
  };

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!categoryTitle.trim() || !categoryImage) return;
    setBusy(true);
    setMessage('Se încarcă imaginea…');
    try {
      const upload = await uploadFilesWithProgress([categoryImage], (progress) => setMessage(`Upload ${progress}%`));
      const response = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: categoryTitle, image: upload.files[0].url }),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      setCategories(await response.json() as ProductCategoryRecord[]);
      setCategoryTitle('');
      setCategoryImage(null);
      setMessage('Categoria a fost creată.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eroare la creare.');
    } finally {
      setBusy(false);
    }
  };

  const deleteCategory = async (id: number) => {
    if (!window.confirm('Ștergi categoria și toate produsele sale?')) return;
    const response = await fetch(`/api/product-categories/${id}`, { method: 'DELETE' });
    if (response.ok) {
      await load();
      setMessage('Categoria a fost ștearsă.');
    }
  };

  return (
    <div className="space-y-8">
      <form onSubmit={createCategory} className="rounded-[26px] border border-[#2c2218]/10 bg-[#fbf6f0] p-5 md:p-6">
        <h3 className="text-lg font-semibold">Creează categorie</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="text-xs font-semibold">Titlu
            <input value={categoryTitle} onChange={(event) => setCategoryTitle(event.target.value)} className={`${inputClass} mt-2`} placeholder="Ex: Oglinzi" />
          </label>
          <label className="text-xs font-semibold">Imagine categorie
            <span className="mt-2 flex h-11 cursor-pointer items-center justify-center rounded-full border border-[#2c2218]/15 bg-[#fffaf4] px-5 text-[10px] font-semibold uppercase tracking-[0.16em] transition hover:border-[#b38b60]">
              {categoryImage ? categoryImage.name : 'Alege imagine'}
              <input type="file" accept="image/*" onChange={(event) => setCategoryImage(event.target.files?.[0] ?? null)} className="sr-only" />
            </span>
          </label>
          <button disabled={busy || !categoryTitle.trim() || !categoryImage} className={buttonClass}>
            {busy ? 'Se încarcă…' : 'Încarcă și creează'}
          </button>
        </div>
        {message && <p className="mt-4 text-sm text-[#2c2218]/60">{message}</p>}
      </form>

      {categories.map((category) => (
        <section key={category.id} className="overflow-hidden rounded-[26px] border border-[#2c2218]/10 bg-[#fbf6f0]">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-center gap-4">
              <img src={category.image} alt="" className="h-20 w-24 rounded-xl object-cover" />
              <div><h3 className="text-xl font-semibold">{category.title}</h3><p className="mt-1 text-xs text-[#2c2218]/50">{category.products.length} produse</p></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setOpenCategory(openCategory === category.id ? null : category.id)} className={buttonClass}>{openCategory === category.id ? 'Închide' : 'Adaugă produs'}</button>
              <button onClick={() => void deleteCategory(category.id)} className="rounded-full border border-red-900/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-800">Șterge</button>
            </div>
          </div>
          {openCategory === category.id && <ProductForm categoryId={category.id} onCreated={async () => { await load(); setOpenCategory(null); }} />}
          {category.products.length > 0 && (
            <div className="grid gap-4 border-t border-[#2c2218]/10 p-5 md:grid-cols-2 md:p-6">
              {category.products.map((product) => (
                <div key={product.id} className="flex gap-4 rounded-2xl border border-[#2c2218]/10 bg-white/50 p-4">
                  <img src={product.images[0]} alt="" className="h-24 w-20 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold">{product.title}</h4>
                    <p className="mt-1 text-xs text-[#2c2218]/55">{product.price} · {product.dimensions}</p>
                    <button
                      onClick={async () => {
                        if (!window.confirm('Ștergi produsul?')) return;
                        await fetch(`/api/products/${product.id}`, { method: 'DELETE' });
                        await load();
                      }}
                      className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-red-800"
                    >Șterge produsul</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function ProductForm({ categoryId, onCreated }: { categoryId: number; onCreated: () => Promise<void> }) {
  const [fields, setFields] = useState({ title: '', description: '', price: '', dimensions: '' });
  const [images, setImages] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (images.length < 1 || images.length > 2) return;
    setBusy(true);
    try {
      const upload = await uploadFilesWithProgress(images, (progress) => setMessage(`Upload ${progress}%`));
      const response = await fetch(`/api/product-categories/${categoryId}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, images: upload.files.map((file) => file.url) }),
      });
      if (!response.ok) throw new Error((await response.json()).message);
      await onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Produsul nu a putut fi salvat.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-[#2c2218]/10 bg-[#efe5d8]/55 p-5 md:p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <input required className={inputClass} placeholder="Titlu produs" value={fields.title} onChange={(e) => setFields({ ...fields, title: e.target.value })} />
        <input required className={inputClass} placeholder="Preț (ex: 1.200 lei)" value={fields.price} onChange={(e) => setFields({ ...fields, price: e.target.value })} />
        <input required className={inputClass} placeholder="Dimensiune (ex: 80 × 120 cm)" value={fields.dimensions} onChange={(e) => setFields({ ...fields, dimensions: e.target.value })} />
        <label className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-[#2c2218]/15 bg-[#fffaf4] px-5 text-[10px] font-semibold uppercase tracking-[0.16em] transition hover:border-[#b38b60]">
          {images.length > 0 ? `${images.length}/2 imagini selectate` : 'Alege 1–2 imagini'}
          <input required type="file" multiple accept="image/*" onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 2))} className="sr-only" />
        </label>
        <textarea required rows={4} className="rounded-xl border border-[#2c2218]/15 bg-[#fffaf4] p-4 text-sm outline-none md:col-span-2" placeholder="Descriere" value={fields.description} onChange={(e) => setFields({ ...fields, description: e.target.value })} />
      </div>
      <div className="mt-4 flex items-center gap-4">
        <button disabled={busy || images.length < 1} className={buttonClass}>{busy ? 'Se încarcă…' : 'Încarcă și salvează'}</button>
        <span className="text-xs text-[#2c2218]/50">{images.length}/2 imagini {message}</span>
      </div>
    </form>
  );
}
