import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import type { CourseOfferContent } from '../types/siteContent';
import { useAccessibleDialog } from './useAccessibleDialog';

interface CourseOfferModalProps {
  content: CourseOfferContent;
  isOpen: boolean;
  onClose: () => void;
}

export default function CourseOfferModal({ content, isOpen, onClose }: CourseOfferModalProps) {
  const id = useId();
  const dialogRef = useAccessibleDialog(isOpen, onClose);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !event.currentTarget.reportValidity()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('sending');
    setMessage('');
    try {
      const response = await fetch('/api/course-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ firstName: name.trim(), email: email.trim(), phone: phone.trim(), gdprAccepted, source: 'course-offer' }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut înregistra cererea. Te rugăm să încerci din nou.');
      setStatus('success');
      setMessage(content.successMessage);
      setName('');
      setEmail('');
      setPhone('');
      setGdprAccepted(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Conexiunea a fost întreruptă. Încearcă din nou.');
    } finally {
      requestRef.current = null;
    }
  }

  if (!isOpen || typeof document === 'undefined') return null;

  const usableImage = (url?: string) => {
    if (!url?.trim()) return '';
    try {
      return failedImages.includes(new URL(url.trim(), document.baseURI).href) ? '' : url.trim();
    } catch {
      return '';
    }
  };
  const desktopImage = usableImage(content.imageUrl);
  const mobileImage = usableImage(content.mobileImageUrl);
  const fallbackImage = desktopImage || mobileImage;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] overflow-y-auto bg-[#130a01]/75 p-3 backdrop-blur-md sm:p-6"
      data-lenis-prevent
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="pointer-events-none flex min-h-full items-center justify-center">
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          tabIndex={-1}
          className="pointer-events-auto relative my-auto grid w-full max-w-[900px] overflow-hidden rounded-2xl bg-[#ede4d8] text-[#2c2218] shadow-[0_35px_120px_rgba(0,0,0,0.45)] outline-none md:grid-cols-[0.85fr_1fr]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide oferta de curs"
            className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-[#2c2218]/15 bg-[#ede4d8]/95 text-[#2c2218] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] sm:right-4 sm:top-4"
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="relative overflow-hidden bg-[#2c2218] md:min-h-[510px]">
            {fallbackImage ? (
              <picture className="block md:absolute md:inset-0">
                {mobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
                <img
                  src={fallbackImage}
                  alt="Lucrări decorative IV Concept"
                  className="block h-auto w-full md:h-full md:object-cover"
                  fetchPriority="high"
                  onError={(event) => {
                    const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src;
                    setFailedImages((images) => images.includes(failedUrl) ? images : [...images, failedUrl]);
                  }}
                />
              </picture>
            ) : (
              <div aria-hidden="true" className="aspect-[4/3] bg-[radial-gradient(ellipse_at_top_left,#aa8962,transparent_70%),linear-gradient(145deg,#776047,#2c2218)] md:absolute md:inset-0 md:aspect-auto" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#130a01]/80 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-6 text-white md:bottom-8 md:left-8">
              <span className="block font-display text-2xl tracking-tight md:text-3xl">IV Concept</span>
              <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.24em] text-white/80">Cursuri · Artă decorativă</span>
            </div>
          </div>
          <div className="px-6 py-7 sm:px-8 sm:py-9 md:px-10 md:pb-10 md:pt-16">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8b6847]">Învață alături de noi</span>
            <h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus className="mt-4 font-display text-3xl font-light leading-[1.12] tracking-[-0.045em] outline-none sm:text-4xl">{content.title}</h2>
            <p id={`${id}-description`} className="mt-4 whitespace-pre-line text-sm leading-6 text-[#2c2218]/75">{content.description}</p>

            {status === 'success' ? (
              <div className="mt-7 rounded-xl border border-[#55744b]/25 bg-[#55744b]/10 p-5" role="status" aria-live="polite">
                <Check className="mb-3 text-[#426b36]" size={24} aria-hidden="true" />
                <p className="text-sm leading-6 text-[#315125]">{message}</p>
                <button type="button" onClick={onClose} className="mt-5 border-b border-[#315125]/40 pb-1 text-xs font-semibold text-[#315125]">Continuă pe site</button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-7" aria-busy={status === 'sending'}>
                <div className="mb-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor={`${id}-name`} className="block text-sm font-semibold">Nume</label>
                    <input
                      id={`${id}-name`}
                      name="name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={100}
                      pattern={String.raw`.*\S.*`}
                      title="Completează numele tău."
                      value={name}
                      disabled={status === 'sending'}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Numele tău complet"
                      className="mt-2 h-12 w-full min-w-0 rounded-lg border border-[#2c2218]/20 bg-white/55 px-4 text-base outline-none transition focus:border-[#8b6847] focus:ring-2 focus:ring-[#8b6847]/20 disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${id}-phone`} className="block text-sm font-semibold">Număr de telefon</label>
                    <input
                      id={`${id}-phone`}
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={30}
                      pattern={String.raw`\+?[0-9\s\(\)\-]{7,30}`}
                      title="Introdu un număr de telefon valid, de exemplu 0712 345 678."
                      value={phone}
                      disabled={status === 'sending'}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="0712 345 678"
                      className="mt-2 h-12 w-full min-w-0 rounded-lg border border-[#2c2218]/20 bg-white/55 px-4 text-base outline-none transition focus:border-[#8b6847] focus:ring-2 focus:ring-[#8b6847]/20 disabled:opacity-60"
                    />
                  </div>
                </div>
                <label htmlFor={`${id}-email`} className="block text-sm font-semibold">Adresa ta de email</label>
                <input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  disabled={status === 'sending'}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nume@email.com"
                  className="mt-2 h-12 w-full rounded-lg border border-[#2c2218]/20 bg-white/55 px-4 text-base outline-none transition focus:border-[#8b6847] focus:ring-2 focus:ring-[#8b6847]/20 disabled:opacity-60"
                />
                <label className="mt-4 flex items-start gap-3 text-sm leading-5 text-[#2c2218]/75">
                  <input type="checkbox" required checked={gdprAccepted} disabled={status === 'sending'} onChange={(event) => setGdprAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#2c2218]" />
                  <span>Sunt de acord să fiu contactat(ă) prin email sau telefon cu oferta și detaliile cursului și cu prelucrarea datelor în acest scop.</span>
                </label>
                {message && <p className="mt-4 text-sm leading-5 text-red-800" role="alert">{message}</p>}
                <button type="submit" disabled={status === 'sending'} className="mt-5 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-[#2c2218] px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#f5efe7] transition hover:bg-[#4a3524] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] disabled:opacity-60">
                  <span>{status === 'sending' ? 'Se trimite…' : content.buttonText}</span>
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
