import { COURSE_URL, getLegalRoute, isCourseRoute, LEGAL_PATHS, SITE_URL } from './routes';

export interface PageMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: string;
  image?: string;
}

const SITE_ORIGIN = SITE_URL;
export function getPageMetadata(pathname: string, category?: { title: string; slug: string; image: string } | null, hostname?: string): PageMetadata {
  const path = pathname.replace(/\/+$/, '') || '/';
  const common = { canonical: `${SITE_ORIGIN}${path === '/' ? '' : path}`, robots: 'index, follow' };
  if (path === '/admin' || path.startsWith('/admin/')) {
    return { ...common, title: 'Administrare | IV Concept', description: 'Panoul de administrare IV Concept.', robots: 'noindex, nofollow' };
  }
  // The course subdomain is the single indexed address for the course, so /curs
  // and course.ivconcept.ro share one canonical URL.
  if (isCourseRoute(hostname, path)) {
    return {
      ...common,
      canonical: COURSE_URL,
      title: 'Curs de finisaje decorative | IV Concept',
      description: 'Cursul IV Concept de finisaje decorative: ce înveți, cum se desfășoară și cum te înscrii. Completează formularul și te contactăm cu oferta și detaliile cursului.',
    };
  }
  // The legal pages belong to the main site, whichever host serves them.
  const legalRoute = getLegalRoute(path);
  if (legalRoute) {
    return legalRoute === 'privacy'
      ? {
          ...common,
          canonical: `${SITE_ORIGIN}${LEGAL_PATHS.privacy}`,
          title: 'Politica de confidențialitate | IV Concept',
          description: 'Ce date personale colectăm prin formularele IV Concept, în ce scop, cât timp le păstrăm și ce drepturi ai asupra lor.',
        }
      : {
          ...common,
          canonical: `${SITE_ORIGIN}${LEGAL_PATHS.terms}`,
          title: 'Termeni și condiții | IV Concept',
          description: 'Condițiile de utilizare a site-ului IV Concept, regulile pentru oferte, comenzi, produse personalizate și înscrierea la curs.',
        };
  }
  if (path === '/galerie-foto') {
    return { ...common, title: 'Galerie foto | IV Concept', description: 'Descoperă galeria proiectelor IV Concept: finisaje decorative, oglinzi și amenajări interioare.' };
  }
  if (path === '/produse' || path.startsWith('/produse/')) {
    if (category === null) {
      return { ...common, title: 'Categorie negăsită | IV Concept', description: 'Explorează colecțiile de produse IV Concept.', robots: 'noindex, follow' };
    }
    return {
      ...common,
      title: category ? `${category.title} | IV Concept` : 'Colecții de produse | IV Concept',
      description: category ? `Descoperă colecția ${category.title} de la IV Concept. Fotografii, dimensiuni și prețuri pentru fiecare produs.` : 'Descoperă colecțiile de produse IV Concept, fotografiile, dimensiunile și prețurile.',
      ...(category ? { canonical: `${SITE_ORIGIN}/produse/${encodeURIComponent(category.slug)}`, image: category.image } : {}),
    };
  }
  return { ...common, title: 'IV Concept | Design interior, oglinzi și finisaje decorative', description: 'IV Concept creează interioare, oglinzi personalizate și pereți decorativi, cu atenție la detalii, proporție și atmosferă.' };
}

export function applyPageMetadata(metadata: PageMetadata) {
  document.title = metadata.title;
  document.documentElement.lang = 'ro';
  const setMeta = (key: string, value: string, property = false) => {
    const attribute = property ? 'property' : 'name';
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attribute, key);
      document.head.append(element);
    }
    element.content = value;
  };
  setMeta('description', metadata.description);
  setMeta('robots', metadata.robots);
  setMeta('og:title', metadata.title, true);
  setMeta('og:description', metadata.description, true);
  setMeta('og:url', metadata.canonical, true);
  setMeta('og:locale', 'ro_RO', true);
  setMeta('twitter:title', metadata.title);
  setMeta('twitter:description', metadata.description);
  if (metadata.image) {
    setMeta('og:image', metadata.image, true);
    setMeta('twitter:image', metadata.image);
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = metadata.canonical;
}
