import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import BlurText from './BlurText';

gsap.registerPlugin(ScrollTrigger);

const SERVICE_CARDS = [
  {
    id: 1,
    number: '01',
    title: 'Consultanță',
    description: 'Consiliere strategică în fiecare etapă a unui proiect.',
    image: '/services/card1.png',
  },
  {
    id: 2,
    number: '02',
    title: 'Arhitectură',
    description: 'Arhitectură care echilibrează viziunea, funcția și contextul.',
    image: '/services/card2.png',
  },
  {
    id: 3,
    number: '03',
    title: 'Design interior',
    description: 'Interioare modelate de atmosferă și de experiența cotidiană.',
    image: '/services/card3.svg',
  },
  {
    id: 4,
    number: '04',
    title: 'Design obiecte',
    description: 'Obiecte personalizate care completează narativa spațială.',
    image: '/services/card4.svg',
  },
  {
    id: 5,
    number: '05',
    title: 'Done',
    description: 'Un rezultat final rafinat, livrat cu precizie și atenție pentru detalii.',
    image: '/services/card5.png',
  },
];

const CARD_FACE =
  'overflow-hidden rounded-lg border border-black/10 bg-[#e8e0d6] text-[#2c2218] px-6 py-6 shadow-2xl md:px-10 md:py-9';

const FLIP_STAGE_STYLE = {
  perspective: '1600px',
  WebkitPerspective: '1600px',
} as const;

const FLIPPER_STYLE = {
  transformStyle: 'preserve-3d',
  WebkitTransformStyle: 'preserve-3d',
} as const;

const FRONT_FACE_STYLE = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transform: 'rotateY(0deg) translateZ(0.1px)',
  WebkitTransform: 'rotateY(0deg) translateZ(0.1px)',
} as const;

const BACK_FACE_STYLE = {
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  transform: 'rotateY(180deg) translateZ(0.1px)',
  WebkitTransform: 'rotateY(180deg) translateZ(0.1px)',
} as const;

