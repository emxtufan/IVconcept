type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };

interface MetaWindow extends Window {
  fbq?: Fbq;
  _fbq?: Fbq;
}

/**
 * The pixel id comes from the build environment first (`VITE_META_PIXEL_ID`,
 * set in `.env` and in Vercel), and otherwise from the admin panel, so it can
 * be changed without a redeploy. Both are public values; the Conversions API
 * token is separate and never leaves the server.
 */
export function resolveMetaPixelId(adminPixelId?: string) {
  return import.meta.env.VITE_META_PIXEL_ID?.trim() || adminPixelId?.trim() || '';
}

let loadedPixelId = '';

/**
 * Standard Meta Pixel base code. It is only called after the visitor accepts
 * the cookie banner, because the pixel stores `_fbp` in the browser.
 */
export function loadMetaPixel(pixelId: string) {
  if (!pixelId || loadedPixelId === pixelId || typeof window === 'undefined') return;
  loadedPixelId = pixelId;

  const metaWindow = window as MetaWindow;

  if (!metaWindow.fbq) {
    const fbq: Fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    metaWindow.fbq = fbq;
    metaWindow._fbq = metaWindow._fbq || fbq;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.append(script);
  }

  metaWindow.fbq!('init', pixelId);
  metaWindow.fbq!('track', 'PageView');
}

/**
 * Fires the browser half of the Lead event. `eventID` must be the id the
 * backend generated for this signup, so Meta deduplicates it against the
 * Conversions API copy of the same event.
 */
export function trackMetaLead(eventId: string) {
  if (!eventId || typeof window === 'undefined') return;
  (window as MetaWindow).fbq?.('track', 'Lead', {}, { eventID: eventId });
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith(`${name}=`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match.slice(name.length + 1)) || undefined;
  } catch {
    return undefined;
  }
}

/** The Meta browser cookies, when the pixel has set them. Never invented. */
export function getMetaBrowserCookies() {
  return { fbp: readCookie('_fbp'), fbc: readCookie('_fbc') };
}
