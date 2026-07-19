import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getSiteContent } from '../data';

const SECTION_ANCHORS: Record<string, string> = {
  home: '#hero',
  acasa: '#hero',
  about: '#despre',
  'about me': '#despre',
  despre: '#despre',
  gallery: '#gallery-section',
  galerie: '#gallery-section',
  'galerie foto': '#gallery-section',
  journal: '#gallery-section',
  jurnal: '#gallery-section',
  commitment: '#commitment-section',
  angajament: '#commitment-section',
  work: '#lucrari',
  lucrari: '#lucrari',
  portfolio: '#lucrari',
  portofoliu: '#lucrari',
  piesele: '#lucrari',
  services: '#services',
  servicii: '#services',
  'pasii de colaborare': '#services',
  projects: '#proiecte',
  proiecte: '#proiecte',
  'proiecte pereti': '#proiecte',
  story: '#povestea',
  povestea: '#povestea',
  poveste: '#povestea',
  cursuri: '#povestea',
  reviews: '#recenzii',
  recenzii: '#recenzii',
  reactii: '#recenzii',
  reactiile: '#recenzii',
  review: '#recenzii',
  contact: '#contact',
  oferta: '#contact',
};

function resolveSectionHref(label: string) {
  const normalizedLabel = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (SECTION_ANCHORS[normalizedLabel]) {
    return SECTION_ANCHORS[normalizedLabel];
  }

  if (normalizedLabel.includes('galer')) return '#gallery-section';
  if (normalizedLabel.includes('acas') || normalizedLabel.includes('home')) return '#hero';
  if (normalizedLabel.includes('despre') || normalizedLabel.includes('about')) return '#despre';
  if (normalizedLabel.includes('pies') || normalizedLabel.includes('lucr') || normalizedLabel.includes('portof')) return '#lucrari';
  if (normalizedLabel.includes('servic') || normalizedLabel.includes('colabor')) return '#services';
  if (normalizedLabel.includes('proiect') || normalizedLabel.includes('peret')) return '#proiecte';
  if (normalizedLabel.includes('curs') || normalizedLabel.includes('povest')) return '#povestea';
  if (normalizedLabel.includes('react') || normalizedLabel.includes('recenz') || normalizedLabel.includes('review')) return '#recenzii';
  if (normalizedLabel.includes('contact') || normalizedLabel.includes('ofert')) return '#contact';

  return '#hero';
}

function softenNewsletterLine(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed !== trimmed.toUpperCase()) return value;
  const lower = trimmed.toLocaleLowerCase('ro-RO');
  return lower.charAt(0).toLocaleUpperCase('ro-RO') + lower.slice(1);
}

