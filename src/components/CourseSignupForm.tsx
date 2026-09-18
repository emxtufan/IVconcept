import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { getLegalHref } from '../routes';
import { hasTrackingConsent } from './cookieConsentStorage';
import { getMetaBrowserCookies, trackMetaLead } from './metaPixel';

/** Where the signup came from; stored on the subscriber row and shown in the admin list. */
export type CourseSignupSource = 'course-offer' | 'course-page';

interface CourseSignupFormProps {
  source: CourseSignupSource;
  buttonText: string;
  successMessage: string;
  /** Rendered under the success message, when the form lives in a dialog. */
  onDone?: () => void;
  doneLabel?: string;
  autoFocus?: boolean;
}

const FIELD_CLASS =
  'mt-2 h-12 w-full min-w-0 rounded-lg border border-[#2c2218]/20 bg-white/55 px-4 text-base outline-none transition focus:border-[#8b6847] focus:ring-2 focus:ring-[#8b6847]/20 disabled:opacity-60';

export default function CourseSignupForm({
  source,
  buttonText,
  successMessage,
  onDone,
  doneLabel = 'Continuă pe site',
  autoFocus = false,
}: CourseSignupFormProps) {
  const id = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => () => requestRef.current?.abort(), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (requestRef.current || !event.currentTarget.reportValidity()) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus('sending');
    setMessage('');
    // Marketing measurement only runs on the visitor's accepted consent; the
    // Meta cookies are forwarded as they are, and never invented when missing.
    const trackingConsent = hasTrackingConsent();
    const { fbp, fbc } = trackingConsent ? getMetaBrowserCookies() : { fbp: undefined, fbc: undefined };
    try {
      const response = await fetch('/api/course-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          firstName: name.trim(), email: email.trim(), phone: phone.trim(), gdprAccepted, source,
          trackingConsent,
          ...(trackingConsent ? { eventSourceUrl: window.location.href, ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string; eventId?: string };
      if (!response.ok) throw new Error(payload.message || 'Nu am putut înregistra cererea. Te rugăm să încerci din nou.');
      // A saved signup is the only thing that counts as a Lead. The backend sent
      // the same event id to the Conversions API, so Meta deduplicates the pair.
      if (trackingConsent && payload.eventId) trackMetaLead(payload.eventId);
      setStatus('success');
      setMessage(successMessage);
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

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-[#55744b]/25 bg-[#55744b]/10 p-5" role="status" aria-live="polite">
        <Check className="mb-3 text-[#426b36]" size={24} aria-hidden="true" />
        <p className="text-sm leading-6 text-[#315125]">{message}</p>
        {onDone && (
          <button type="button" onClick={onDone} className="mt-5 border-b border-[#315125]/40 pb-1 text-xs font-semibold text-[#315125]">
            {doneLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={status === 'sending'}>
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
            autoFocus={autoFocus}
            disabled={status === 'sending'}
            onChange={(event) => setName(event.target.value)}
            placeholder="Numele tău complet"
            className={FIELD_CLASS}
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
            className={FIELD_CLASS}
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
        className={FIELD_CLASS}
      />
      <label className="mt-4 flex items-start gap-3 text-sm leading-5 text-[#2c2218]/75">
        <input
          type="checkbox"
          required
          checked={gdprAccepted}
          disabled={status === 'sending'}
          onChange={(event) => setGdprAccepted(event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#2c2218]"
        />
        <span>Sunt de acord să fiu contactat(ă) prin email sau telefon cu oferta și detaliile cursului și cu prelucrarea datelor în acest scop.</span>
      </label>
      <p className="mt-2 pl-7 text-xs leading-5 text-[#2c2218]/55">
        Îți poți retrage acordul oricând. Detalii în{' '}
        <a
          href={getLegalHref(typeof window === 'undefined' ? '' : window.location.hostname, 'privacy')}
          target="_blank"
          rel="noopener noreferrer"
          className="border-b border-[#2c2218]/35 pb-0.5 font-semibold text-[#2c2218]/75"
        >
          Politica de confidențialitate
        </a>
        .
      </p>
      {message && <p className="mt-4 text-sm leading-5 text-red-800" role="alert">{message}</p>}
      <button
        type="submit"
        disabled={status === 'sending'}
        className="mt-5 flex min-h-12 w-full items-center justify-between gap-3 rounded-lg bg-[#2c2218] px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.1em] text-[#f5efe7] transition hover:bg-[#4a3524] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] disabled:opacity-60"
      >
        <span>{status === 'sending' ? 'Se trimite…' : buttonText}</span>
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </form>
  );
}
