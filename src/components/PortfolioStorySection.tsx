import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { getSiteContent } from '../data';
import BlurText from './BlurText';
import ShinyText from './ShinyText';
import SplitText from "./SplitText";

export default function PortfolioStorySection() {
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', gdprAccepted: false });
  const [submitState, setSubmitState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const content = getSiteContent().videoCardSection;
  const logoUrl = getSiteContent().logoSection.logoUrl;

  useEffect(() => {
    if (!isCourseModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCourseModalOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isCourseModalOpen]);

  const submitCourseRegistration = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitState('sending');
    setSubmitMessage('');
    try {
      const response = await fetch('/api/course-subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) throw new Error(payload.message || 'Înscrierea nu a putut fi trimisă.');
      setSubmitState('success');
      setSubmitMessage('Îți mulțumim! Înscrierea a fost înregistrată.');
      setForm({ firstName: '', lastName: '', email: '', phone: '', gdprAccepted: false });
    } catch (error) {
      setSubmitState('error');
      setSubmitMessage(error instanceof Error ? error.message : 'A apărut o eroare.');
    }
  };

  return (
    <section id="povestea" className="relative z-40 border-t border-white/10 bg-[#130a01] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-20 md:px-12 md:py-24 xl:px-16 xl:py-28">
        <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-16 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="pt-2 md:pt-4">
            <span className="block font-sans text-[12px] font-semibold uppercase tracking-[0.08em] text-white/82">
              {content.eyebrow}
            </span>
          </div>

          <div className="max-w-[1180px]">
            <h2 className="font-sans text-[18px] font-semibold leading-[0.96] tracking-[-0.055em] text-white/96 sm:text-[20px] md:text-[22px] lg:text-[24px] xl:text-[26px]">
              <ShinyText
                  text={content.quote}
                  speed={2}
                  delay={0}
                  color="#b5b5b5"
                  shineColor="#ffffff"
                  spread={120}
                  direction="left"
                  yoyo={true}
                  pauseOnHover={false}
                  disabled={false}
                />
            </h2>

            <div className="mt-10 flex items-center gap-4 md:mt-12">
              <div className="h-14 w-14 overflow-hidden rounded-[100%] border border-white/35 sm:h-16 sm:w-16">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-sans text-[15px] font-semibold uppercase tracking-[-0.02em] text-white">
                  <BlurText text={content.brandName} />
                </div>
                <div className="mt-1 font-sans text-[12px] font-medium uppercase tracking-[0.02em] text-white/72 sm:text-[13px]">
                  <BlurText text={content.brandRole} />

                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 border-t border-white/10 pt-14 md:mt-24 md:pt-20">
          <div className="grid gap-12 md:grid-cols-[220px_minmax(0,1fr)] md:gap-16 xl:grid-cols-[280px_minmax(0,1fr)]">
           <div className="hidden sm:flex items-start">
              <span className="font-sans text-[56px] font-semibold leading-none tracking-[-0.2em] text-white/96 sm:text-[68px]">
                ///
              </span>
            </div>

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,610px)_minmax(320px,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,610px)_460px] xl:gap-16">
              <div className="max-w-[610px]">
                <h3 className="font-sans text-[42px] font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-[48px] md:text-[56px]">
                  
                   <SplitText
                      text={content.storyTitle}
                      className=""
                      delay={50}
                      duration={1.25}
                      ease="power3.out"
                      splitType="chars"
                      from={{ opacity: 0, y: 40 }}
                      to={{ opacity: 1, y: 0 }}
                      threshold={0.1}
                      rootMargin="-100px"
                      textAlign="left"
                    />
                </h3>

                <p className="mt-10 font-sans text-[23px] font-normal leading-[1.22] tracking-[-0.035em] text-white/94 sm:text-[26px] md:mt-12 md:text-[30px]">
                  {content.paragraphOne}
                </p>

                <p className="mt-8 font-sans text-[23px] font-normal leading-[1.22] tracking-[-0.035em] text-white/50 sm:text-[26px] md:text-[18px] lowercase">
                  {content.paragraphTwo}
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitState('idle');
                    setSubmitMessage('');
                    setIsCourseModalOpen(true);
                  }}
                  className="mt-12 flex w-full max-w-[320px] items-center justify-between border-t border-white/22 pt-5 text-left font-sans text-[15px] font-semibold uppercase tracking-[0.02em] text-white/95"
                >
                  <span>{content.buttonText}</span>
                  <span aria-hidden className="text-[28px] leading-none">
                    &rarr;
                  </span>
                </button>
              </div>

              <div className="w-full max-w-[460px] justify-self-start lg:justify-self-end">
                <div className="group relative aspect-square w-full overflow-hidden border border-white/16 bg-[#050505]">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="absolute inset-0 h-full w-full object-cover opacity-88 transition-transform duration-700 group-hover:scale-[1.02]"
                  >
                    <source src={content.videoUrl} type="video/mp4" />
                  </video>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14)_0%,rgba(0,0,0,0.05)_38%,rgba(0,0,0,0.34)_100%)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isCourseModalOpen && typeof document !== 'undefined' ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/75 px-4 py-8 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsCourseModalOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="course-modal-title" className="relative w-full max-w-[620px] bg-[#ede4d8] p-6 text-[#2c2218] shadow-2xl md:p-10">
            <button type="button" onClick={() => setIsCourseModalOpen(false)} aria-label="Închide formularul" className="absolute right-5 top-4 text-3xl font-light">×</button>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#9b744e]">Cursuri IV Concept</span>
            <h2 id="course-modal-title" className="mt-4 font-display text-4xl font-light tracking-tight">Înscrie-te la curs</h2>
            <p className="mt-3 text-sm leading-6 text-[#2c2218]/60">Completează datele, iar noi te vom contacta cu toate detaliile.</p>
            <form onSubmit={submitCourseRegistration} className="mt-8 grid gap-4 sm:grid-cols-2">
              <input required maxLength={100} placeholder="Nume" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-12 border border-[#2c2218]/15 bg-white/55 px-4 text-sm outline-none focus:border-[#9b744e]" />
              <input required maxLength={100} placeholder="Prenume" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-12 border border-[#2c2218]/15 bg-white/55 px-4 text-sm outline-none focus:border-[#9b744e]" />
              <input required type="email" maxLength={254} placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 border border-[#2c2218]/15 bg-white/55 px-4 text-sm outline-none focus:border-[#9b744e]" />
              <input required type="tel" maxLength={30} placeholder="Număr de telefon" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 border border-[#2c2218]/15 bg-white/55 px-4 text-sm outline-none focus:border-[#9b744e]" />
              <label className="flex items-start gap-3 py-3 text-xs leading-5 text-[#2c2218]/65 sm:col-span-2">
                <input required type="checkbox" checked={form.gdprAccepted} onChange={(e) => setForm({ ...form, gdprAccepted: e.target.checked })} className="mt-1 h-4 w-4 accent-[#2c2218]" />
                <span>Sunt de acord cu prelucrarea datelor personale pentru a fi contactat(ă) în legătură cu acest curs.</span>
              </label>
              <button disabled={submitState === 'sending'} className="h-12 bg-[#2c2218] px-6 text-xs font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50 sm:col-span-2">
                {submitState === 'sending' ? 'Se trimite…' : 'Trimite înscrierea'}
              </button>
              {submitMessage && <p className={`text-sm sm:col-span-2 ${submitState === 'error' ? 'text-red-700' : 'text-green-800'}`}>{submitMessage}</p>}
            </form>
          </div>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
