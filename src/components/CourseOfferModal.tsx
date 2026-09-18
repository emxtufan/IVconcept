import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, X } from 'lucide-react';
import type { CourseOfferContent } from '../types/siteContent';
import { getCourseHref } from '../routes';
import CourseSignupForm from './CourseSignupForm';
import { useAccessibleDialog } from './useAccessibleDialog';

interface CourseOfferModalProps {
  content: CourseOfferContent;
  isOpen: boolean;
  onClose: () => void;
}

export default function CourseOfferModal({ content, isOpen, onClose }: CourseOfferModalProps) {
  const id = useId();
  const dialogRef = useAccessibleDialog(isOpen, onClose);
  const [failedImages, setFailedImages] = useState<string[]>([]);

  if (!isOpen || typeof document === 'undefined') return null;

  const usableImage = (url?: string) => {
    if (!url?.trim()) return '';
    try {
      return failedImages.includes(new URL(url.trim(), document.baseURI).href) ? '' : url.trim();
    } catch {
      return '';
    }
  };
  const desktopImage = usableImage(content.imageUrl);
  const mobileImage = usableImage(content.mobileImageUrl);
  const fallbackImage = desktopImage || mobileImage;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] overflow-y-auto bg-[#130a01]/75 p-3 backdrop-blur-md sm:p-6"
      data-lenis-prevent
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="pointer-events-none flex min-h-full items-center justify-center">
        <section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-description`}
          tabIndex={-1}
          className="pointer-events-auto relative my-auto grid w-full max-w-[900px] overflow-hidden rounded-2xl bg-[#ede4d8] text-[#2c2218] shadow-[0_35px_120px_rgba(0,0,0,0.45)] outline-none md:grid-cols-[0.85fr_1fr]"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Închide oferta de curs"
            className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-[#2c2218]/15 bg-[#ede4d8]/95 text-[#2c2218] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847] sm:right-4 sm:top-4"
          >
            <X size={19} aria-hidden="true" />
          </button>
          <div className="relative overflow-hidden bg-[#2c2218] md:min-h-[510px]">
            {fallbackImage ? (
              <picture className="block md:absolute md:inset-0">
                {mobileImage && <source media="(max-width: 767px)" srcSet={mobileImage} />}
                <img
                  src={fallbackImage}
                  alt="Lucrări decorative IV Concept"
                  className="block h-auto w-full md:h-full md:object-cover"
                  fetchPriority="high"
                  onError={(event) => {
                    const failedUrl = event.currentTarget.currentSrc || event.currentTarget.src;
                    setFailedImages((images) => images.includes(failedUrl) ? images : [...images, failedUrl]);
                  }}
                />
              </picture>
            ) : (
              <div aria-hidden="true" className="aspect-[4/3] bg-[radial-gradient(ellipse_at_top_left,#aa8962,transparent_70%),linear-gradient(145deg,#776047,#2c2218)] md:absolute md:inset-0 md:aspect-auto" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#130a01]/80 via-transparent to-transparent" />
            <div className="absolute bottom-5 left-6 text-white md:bottom-8 md:left-8">
              <span className="block font-display text-2xl tracking-tight md:text-3xl">IV Concept</span>
              <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.24em] text-white/80">Cursuri · Artă decorativă</span>
            </div>
          </div>
          <div className="px-6 py-7 sm:px-8 sm:py-9 md:px-10 md:pb-10 md:pt-16">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8b6847]">Învață alături de noi</span>
            <h2 id={`${id}-title`} tabIndex={-1} data-dialog-initial-focus className="mt-4 font-display text-3xl font-light leading-[1.12] tracking-[-0.045em] outline-none sm:text-4xl">{content.title}</h2>
            <p id={`${id}-description`} className="mt-4 whitespace-pre-line text-sm leading-6 text-[#2c2218]/75">{content.description}</p>

            <div className="mt-7">
              <CourseSignupForm
                source="course-offer"
                buttonText={content.buttonText}
                successMessage={content.successMessage}
                onDone={onClose}
              />

              <a
                href={getCourseHref(window.location.hostname)}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-[#2c2218]/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-[#2c2218] transition hover:border-[#8b6847] hover:bg-white/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b6847]"
              >
                <span>{content.pageButtonText}</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}
