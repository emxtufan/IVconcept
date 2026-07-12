import { useEffect, useRef } from 'react';
import { getSiteContent } from '../data';
import SplitText from "./SplitText";

const EASING = 0.08;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start: number, end: number, amount: number) {
  return start * (1 - amount) + end * amount;
}

export default function ProjectParallaxPanels() {
  const projects = getSiteContent().slidersSection.panels;
  const galleryRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const imagePanelRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const gallery = galleryRef.current;
    const track = trackRef.current;

    if (!gallery || !track) {
      return;
    }

    let currentY = 0;
    let targetY = 0;
    let rafId: number | null = null;

    const updateImages = (scrollValue: number) => {
      const viewportHeight = window.innerHeight || 1;

      imagePanelRefs.current.forEach((imagePanel, index) => {
        if (!imagePanel) {
          return;
        }

        const panelStart = index * viewportHeight;
        const offset = clamp(panelStart - scrollValue, 0, viewportHeight);

        imagePanel.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    };

    const render = () => {
      currentY = lerp(currentY, targetY, EASING);

      if (Math.abs(currentY - targetY) < 0.1) {
        currentY = targetY;
      }

      track.style.transform = `translate3d(0, -${currentY}px, 0)`;
      updateImages(currentY);

      if (Math.abs(currentY - targetY) > 0.1) {
        rafId = window.requestAnimationFrame(render);
      } else {
        rafId = null;
      }
    };

    const requestRender = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(render);
      }
    };

    const syncTarget = () => {
      const maxScroll = Math.max(track.scrollHeight - window.innerHeight, 0);
      const sectionTop = gallery.getBoundingClientRect().top;

      targetY = clamp(-sectionTop, 0, maxScroll);
      requestRender();
    };

    const measure = () => {
      gallery.style.height = `${track.scrollHeight}px`;
      syncTarget();
      updateImages(currentY);
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measure();
          })
        : null;

    resizeObserver?.observe(track);

    const images = gallery.querySelectorAll('img') as NodeListOf<HTMLImageElement>;

    const imageCleanup = Array.from(images).map((image: HTMLImageElement) => {
      if (image.complete) {
        return () => {};
      }

      const handleLoad = () => {
        measure();
      };

      image.addEventListener('load', handleLoad);

      return () => {
        image.removeEventListener('load', handleLoad);
      };
    });

    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        measure();
      });
    }

    measure();

    window.addEventListener('scroll', syncTarget, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('scroll', syncTarget);
      window.removeEventListener('resize', measure);

      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }

      resizeObserver?.disconnect();
      imageCleanup.forEach((cleanup) => cleanup());
    };
  }, []);

  return (
    <div
      ref={galleryRef}
      id="proiecte"
      className="relative z-50 bg-[#0A0D11]"
      style={{ height: `${projects.length * 100}svh` }}
    >
      <div className="sticky top-0 h-[100svh] overflow-clip">
        <div className="absolute inset-0 overflow-clip">
          {projects.map((project, index) => (
            <div
              key={project.id}
              ref={(element) => {
                imagePanelRefs.current[index] = element;
              }}
              className="absolute inset-0 overflow-clip will-change-transform"
              style={{ zIndex: index + 1 }}
            >
              <div className="absolute inset-0">
                <picture>
                  <source media="(max-width: 767px)" srcSet={project.mobileImage || project.image} />
                  <source media="(min-width: 768px)" srcSet={project.desktopImage || project.image} />
                  <img
                    src={project.desktopImage || project.mobileImage || project.image}
                    alt={project.title}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </picture>
              </div>

              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.08)_0%,rgba(0,0,0,0.08)_32%,rgba(0,0,0,0.18)_60%,rgba(0,0,0,0.48)_100%)]" />
            </div>
          ))}
        </div>

        <div ref={trackRef} className="relative z-10 will-change-transform">
          {projects.map((project, index) => (
            <article
              key={project.id}
              className="relative flex h-[100svh] flex-col justify-between px-8 py-8 text-white md:px-14 md:py-12"
            >
              <div className="flex items-start">
                <span className="font-display text-[58px] leading-none tracking-[-0.045em] text-white md:text-[88px]">
                  {/* {project.indexLabel} */}
                </span>
              </div>

              <div className="max-w-[20rem] pb-12 md:max-w-[38rem] md:pb-14">
                <div className="mb-2 text-[12px] font-sans font-semibold tracking-tight text-white md:mb-3 md:text-[15px]">
                  {project.category}
                </div>
                <h3 className="font-display text-[36px] leading-[0.96] tracking-[-0.055em] text-white md:max-w-[36rem] md:text-[74px]">
                  
                  <SplitText
                      text={project.title}
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
                <p className="mt-5 max-w-[19rem] text-[13px] leading-[1.42] font-sans font-semibold text-white/88 md:mt-6 md:max-w-[25rem] md:text-[20px]">
                  {project.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
