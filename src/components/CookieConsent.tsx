import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSiteContent } from '../data';
import { getLegalHref } from '../routes';
import {
  clearStoredAnswers,
  CONSENT_KEY,
  NOTICE_KEY,
  parseStoredAnswer,
  readStoredValue,
  serializeAnswer,
  writeStoredValue,
  type CookieChoice,
} from './cookieConsentStorage';
import { loadMetaPixel, resolveMetaPixelId } from './metaPixel';

const REOPEN_EVENT = 'iv-cookie-settings';

export { hasTrackingConsent } from './cookieConsentStorage';

/** Clears the saved answer so the banner asks again. Used by the privacy page. */
export function resetCookieChoice() {
  clearStoredAnswers();
}

/** Lets any "cookie settings" link bring the banner back, without a page reload. */
export function openCookieSettings() {
  clearStoredAnswers();
  window.dispatchEvent(new Event(REOPEN_EVENT));
}

let analyticsLoaded = false;

function loadAnalytics(measurementId: string) {
  if (analyticsLoaded || !measurementId) return;
  analyticsLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);

  const globalWindow = window as unknown as { dataLayer?: unknown[] };
  globalWindow.dataLayer = globalWindow.dataLayer || [];
  function gtag(...args: unknown[]) {
    globalWindow.dataLayer!.push(args);
  }
  gtag('js', new Date());
  gtag('config', measurementId, { anonymize_ip: true });
}

function useBannerAvailability() {
  const legal = getSiteContent().legal;
  const measurementId = legal.googleAnalyticsId;
  const pixelId = resolveMetaPixelId(legal.metaPixelId);
  const needsConsent = Boolean(measurementId || pixelId);

  return { legal, measurementId, pixelId, needsConsent, available: needsConsent || legal.showCookieBanner };
}

/**
 * A discreet way back for someone who answered before. Nothing is ever asked
 * twice on its own: the visitor opens this themselves, or the banner returns
 * by itself once the stored answer expires.
 */
export function CookieSettingsLink({ className, label = 'Setări cookie-uri' }: { className?: string; label?: string }) {
  const { available } = useBannerAvailability();
  if (!available) return null;

  return (
    <button type="button" onClick={openCookieSettings} className={className}>
      {label}
    </button>
  );
}

/**
 * Two different jobs, decided by whether a tracking ID - Google Analytics or
 * the Meta pixel - is configured in the admin panel:
 *
 * - with tracking configured, consent is legally required, so the banner always
 *   asks and nothing loads before the visitor answers;
 * - without it the site only sets the strictly necessary admin session cookie,
 *   so the banner is a plain notice that can be switched off from the admin and
 *   never claims to manage cookies the site does not set.
 */
export default function CookieConsent() {
  const { legal, measurementId, pixelId, needsConsent } = useBannerAvailability();
  const [answered, setAnswered] = useState<boolean | undefined>(undefined);

  const startTracking = () => {
    if (measurementId) loadAnalytics(measurementId);
    if (pixelId) loadMetaPixel(pixelId);
  };

  useEffect(() => {
    if (needsConsent) {
      const choice = parseStoredAnswer(readStoredValue(CONSENT_KEY));
      setAnswered(choice !== null);
      if (choice === 'accepted') startTracking();
    } else {
      setAnswered(parseStoredAnswer(readStoredValue(NOTICE_KEY)) === 'seen');
    }

    const reopen = () => setAnswered(false);
    window.addEventListener(REOPEN_EVENT, reopen);
    return () => window.removeEventListener(REOPEN_EVENT, reopen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsConsent, measurementId, pixelId]);

  // `undefined` means the stored answer has not been read yet: showing the
  // banner before that would make it flash on every page load.
  if (answered === undefined || answered) return null;
  if (!needsConsent && !legal.showCookieBanner) return null;
  if (typeof document === 'undefined') return null;

  const answer = (choice: CookieChoice) => {
    writeStoredValue(CONSENT_KEY, serializeAnswer(choice));
    setAnswered(true);
    if (choice === 'accepted') startTracking();
  };

  const dismissNotice = () => {
    writeStoredValue(NOTICE_KEY, serializeAnswer('seen'));
    setAnswered(true);
  };

  const secondaryButton =
    'min-h-11 flex-1 rounded-lg border border-[#2c2218]/25 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-[#2c2218] transition hover:border-[#2c2218] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] md:flex-none';
  const primaryButton =
    'min-h-11 flex-1 rounded-lg border border-[#2c2218] bg-[#2c2218] px-6 text-xs font-semibold uppercase tracking-[0.1em] text-[#f5efe7] transition hover:bg-[#4a3524] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] md:flex-none';

  // Rendered into the body, above the course offer dialog: the page layers of
  // the site would otherwise trap the banner under it and the visitor could not
  // answer at all.
  return createPortal(
    <div
      role="region"
      aria-label="Preferințe cookie-uri"
      className="fixed inset-x-0 bottom-0 z-[10001] border-t border-[#2c2218]/15 bg-[#ede4d8]/98 px-5 py-5 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] backdrop-blur sm:px-8"
    >
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5 md:flex-row md:items-center md:justify-between md:gap-10">
        <p className="text-sm leading-6 text-[#2c2218]/80">
          {needsConsent ? legal.cookieBannerText : legal.cookieNoticeText}{' '}
          <a
            href={getLegalHref(window.location.hostname, 'privacy')}
            className="whitespace-nowrap border-b border-[#2c2218]/40 pb-0.5 font-semibold text-[#2c2218]"
          >
            Politica de confidențialitate
          </a>
        </p>
        <div className="flex shrink-0 gap-3">
          {needsConsent ? (
            <>
              <button type="button" onClick={() => answer('rejected')} className={secondaryButton}>
                {legal.cookieRejectText}
              </button>
              <button type="button" onClick={() => answer('accepted')} className={primaryButton}>
                {legal.cookieAcceptText}
              </button>
            </>
          ) : (
            <button type="button" onClick={dismissNotice} className={primaryButton}>
              {legal.cookieNoticeButtonText}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