export default function ServicesScrollSection() {
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement>(null);
  const flipperRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const lastIndex = SERVICE_CARDS.length - 1;

  useLayoutEffect(() => {
    const HEADER_GAP = 40;
    const stickyOffset = () => (headerRef.current?.offsetHeight ?? 200) + HEADER_GAP;

    let lastOffset = -1;
    const applyOffset = () => {
      const off = stickyOffset();
      if (off === lastOffset) return;
      lastOffset = off;
      sectionRef.current?.style.setProperty('--stack-top', `${off}px`);
      ScrollTrigger.refresh();
    };

    applyOffset();
    const ro = new ResizeObserver(applyOffset);
    if (headerRef.current) {
      ro.observe(headerRef.current);
    }

    const ctx = gsap.context(() => {
      cardsRef.current.forEach((card, index) => {
        if (!card || index === lastIndex) return;

        gsap.set(card, {
          y: 0,
          scale: 1,
          opacity: 1,
          filter: 'none',
        });
      });

      const flipTarget = cardsRef.current[lastIndex];
      const flipper = flipperRef.current;

      if (flipTarget && flipper) {
        const easeInOut = gsap.parseEase('power2.inOut');

        ScrollTrigger.create({
          trigger: flipTarget,
          start: () => `top ${stickyOffset()}px`,
          end: () => `+=${Math.max(window.innerHeight * 1.02, 680)}`,
          scrub: true,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = gsap.utils.clamp(0, 1, (self.progress - 0.22) / 0.78);
            const eased = easeInOut(progress);
            gsap.set(flipper, { rotateY: eased * 180, force3D: true });
          },
          onRefresh: () => {
            gsap.set(flipper, { rotateY: 0, force3D: true });
          },
          onLeaveBack: () => {
            gsap.set(flipper, { rotateY: 0, force3D: true });
          },
        });
      }
    }, sectionRef);

    return () => {
      ro.disconnect();
      ctx.revert();
    };
  }, [lastIndex]);

  const cardInner = (service: (typeof SERVICE_CARDS)[number]) => (
    <div className="relative z-10 flex min-h-[22rem] md:min-h-[24rem] flex-col justify-between gap-8">
      <div className="flex items-center justify-between gap-4 border-b border-[#2c2218]/10 pb-4">
        <span className="text-[10px] md:text-xs text-[#7a5c32] tracking-[0.3em] font-sans font-bold uppercase">
          Pasul {service.number}
        </span>
        <span className="text-[10px] text-[#2c2218]/70 font-mono tracking-widest uppercase">
          IV Concept
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center py-2">
        <img
          src={service.image}
          alt={service.title}
          className="h-28 w-auto object-contain md:h-40"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-end">
        <div className="md:col-span-7">
          <h3 className="text-3xl md:text-5xl font-display font-light tracking-tight text-[#2c2218] leading-tight">
            {service.title}
          </h3>
        </div>

        <div className="md:col-span-5">
          <p className="text-sm md:text-base font-light text-[#2c2218]/75 tracking-wide leading-relaxed">
            {service.description}
          </p>
        </div>
      </div>
    </div>
  );

  const renderCard = (service: (typeof SERVICE_CARDS)[number], index: number) => (
    <div
      key={service.id}
      ref={(el) => {
        cardsRef.current[index] = el;
      }}
      className={`sticky w-full max-w-4xl origin-top ${CARD_FACE}`}
      style={{ top: `calc(var(--stack-top, 240px) + ${index * 15}px)` }}
    >
      {cardInner(service)}
    </div>
  );

  const renderFlipCard = (service: (typeof SERVICE_CARDS)[number], index: number) => (
    <div
      key={service.id}
      ref={(el) => {
        cardsRef.current[index] = el;
      }}
      className="sticky w-full max-w-4xl"
      style={{ top: `calc(var(--stack-top, 240px) + ${index * 15}px)`, ...FLIP_STAGE_STYLE }}
    >
      <div
        ref={flipperRef}
        className="relative w-full will-change-transform"
        style={FLIPPER_STYLE}
      >
        <div className={CARD_FACE} style={FRONT_FACE_STYLE}>
          {cardInner(service)}
        </div>

        <div className={`absolute inset-0 ${CARD_FACE}`} style={BACK_FACE_STYLE}>
          <div className="relative z-10 flex min-h-[22rem] md:min-h-[24rem] flex-col justify-between gap-8">
            <div className="flex items-center justify-between gap-4 border-b border-[#2c2218]/10 pb-4">
              <span className="text-[10px] md:text-xs text-[#7a5c32] tracking-[0.3em] font-sans font-bold uppercase">
                Contact
              </span>
              <span className="text-[10px] text-[#2c2218]/70 font-mono tracking-widest uppercase">
                IV Concept
              </span>
            </div>

            <div className="flex flex-1 items-center justify-center py-2">
              <span className="font-display text-6xl md:text-7xl font-light text-[#2c2218]/15">
                &rarr;
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-end">
              <div className="md:col-span-7">
                <h3 className="text-3xl md:text-5xl font-display font-light tracking-tight text-[#2c2218] leading-tight">
                  Contacteaza-ne
                </h3>
              </div>

              <div className="md:col-span-5">
                <p className="text-sm md:text-base font-light text-[#2c2218]/75 tracking-wide leading-relaxed">
                  Hai sa transformam spatiul tau intr-un proiect memorabil.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section
      ref={sectionRef}
      id="services"
      className="relative z-30 -mb-[100vh] bg-[#e8e0d6] text-white px-6 md:px-16 py-24 md:py-32 border-t border-zinc-900"
    >
      <div className="max-w-[1140px] w-full mx-auto">
        <div
          ref={headerRef}
          className="sticky top-0 z-30 bg-[#e8e0d6] pt-6 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-zinc-900 pb-6"
        >
          <div>
            <span className="text-[10px] md:text-xs text-[#2c2218] tracking-[0.25em] font-sans font-bold uppercase block mb-3">
              [ Cum procedam ]
            </span>
            <h2 className="text-3xl md:text-5xl font-display text-[#2c2218] tracking-tight leading-tight ">
              <BlurText
                  text="Gândire strategică, "
                  delay={100}
                  animateBy="words"
                  direction="top"
                />
              
            </h2>
            <h2 className="text-3xl md:text-5xl font-display text-[#2c2218] tracking-tight leading-tight ">
              <BlurText
                  text="Precizie spațială"
                  delay={110}
                  animateBy="words"
                  direction="top"
                />
            </h2>
          </div>

          <p className="max-w-[420px] text-xs md:text-sm text-zinc-600 font-medium tracking-wide leading-relaxed">
            Un proces clar, de la prima idee pana la forma finala. Fiecare etapa este atent construita pentru a transforma viziunea intr-un spatiu coerent, functional si personal.
          </p>
        </div>

        <div className="mt-16 md:mt-20 flex flex-col items-center gap-10 md:gap-20">
          {SERVICE_CARDS.map((service, index) =>
            index === lastIndex ? renderFlipCard(service, index) : renderCard(service, index),
          )}
          <div aria-hidden className="h-[210vh] w-full shrink-0" />
        </div>
      </div>
    </section>
  );
}
