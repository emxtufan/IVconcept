import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ProductCategoryRecord, ProductRecord } from '../types/products';
import { uploadFilesWithProgress } from './uploadClient';

const inputClass = 'h-11 w-full rounded-xl border border-[#2c2218]/15 bg-[#fffaf4] px-4 text-sm outline-none focus:border-[#b38b60]';
const buttonClass = 'rounded-full bg-[#2c2218] px-5 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-40';
const secondaryClass = 'rounded-full border border-[#2c2218]/20 px-4 py-3 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-40';
const dangerClass = 'rounded-full border border-red-900/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-800 disabled:opacity-40';

async function checkResponse(response: Response, fallback: string) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(payload.message || fallback);
  }
  return response;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type Editor = { kind: 'category'; categoryId: number } | { kind: 'product'; categoryId: number; productId?: number };
type FormProps = {
  onSaved: (categories: ProductCategoryRecord[]) => void;
  onCancel?: () => void;
  onBusyChange: (busy: boolean) => void;
};

export default function ProductsPanel() {
  const [categories, setCategories] = useState<ProductCategoryRecord[]>([]);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createVersion, setCreateVersion] = useState(0);
  const pending = useRef(false);

  const updateBusy = (value: boolean) => {
    pending.current = value;
    setBusy(value);
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/product-categories')
      .then((response) => checkResponse(response, 'Nu am putut încărca produsele.'))
      .then((response) => response.json() as Promise<ProductCategoryRecord[]>)
      .then((data) => { if (!cancelled) setCategories(data); })
      .catch((loadError) => { if (!cancelled) setError(errorMessage(loadError, 'Nu am putut încărca produsele.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const deleteEntry = async (kind: 'category' | 'product', id: number) => {
    if (pending.current || !window.confirm(kind === 'category' ? 'Ștergi categoria și toate produsele sale?' : 'Ștergi produsul?')) return;
    updateBusy(true);
    setMessage('');
    setError('');
    try {
      await checkResponse(await fetch(`/api/${kind === 'category' ? 'product-categories' : 'products'}/${id}`, { method: 'DELETE' }), 'Ștergerea nu a reușit. Încearcă din nou.');
      setCategories((current) => kind === 'category'
        ? current.filter((category) => category.id !== id)
        : current.map((category) => ({ ...category, products: category.products.filter((product) => product.id !== id) })));
      setEditor((current) => current && ((kind === 'category' && current.categoryId === id) || (kind === 'product' && current.kind === 'product' && current.productId === id)) ? null : current);
      setMessage(kind === 'category' ? 'Categoria a fost ștearsă.' : 'Produsul a fost șters.');
    } catch (deleteError) {
      setError(errorMessage(deleteError, 'Ștergerea nu a reușit.'));
    } finally {
      updateBusy(false);
    }
  };

  const saved = (data: ProductCategoryRecord[]) => {
    setCategories(data);
    setEditor(null);
    setError('');
    setMessage('Modificările au fost salvate.');
  };

  return (
    <fieldset disabled={busy || loading} className="min-w-0 space-y-8">
      <CategoryForm key={createVersion} onBusyChange={updateBusy} onSaved={(data) => { saved(data); setCreateVersion((value) => value + 1); }} />
      {loading && <p role="status" className="text-sm">Se încarcă produsele…</p>}
      {message && <p role="status" className="text-sm text-[#2c2218]/70">{message}</p>}
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {categories.map((category) => (
        <section key={category.id} className="overflow-hidden rounded-[26px] border border-[#2c2218]/10 bg-[#fbf6f0]">
          <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
            <div className="flex items-center gap-4">
              <img src={category.image} alt={category.title} className="h-20 w-24 rounded-xl object-cover" />
              <div><h3 className="text-xl font-semibold">{category.title}</h3><p className="mt-1 text-xs text-[#2c2218]/50">{category.products.length} produse</p></div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setEditor({ kind: 'category', categoryId: category.id })} className={secondaryClass}>Editează categoria</button>
              <button type="button" onClick={() => setEditor({ kind: 'product', categoryId: category.id })} className={buttonClass}>Adaugă produs</button>
              <button type="button" onClick={() => void deleteEntry('category', category.id)} className={dangerClass}>Șterge categoria</button>
            </div>
          </div>
          {editor?.categoryId === category.id && editor.kind === 'category' && (
            <CategoryForm key={`category-${category.id}`} category={category} onSaved={saved} onCancel={() => setEditor(null)} onBusyChange={updateBusy} />
          )}
          {editor?.categoryId === category.id && editor.kind === 'product' && (
            <ProductForm key={`product-${editor.productId ?? `new-${category.id}`}`} categoryId={category.id} product={category.products.find((product) => product.id === editor.productId)} onSaved={saved} onCancel={() => setEditor(null)} onBusyChange={updateBusy} />
          )}
          {category.products.length > 0 && (
            <div className="grid gap-4 border-t border-[#2c2218]/10 p-5 md:grid-cols-2 md:p-6">
              {category.products.map((product) => (
                <div key={product.id} className="flex gap-4 rounded-2xl border border-[#2c2218]/10 bg-white/50 p-4">
                  <img src={product.images[0]} alt={product.title} className="h-24 w-20 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold">{product.title}</h4>
                    <p className="mt-1 text-xs text-[#2c2218]/55">{product.price} · {product.dimensions}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditor({ kind: 'product', categoryId: category.id, productId: product.id })} className={secondaryClass}>Editează</button>
                      <button type="button" onClick={() => void deleteEntry('product', product.id)} className={dangerClass}>Șterge</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </fieldset>
  );
}

function CategoryForm({ category, onSaved, onCancel, onBusyChange }: FormProps & { category?: ProductCategoryRecord }) {
  const [title, setTitle] = useState(category?.title ?? '');
  const [image, setImage] = useState(category?.image ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || !title.trim() || (!image && !file)) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      let imageUrl = image;
      if (file) {
        const uploaded = await uploadFilesWithProgress([file], (progress) => setMessage(`Se încarcă imaginea: ${progress}%`));
        if (!uploaded.files[0]?.url) throw new Error('Imaginea nu a putut fi încărcată.');
        imageUrl = uploaded.files[0].url;
        setImage(imageUrl);
        setFile(null);
        if (input.current) input.current.value = '';
      }
      setMessage('Se salvează categoria…');
      const response = await checkResponse(await fetch(category ? `/api/product-categories/${category.id}` : '/api/product-categories', {
        method: category ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), image: imageUrl }),
      }), 'Categoria nu a putut fi salvată.');
      onSaved(await response.json() as ProductCategoryRecord[]);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Categoria nu a putut fi salvată.'));
      setMessage('');
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-[26px] border border-[#2c2218]/10 bg-[#fbf6f0] p-5 md:p-6">
      <h3 className="text-lg font-semibold">{category ? 'Editează categoria' : 'Creează categorie'}</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold">Titlu
          <input required value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-2`} placeholder="Ex: Oglinzi" />
        </label>
        <label className="text-xs font-semibold">{image ? 'Înlocuiește imaginea (opțional)' : 'Imagine categorie'}
          <input ref={input} type="file" accept="image/*" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(''); }} className="mt-2 block w-full text-xs" />
        </label>
      </div>
      {image && <img src={image} alt="Imaginea categoriei" className="mt-4 h-24 w-32 rounded-xl object-cover" />}
      {file && <p className="mt-3 text-xs">Imagine nouă: {file.name}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <button disabled={busy || !title.trim() || (!image && !file)} className={buttonClass}>{busy ? 'Se salvează…' : category ? 'Salvează categoria' : 'Creează categoria'}</button>
        {onCancel && <button type="button" onClick={onCancel} disabled={busy} className={secondaryClass}>Anulează</button>}
      </div>
      {message && <p role="status" className="mt-4 text-sm text-[#2c2218]/60">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    </form>
  );
}

function ProductForm({ categoryId, product, onSaved, onCancel, onBusyChange }: FormProps & { categoryId: number; product?: ProductRecord }) {
  const [fields, setFields] = useState({ title: product?.title ?? '', description: product?.description ?? '', price: product?.price ?? '', dimensions: product?.dimensions ?? '' });
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const imageCount = images.length + files.length;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending.current || imageCount < 1 || imageCount > 2 || Object.values(fields).some((value) => !value.trim())) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      let nextImages = images;
      if (files.length > 0) {
        const uploaded = await uploadFilesWithProgress(files, (progress) => setMessage(`Se încarcă imaginile: ${progress}%`));
        if (uploaded.files.length !== files.length) throw new Error('Nu au fost încărcate toate imaginile.');
        nextImages = [...images, ...uploaded.files.map((file) => file.url)];
        // Retain completed uploads if saving fails, so a retry does not upload duplicates.
        setImages(nextImages);
        setFiles([]);
        if (input.current) input.current.value = '';
      }
      setMessage('Se salvează produsul…');
      const response = await checkResponse(await fetch(product ? `/api/products/${product.id}` : `/api/product-categories/${categoryId}/products`, {
        method: product ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, images: nextImages }),
      }), 'Produsul nu a putut fi salvat.');
      onSaved(await response.json() as ProductCategoryRecord[]);
    } catch (saveError) {
      setError(errorMessage(saveError, 'Produsul nu a putut fi salvat.'));
      setMessage('');
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <form onSubmit={submit} className="border-t border-[#2c2218]/10 bg-[#efe5d8]/55 p-5 md:p-6">
      <h3 className="mb-5 text-lg font-semibold">{product ? 'Editează produsul' : 'Adaugă produs'}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {(['title', 'price', 'dimensions'] as const).map((key) => (
          <label key={key} className="text-xs font-semibold">{{ title: 'Titlu produs', price: 'Preț', dimensions: 'Dimensiuni' }[key]}
            <input required className={`${inputClass} mt-2`} value={fields[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))} />
          </label>
        ))}
        <label className="text-xs font-semibold">Adaugă imagini ({imageCount}/2)
          <input ref={input} type="file" multiple accept="image/*" className="mt-3 block w-full text-xs" disabled={imageCount >= 2} onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (selected.length + imageCount > 2) {
              setError('Poți păstra cel mult două imagini. Elimină o imagine înainte să o înlocuiești.');
              return;
            }
            setFiles((current) => [...current, ...selected]);
            setError('');
          }} />
        </label>
        <label className="text-xs font-semibold md:col-span-2">Descriere
          <textarea required rows={4} className="mt-2 w-full rounded-xl border border-[#2c2218]/15 bg-[#fffaf4] p-4 text-sm outline-none" value={fields.description} onChange={(event) => setFields((current) => ({ ...current, description: event.target.value }))} />
        </label>
      </div>
      <p className="mt-4 text-xs text-[#2c2218]/60">Păstrează între una și două imagini. Pentru înlocuire, elimină imaginea dorită și adaugă una nouă; modificarea se aplică la salvare.</p>
      <div className="mt-4 flex flex-wrap gap-4">
        {images.map((url, index) => (
          <div key={`${url}-${index}`} className="space-y-2">
            <img src={url} alt={`Imagine produs ${index + 1}`} className="h-24 w-24 rounded-xl object-cover" />
            <button type="button" className={dangerClass} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Elimină</button>
          </div>
        ))}
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="max-w-48 space-y-2 rounded-xl border border-[#2c2218]/15 p-3">
            <p className="break-all text-xs">{file.name}</p>
            <button type="button" className={dangerClass} onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Elimină</button>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button disabled={busy || imageCount < 1 || imageCount > 2 || Object.values(fields).some((value) => !value.trim())} className={buttonClass}>{busy ? 'Se salvează…' : 'Salvează produsul'}</button>
        <button type="button" disabled={busy} onClick={onCancel} className={secondaryClass}>Anulează</button>
      </div>
      {message && <p role="status" className="mt-4 text-sm text-[#2c2218]/60">{message}</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    </form>
  );
}