export default function Footer() {
  const footerContent = getSiteContent().footer;
  const studioLinks = footerContent.studioLinks;
  const projectLinks = footerContent.projectLinks;
  const socialLinks = footerContent.socialLinks;
  const footerImage = footerContent.imageUrl;
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle',
  );
  const [newsletterMessage, setNewsletterMessage] = useState('');
  const [legalModal, setLegalModal] = useState<'privacy' | 'terms' | null>(null);

  useEffect(() => {
    if (!legalModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLegalModal(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [legalModal]);

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = newsletterEmail.trim();

    if (!email) {
      setNewsletterState('error');
      setNewsletterMessage('Please enter your email address.');
      return;
    }

    try {
      setNewsletterState('loading');
      setNewsletterMessage('');

      const response = await fetch('/api/newsletter-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? 'Subscription failed.');
      }

      setNewsletterState('success');
      setNewsletterMessage(payload.message ?? 'Subscribed successfully.');
      setNewsletterEmail('');
    } catch (error) {
      setNewsletterState('error');
      setNewsletterMessage(
        error instanceof Error ? error.message : 'Could not save your subscription.',
      );
    }
  };

  return (
    <>
    <footer className="relative z-40 text-white">
      <div className="sticky top-[calc(100svh-300px)] z-0 h-[300px] overflow-hidden">
        <img
          src={footerImage}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />

        <div className="relative mx-auto flex h-full max-w-[1310px] flex-col px-6 pt-12 md:px-12 md:pt-14 xl:px-0">
          <div className="grid gap-5 text-[14px] text-white/92 md:grid-cols-3 md:items-start">
            <div>{footerContent.copyright}</div>
            <div className="md:text-center">{footerContent.craftedText}</div>
            <div />
          </div>

          <div className="relative mt-auto h-[54%] overflow-visible">
            <div className="pointer-events-none absolute bottom-[-0.27em] left-1/2 -translate-x-1/2 whitespace-nowrap font-sans text-[clamp(78px,18vw,118px)] font-semibold leading-none tracking-[-0.095em] text-white/96 md:text-[clamp(118px,15vw,292px)]">
              {footerContent.wordmark}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-[300px]">
        <div className="relative overflow-hidden bg-[#130a01]">
          <div className="relative mx-auto max-w-[1310px] px-6 py-16 md:px-12 md:py-20 xl:px-0">
            <div className="grid gap-x-10 gap-y-14 md:grid-cols-2 lg:grid-cols-[238px_150px_250px_360px] lg:justify-between">
              <div className="space-y-11">
                <div>
                  <div className="flex items-center gap-2.5 font-sans text-[16px] font-semibold tracking-[-0.035em] text-white">
                    <span className="inline-block -skew-x-[18deg] tracking-[-0.28em] text-[17px]">
                      ///
                    </span>
                    <span>{footerContent.brandName}</span>
                  </div>
                  <div className="mt-4 text-[11px] font-semibold uppercase tracking-[-0.01em] text-white/62">
                    {footerContent.descriptor}
                  </div>
                </div>

                <div className="space-y-0.5 text-[14px] leading-[1.45] text-white/82">
                  <p>{footerContent.address}</p>
                  <p>{footerContent.email}</p>
                  <p>{footerContent.phone}</p>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[-0.01em] text-[#c9a277]">
                  {footerContent.studioLabel}
                </div>
                <nav className="mt-11 flex flex-col text-[15px] leading-[1.3] text-white/84">
                  {studioLinks.map((link) => (
                    <a
                      key={link}
                      href={resolveSectionHref(link)}
                      className="w-fit py-1 transition hover:text-[#c9a277]"
                    >
                      {link}
                    </a>
                  ))}
                </nav>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[-0.01em] text-[#c9a277]">
                  {footerContent.projectsLabel}
                </div>
                <nav className="mt-11 flex flex-col text-[15px] leading-[1.3] text-white/84">
                  {projectLinks.map((link) => (
                    <a key={link} href="#proiecte" className="w-fit py-1 transition hover:text-[#c9a277]">
                      {link}
                    </a>
                  ))}
                </nav>
              </div>

              <div className="max-w-[360px]">
                <h3 className="max-w-[320px] font-sans">
                  <span className="block text-[19px] font-semibold uppercase leading-[1.15] tracking-[0.035em] text-white sm:text-[20px]">
                    {footerContent.newsletterLine1}
                  </span>
                  <span className="mt-3 block text-[14px] font-normal leading-[1.55] tracking-[-0.005em] text-white/65">
                    {softenNewsletterLine(footerContent.newsletterLine2)}
                  </span>
                  <span className="mt-1 block text-[14px] font-normal leading-[1.55] tracking-[-0.005em] text-white/65">
                    {softenNewsletterLine(footerContent.newsletterLine3)}
                  </span>
                </h3>

                <form className="mt-8" onSubmit={handleNewsletterSubmit}>
                  <input
                    type="email"
                    value={newsletterEmail}
                    onChange={(event) => setNewsletterEmail(event.target.value)}
                    placeholder={footerContent.newsletterPlaceholder}
                    className="h-[42px] w-full border-none bg-[#201b18] px-4 text-[14px] text-white/68 outline-none placeholder:text-white/48"
                  />
                  <button
                    type="submit"
                    disabled={newsletterState === 'loading'}
                    className="mt-2 flex w-full items-center justify-between border-t border-white/26 pt-3 text-left text-[14px] font-semibold uppercase tracking-[-0.01em] text-white disabled:opacity-50"
                  >
                    <span>
                      {newsletterState === 'loading'
                        ? 'SUBSCRIBING...'
                        : footerContent.newsletterButtonText}
                    </span>
                    <span aria-hidden="true" className="text-[24px] leading-none">
                      &rarr;
                    </span>
                  </button>
                  {newsletterMessage ? (
                    <p
                      className={`mt-4 max-w-[300px] text-[12px] leading-[1.52] ${
                        newsletterState === 'error' ? 'text-[#f0b3b3]' : 'text-[#d9c1a0]'
                      }`}
                    >
                      {newsletterMessage}
                    </p>
                  ) : null}
                  <p className="mt-6 max-w-[300px] text-[12px] leading-[1.52] text-white/70">
                    {footerContent.newsletterDescription}
                  </p>
                </form>
              </div>
            </div>
          </div>

          <div className="border-t border-white/8 px-6 py-7 text-center md:px-12">
            <a
              href={footerContent.developerCreditUrl || undefined}
              target={footerContent.developerCreditUrl ? '_blank' : undefined}
              rel={footerContent.developerCreditUrl ? 'noreferrer noopener' : undefined}
              onClick={(event) => {
                if (!footerContent.developerCreditUrl) event.preventDefault();
              }}
              className="inline-flex text-[12px] font-medium tracking-[0.035em] text-white/52 transition hover:text-[#c9a277]"
            >
              {footerContent.developerCreditText}
            </a>
          </div>

          <div className="border-t border-white/12">
            <div className="relative mx-auto max-w-[1310px] px-6 py-8 md:px-12 xl:px-0">
              <div className="flex flex-nowrap items-center justify-start gap-6 overflow-x-auto pb-1 text-[14px] text-white/76 md:justify-between md:gap-8">
                {socialLinks.map((link) => (
                  <a
                    key={`${link.label}-${link.url}`}
                    href={link.url || undefined}
                    target={link.url ? '_blank' : undefined}
                    rel={link.url ? 'noreferrer noopener' : undefined}
                    aria-disabled={!link.url}
                    onClick={(event) => {
                      if (!link.url) event.preventDefault();
                    }}
                    className={`shrink-0 whitespace-nowrap text-left transition hover:text-[#c9a277] ${!link.url ? 'cursor-default opacity-60' : ''}`}
                  >
                    {link.label}
                  </a>
                ))}
                <button
                  type="button"
                  onClick={() => setLegalModal('privacy')}
                  className="shrink-0 cursor-pointer whitespace-nowrap text-left transition hover:text-[#c9a277]"
                >
                  {footerContent.privacyPolicyText}
                </button>
                <button
                  type="button"
                  onClick={() => setLegalModal('terms')}
                  className="shrink-0 cursor-pointer whitespace-nowrap text-left transition hover:text-[#c9a277]"
                >
                  {footerContent.termsText}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className="h-[300px]" />
      </div>
    </footer>
    {legalModal && typeof document !== 'undefined' ? createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setLegalModal(null);
        }}
      >
        <article role="dialog" aria-modal="true" aria-labelledby="legal-modal-title" className="relative max-h-[88svh] w-full max-w-[760px] overflow-y-auto bg-[#eee5d9] p-6 text-[#2c2218] shadow-2xl md:p-10">
          <button type="button" onClick={() => setLegalModal(null)} aria-label="Închide" className="absolute right-5 top-4 text-3xl font-light">×</button>
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9b744e]">IV Concept</span>
          <h2 id="legal-modal-title" className="mt-4 pr-10 font-display text-3xl font-light tracking-tight md:text-4xl">
            {legalModal === 'privacy' ? 'Politica de confidențialitate' : 'Termeni și condiții'}
          </h2>
          <p className="mt-3 text-xs text-[#2c2218]/45">Ultima actualizare: 2026</p>
          <div className="mt-8 space-y-6 text-sm leading-7 text-[#2c2218]/70">
            {legalModal === 'privacy' ? (
              <>
                <LegalSection title="1. Datele pe care le colectăm">
                  Colectăm datele transmise voluntar prin formularele site-ului: nume, prenume, adresă de email, număr de telefon, detalii despre proiect, fotografii încărcate, înscrieri la cursuri și abonări la newsletter.
                </LegalSection>
                <LegalSection title="2. Scopul prelucrării">
                  Folosim datele pentru a răspunde solicitărilor de ofertă, a analiza proiectele, a contacta persoanele interesate de cursuri, a transmite comunicări solicitate și a administra relația cu potențialii clienți.
                </LegalSection>
                <LegalSection title="3. Fotografii și fișiere">
                  Fotografiile încărcate sunt utilizate exclusiv pentru evaluarea solicitării și pregătirea unei propuneri. Nu le publicăm și nu le folosim în portofoliu fără acord separat.
                </LegalSection>
                <LegalSection title="4. Stocare și destinatari">
                  Datele sunt stocate prin furnizorii tehnici ai site-ului, inclusiv Supabase și Cloudflare R2. Accesul este limitat la persoanele care administrează solicitările IV Concept.
                </LegalSection>
                <LegalSection title="5. Drepturile tale">
                  Poți solicita accesul, corectarea, ștergerea sau restricționarea datelor, retragerea consimțământului și, când este aplicabil, portabilitatea datelor. Retragerea consimțământului nu afectează prelucrarea realizată anterior.
                </LegalSection>
                <LegalSection title="6. Contact">
                  Pentru întrebări sau solicitări privind datele personale, ne poți contacta la adresa {footerContent.email}.
                </LegalSection>
              </>
            ) : (
              <>
                <LegalSection title="1. Utilizarea site-ului">
                  Site-ul prezintă serviciile, proiectele, produsele și cursurile IV Concept. Informațiile au caracter general și pot fi actualizate fără notificare prealabilă.
                </LegalSection>
                <LegalSection title="2. Oferte și comenzi">
                  Trimiterea unui formular nu reprezintă încheierea automată a unui contract. Prețul, dimensiunile, materialele, termenul și condițiile finale sunt confirmate individual printr-o ofertă acceptată de ambele părți.
                </LegalSection>
                <LegalSection title="3. Produse personalizate">
                  Aspectul produselor realizate manual poate prezenta variații naturale de textură și nuanță. Pentru produsele executate pe dimensiuni sau specificații personalizate se aplică termenii comunicați în oferta individuală.
                </LegalSection>
                <LegalSection title="4. Proprietate intelectuală">
                  Textele, imaginile, logo-ul, proiectele și materialele vizuale de pe site aparțin IV Concept sau sunt utilizate cu permisiune. Reproducerea sau utilizarea lor comercială fără acord scris este interzisă.
                </LegalSection>
                <LegalSection title="5. Răspundere">
                  Depunem eforturi pentru ca informațiile să fie corecte și site-ul disponibil, însă nu garantăm funcționarea neîntreruptă și nu răspundem pentru probleme cauzate de servicii externe sau utilizarea necorespunzătoare a site-ului.
                </LegalSection>
                <LegalSection title="6. Legea aplicabilă">
                  Acești termeni sunt guvernați de legislația din România. Eventualele neînțelegeri vor fi soluționate mai întâi pe cale amiabilă, iar apoi de instanțele competente.
                </LegalSection>
              </>
            )}
          </div>
        </article>
      </div>,
      document.body,
    ) : null}
    </>
  );
}

function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-semibold text-[#2c2218]">{title}</h3>
      <p className="mt-1">{children}</p>
    </section>
  );
}
