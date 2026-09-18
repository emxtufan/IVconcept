import { getSiteContent } from '../data';
import { getHomeHref, getLegalHref } from '../routes';
import CourseSignupForm from './CourseSignupForm';

export default function CoursePage() {
  const content = getSiteContent().coursePage;
  const offer = getSiteContent().courseOffer;
  const brandName = getSiteContent().footer.brandName || 'IV Concept';
  const hostname = typeof window === 'undefined' ? '' : window.location.hostname;
  const homeHref = getHomeHref(hostname);

  return (
    <main className="grain-bg min-h-screen bg-[#e8e0d6] text-[#2c2218]">
      <div className="grain-overlay" />

      <header className="relative z-10 border-b border-[#2c2218]/10 px-6 py-6 md:px-16">
        <div className="mx-auto flex max-w-[1340px] items-center justify-between gap-6">
          <a href={homeHref} className="font-display text-xl tracking-tight">{brandName}</a>
          <a href={homeHref} className="text-[10px] font-semibold uppercase tracking-[0.22em]">← Înapoi pe site</a>
        </div>
      </header>

      <section className="relative z-10 px-6 py-16 md:px-16 md:py-24">
        <div className="mx-auto max-w-[720px]">
          <h1 className="font-display text-4xl font-light leading-[1.05] tracking-[-0.05em] md:text-6xl">
            {content.title}
          </h1>
          <p className="mt-8 whitespace-pre-line text-base font-light leading-8 text-[#2c2218]/70 md:text-lg md:leading-9">
            {content.description}
          </p>

          <div className="mt-12 rounded-2xl border border-[#2c2218]/12 bg-[#ede4d8] p-6 sm:p-8 md:mt-16">
            <h2 className="font-display text-2xl font-light tracking-tight md:text-3xl">{content.formTitle}</h2>
            <div className="mt-6">
              <CourseSignupForm
                source="course-page"
                buttonText={offer.buttonText}
                successMessage={offer.successMessage}
              />
            </div>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#2c2218]/10 px-6 py-10 md:px-16">
        <div className="mx-auto flex max-w-[1340px] flex-wrap items-center justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2c2218]/45">
          <span>{brandName}</span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a href={getLegalHref(hostname, 'privacy')} className="text-[#2c2218]/70">Politica de confidențialitate</a>
            <a href={getLegalHref(hostname, 'terms')} className="text-[#2c2218]/70">Termeni și condiții</a>
            <a href={homeHref} className="text-[#2c2218]/70">Vezi întregul site →</a>
          </div>
        </div>
      </footer>

    </main>
  );
}
