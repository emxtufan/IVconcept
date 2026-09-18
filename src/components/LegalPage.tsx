import { getSiteContent } from '../data';
import { getHomeHref, getLegalHref, type LegalDocumentRoute } from '../routes';
import { LegalLastUpdated, LegalSections, LEGAL_TITLES } from './legalContent';

export default function LegalPage({ document }: { document: LegalDocumentRoute }) {
  const brandName = getSiteContent().footer.brandName || 'IV Concept';
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const homeHref = getHomeHref(hostname);
  const otherDocument = document === 'privacy' ? 'terms' : 'privacy';

  return (
    <main className="grain-bg min-h-screen bg-[#e8e0d6] text-[#2c2218]">
      <div className="grain-overlay" />

      <header className="relative z-10 border-b border-[#2c2218]/10 px-6 py-6 md:px-16">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between gap-6">
          <a href={homeHref} className="font-display text-xl tracking-tight">{brandName}</a>
          <a href={homeHref} className="text-[10px] font-semibold uppercase tracking-[0.22em]">← Înapoi pe site</a>
        </div>
      </header>

      <article className="relative z-10 px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto max-w-[760px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#9b744e]">{brandName}</span>
          <h1 className="mt-4 font-display text-4xl font-light leading-[1.05] tracking-[-0.05em] md:text-5xl">
            {LEGAL_TITLES[document]}
          </h1>
          <LegalLastUpdated />

          <div className="mt-10 space-y-6 text-sm leading-7 text-[#2c2218]/70">
            <LegalSections document={document} />
          </div>


          <a
            href={getLegalHref(hostname, otherDocument)}
            className="mt-12 inline-flex border-b border-[#2c2218]/40 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
          >
            {LEGAL_TITLES[otherDocument]} →
          </a>
        </div>
      </article>

      <footer className="relative z-10 border-t border-[#2c2218]/10 px-6 py-10 md:px-16">
        <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2c2218]/45">
          <span>{brandName}</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href={homeHref} className="text-[#2c2218]/70">Vezi întregul site →</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
