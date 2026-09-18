// Shared by the browser bundle, the Express server and the Vercel page function,
// so a single definition decides what counts as the course route everywhere.
export const SITE_HOST = 'www.ivconcept.ro';
export const SITE_URL = `https://${SITE_HOST}`;
export const COURSE_HOST = 'course.ivconcept.ro';
export const COURSE_PATH = '/curs';
export const COURSE_URL = `https://${COURSE_HOST}`;

export function normalizePathname(pathname: string) {
  return pathname.replace(/\/+$/, '') || '/';
}

export function normalizeHostname(host?: string | null) {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '');
}

export function isCourseHost(host?: string | null) {
  return normalizeHostname(host) === COURSE_HOST;
}

/** The course page answers on `/curs` everywhere and on the root of the course subdomain. */
export function isCourseRoute(host: string | null | undefined, pathname: string) {
  const path = normalizePathname(pathname);
  return path === COURSE_PATH || (isCourseHost(host) && path === '/');
}

/**
 * Link target for every "see the course" button. Production sends visitors to the
 * subdomain; local development and preview deployments stay inside the current
 * origin, where that subdomain does not exist.
 */
export function getCourseHref(host?: string | null) {
  const hostname = normalizeHostname(host);

  if (isCourseHost(hostname)) return '/';
  if (hostname === 'ivconcept.ro' || hostname === SITE_HOST) return COURSE_URL;

  return COURSE_PATH;
}

/** Link back to the main site: the course subdomain has no homepage of its own. */
export function getHomeHref(host?: string | null) {
  return isCourseHost(host) ? SITE_URL : '/';
}

export type LegalDocumentRoute = 'privacy' | 'terms';

export const LEGAL_PATHS: Record<LegalDocumentRoute, string> = {
  privacy: '/confidentialitate',
  terms: '/termeni',
};

export function getLegalRoute(pathname: string): LegalDocumentRoute | null {
  const path = normalizePathname(pathname);
  if (path === LEGAL_PATHS.privacy) return 'privacy';
  if (path === LEGAL_PATHS.terms) return 'terms';
  return null;
}

/**
 * The legal pages live on the main site. The course subdomain links to them with
 * an absolute URL so there is a single address for each document.
 */
export function getLegalHref(host: string | null | undefined, document: LegalDocumentRoute) {
  const path = LEGAL_PATHS[document];
  return isCourseHost(host) ? `${SITE_URL}${path}` : path;
}
