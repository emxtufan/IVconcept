import { type FormEvent, useState } from 'react';
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
  return SECTION_ANCHORS[label.trim().toLowerCase()] ?? '#';
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
            <div className="flex flex-col gap-1 md:items-end md:text-right">
              <a href="#">{footerContent.privacyPolicyText}</a>
              <a href="#">{footerContent.termsText}</a>
            </div>
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

          <div className="border-t border-white/12">
            <div className="relative mx-auto max-w-[1310px] px-6 py-8 md:px-12 xl:px-0">
              <div className="grid grid-cols-2 gap-y-4 text-[15px] text-white/76 sm:grid-cols-3 lg:grid-cols-5 lg:gap-10">
                {socialLinks.map((link) => (
                  <a key={link} href="#" className="text-left lg:text-center">
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div aria-hidden className="h-[300px]" />
      </div>
    </footer>
  );
}
