import { useRef, useEffect, useCallback, PointerEvent } from 'react';
import { getSiteContent } from '../data';

interface CollageImage {
  url: string;
  label: string;
  dimensions: string;
  aspectClass: string;
  heightClass: string;
}

interface CollageColumn {
  id: number;
  images: CollageImage[];
}

const getAspectWeight = (aspectClass: string) => {
  if (aspectClass === 'aspect-square') {
    return 1;
  }

  const match = aspectClass.match(/aspect-\[(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\]/);
  if (!match) {
    return 1;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!width || !height) {
    return 1;
  }

  return Math.max(0.72, Math.min(1.9, height / width));
};

const wrap = (value: number, min: number, max: number) => {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
};

export default function ImageCollageSection() {
  const collageData = getSiteContent().imageSection.columns as CollageColumn[];
  const targetRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const transformFrame = useRef<number | null>(null);
  const measureFrame = useRef<number | null>(null);
  const scrollProgress = useRef(0);

  const isDragging = useRef(false);
  const startX = useRef(0);
  const currentDragOffset = useRef(0);
  const dragStartOffset = useRef(0);

  const loopWidth = useRef(0);
  const sectionTop = useRef(0);
  const sectionHeight = useRef(1);
  const viewportH = useRef(1);
  const docHeight = useRef(1);
  const lastAppliedX = useRef<number | null>(null);

  const updateProgress = useCallback(() => {
    const total = Math.max(sectionHeight.current + viewportH.current, 1);
    const next = (window.scrollY + viewportH.current - sectionTop.current) / total;
    scrollProgress.current = Math.max(0, Math.min(1, next));
  }, []);

  const applyTransform = useCallback(() => {
    const track = trackRef.current;
    const L = loopWidth.current;

    if (!track || !L || Number.isNaN(L) || L < 100) {
      return;
    }

    const scrollOffset = -scrollProgress.current * L * 0.35;
    const wrappedX = wrap(scrollOffset + currentDragOffset.current, -2 * L, -L);

    if (
      lastAppliedX.current !== null &&
      Math.abs(wrappedX - lastAppliedX.current) < 0.05
    ) {
      return;
    }

    lastAppliedX.current = wrappedX;
    track.style.transform = `translate3d(${wrappedX}px, 0, 0)`;
  }, []);

  const requestTransformUpdate = useCallback(() => {
    if (transformFrame.current !== null) {
      return;
    }

    transformFrame.current = requestAnimationFrame(() => {
      transformFrame.current = null;
      applyTransform();
    });
  }, [applyTransform]);

  const measure = useCallback(() => {
    const target = targetRef.current;
    const track = trackRef.current;

    if (!target || !track) {
      return;
    }

    loopWidth.current = track.scrollWidth / 3;

    const rect = target.getBoundingClientRect();
    viewportH.current = window.innerHeight || 1;
    sectionTop.current = rect.top + window.scrollY;
    sectionHeight.current = Math.max(rect.height, 1);
    docHeight.current = Math.max(document.documentElement.scrollHeight, 1);

    updateProgress();
    lastAppliedX.current = null;
    requestTransformUpdate();
  }, [requestTransformUpdate, updateProgress]);

  const requestMeasure = useCallback(() => {
    if (measureFrame.current !== null) {
      return;
    }

    measureFrame.current = requestAnimationFrame(() => {
      measureFrame.current = null;
      measure();
    });
  }, [measure]);

  useEffect(() => {
    const target = targetRef.current;
    const track = trackRef.current;

    if (!target || !track) {
      return;
    }

    const handleScroll = () => {
      updateProgress();

      const y = window.scrollY;
      if (
        y + viewportH.current < sectionTop.current ||
        y > sectionTop.current + sectionHeight.current
      ) {
        return;
      }

      requestTransformUpdate();
    };

    const handleGlobalWheel = (e: WheelEvent) => {
      const y = window.scrollY;
      const isMouseInSection =
        y + viewportH.current >= sectionTop.current &&
        y <= sectionTop.current + sectionHeight.current;

      if (!isMouseInSection) {
        return;
      }

      const isAtBottom = y + viewportH.current >= docHeight.current - 8;
      const isAtTop = y <= 8;

      if ((isAtBottom && e.deltaY > 0) || (isAtTop && e.deltaY < 0)) {
        currentDragOffset.current -= e.deltaY * 0.7;
        requestTransformUpdate();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      requestMeasure();
    });

    resizeObserver.observe(target);
    resizeObserver.observe(track);

    requestMeasure();

    window.addEventListener('resize', requestMeasure);
    window.addEventListener('load', requestMeasure);
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('wheel', handleGlobalWheel, { passive: true });

    return () => {
      if (transformFrame.current !== null) {
        cancelAnimationFrame(transformFrame.current);
        transformFrame.current = null;
      }

      if (measureFrame.current !== null) {
        cancelAnimationFrame(measureFrame.current);
        measureFrame.current = null;
      }

      resizeObserver.disconnect();
      window.removeEventListener('resize', requestMeasure);
      window.removeEventListener('load', requestMeasure);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('wheel', handleGlobalWheel);
    };
  }, [requestMeasure, requestTransformUpdate, updateProgress]);

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    startX.current = e.clientX;
    dragStartOffset.current = currentDragOffset.current;
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.current) return;

    currentDragOffset.current = dragStartOffset.current + (e.clientX - startX.current);
    requestTransformUpdate();
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (!isDragging.current) return;

    e.currentTarget.releasePointerCapture(e.pointerId);
    isDragging.current = false;
  };

  return (
    <div
      ref={targetRef}
      className="relative z-30 min-h-screen select-none pt-24 md:pt-32 pb-0"
      id="portfolio-collage-section"
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden flex flex-col justify-center">
        <div
          className="w-full h-screen flex items-center justify-start touch-action-pany cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'pan-y' }}
        >
          <div
            ref={trackRef}
            className="w-max flex flex-row gap-0 h-full py-1.5 md:py-3 items-stretch will-change-transform"
          >
            {[0, 1, 2].map((loopIdx) =>
              collageData.map((column) => (
                <div
                  key={`${loopIdx}-${column.id}`}
                  className="w-[72vw] sm:w-[55vw] md:w-[32vw] flex-shrink-0 flex flex-col gap-2 md:gap-4 h-full pr-4 md:pr-8"
                >
                  {column.images.map((img, imgIdx) => (
                    <div
                      key={imgIdx}
                      className="group relative w-full basis-0 overflow-hidden rounded-sm"
                      style={{
                        flexGrow: getAspectWeight(img.aspectClass),
                      }}
                    >
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors duration-500 z-10" />

                      <img
                        src={img.url}
                        alt={img.label}
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        sizes="(max-width: 640px) 72vw, (max-width: 768px) 55vw, 32vw"
                        className="w-full h-full object-cover grayscale-[25%] group-hover:grayscale-0 scale-100 group-hover:scale-[1.03] transition-[transform,filter] duration-700 ease-out select-none pointer-events-none"
                        referrerPolicy="no-referrer"
                      />

                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-[10px] tracking-wider font-mono text-zinc-300 drop-shadow-md z-20 opacity-80 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <span className="text-[9px] text-zinc-400 backdrop-blur-sm px-2 py-1 rounded hidden sm:inline">
                          {img.dimensions}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
