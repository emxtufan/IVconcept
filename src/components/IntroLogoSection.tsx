import { useEffect, useRef, type RefObject } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface IntroLogoSectionProps {
  backgroundImage?: string;
  logoUrl?: string;
  logoAlt?: string;
  brandName: string;
  navbarLogoTargetRef: RefObject<HTMLDivElement | null>;
  heroRef: RefObject<HTMLDivElement | null>;
}

function getDockMetrics(source: HTMLElement, target: HTMLElement) {
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();

  const sourceCenterX = sourceRect.left + sourceRect.width / 2;
  const sourceCenterY = sourceRect.top + sourceRect.height / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const scaleX = targetRect.width / Math.max(sourceRect.width, 1);
  const scaleY = targetRect.height / Math.max(sourceRect.height, 1);

  return {
    x: targetCenterX - sourceCenterX,
    y: targetCenterY - sourceCenterY,
    scale: Math.min(scaleX, scaleY),
  };
}

export default function IntroLogoSection({
  backgroundImage,
  logoUrl,
  logoAlt = 'Brand logo',
  brandName,
  navbarLogoTargetRef,
  heroRef,
}: IntroLogoSectionProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const introLogoRef = useRef<HTMLDivElement | null>(null);
  const scrollHintRef = useRef<HTMLDivElement | null>(null);
  const showImageLogo = Boolean(logoUrl && logoUrl.trim().length > 0);

  useEffect(() => {
    const overlay = overlayRef.current;
    const backdrop = backdropRef.current;
    const introLogo = introLogoRef.current;
    const scrollHint = scrollHintRef.current;
    const navbarLogoTarget = navbarLogoTargetRef.current;
    const hero = heroRef.current;

    if (!overlay || !backdrop || !introLogo || !scrollHint || !navbarLogoTarget || !hero) {
      return;
    }

    const context = gsap.context(() => {
      const resetState = () => {
        gsap.set(introLogo, {
          clearProps: 'x,y,scale,opacity',
          transformOrigin: '50% 50%',
        });
        gsap.set(backdrop, { clearProps: 'opacity' });
        gsap.set(scrollHint, { clearProps: 'opacity,y' });
        gsap.set(navbarLogoTarget, { opacity: 0 });
      };

      resetState();

      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: hero,
          start: 'top top',
          end: '+=100%',
          scrub: true,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefreshInit: resetState,
        },
      });

      timeline.to(
        scrollHint,
        {
          opacity: 0,
          y: 12,
          duration: 0.18,
        },
        0,
      );

      timeline.to(
        introLogo,
        {
          x: () => getDockMetrics(introLogo, navbarLogoTarget).x,
          y: () => getDockMetrics(introLogo, navbarLogoTarget).y,
          scale: () => getDockMetrics(introLogo, navbarLogoTarget).scale,
        },
        0,
      );

      timeline.to(
        backdrop,
        {
          opacity: 0,
          duration: 0.9,
        },
        0.3,
      );

      timeline.to(
        introLogo,
        {
          opacity: 0,
        },
        0.82,
      );

      timeline.to(
        navbarLogoTarget,
        {
          opacity: 1,
        },
        0.82,
      );

      const refreshAfterFonts = async () => {
        if ('fonts' in document) {
          await document.fonts.ready;
        }
        ScrollTrigger.refresh();
      };

      void refreshAfterFonts();
    });

    const handleLoad = () => ScrollTrigger.refresh();
    window.addEventListener('load', handleLoad);

    return () => {
      window.removeEventListener('load', handleLoad);
      context.revert();
    };
  }, [navbarLogoTargetRef, heroRef, showImageLogo]);

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="intro-logo-overlay pointer-events-none absolute inset-0 z-[60]"
    >
      <div
        ref={backdropRef}
        className="absolute inset-0 bg-[#e8e0d6] bg-cover bg-center bg-no-repeat"
        style={backgroundImage ? {
          backgroundImage: `linear-gradient(rgba(232, 224, 214, 0.38), rgba(232, 224, 214, 0.38)), url("${backgroundImage.replace(/"/g, '\\"')}")`,
        } : undefined}
      />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div ref={introLogoRef} className="intro-logo flex items-center justify-center">
          {showImageLogo ? (
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-auto max-h-[300px] w-full max-w-[430px] object-contain sm:max-w-[620px] md:max-w-[840px] lg:max-w-[1020px]"
              referrerPolicy="no-referrer"
              fetchPriority="high"
              loading="eager"
            />
          ) : (
            <div className="font-sans text-[72px] font-bold uppercase leading-none tracking-[-0.06em] text-[#2c2218] sm:text-[104px] md:text-[138px] lg:text-[172px]">
              {brandName}
            </div>
          )}
        </div>
      </div>

      <div
        ref={scrollHintRef}
        className="absolute inset-x-0 bottom-5 flex flex-col items-center gap-3 text-[#2c2218] sm:bottom-7 md:bottom-9"
      >
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] sm:text-[11px]">
          Scroll pentru a descoperi
        </span>
        <span className="relative block h-9 w-px overflow-hidden bg-[#2c2218]/25">
          <span className="absolute left-0 top-0 h-4 w-px animate-bounce bg-[#2c2218]" />
        </span>
      </div>
    </div>
  );
}
