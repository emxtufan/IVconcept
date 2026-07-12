import { useState, useRef, useEffect, PointerEvent } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getSiteContent } from '../data';
import SplitText from "./SplitText";

interface Project {
  id: string;
  title: string;
  location: string;
  type: string;
  finish: string;
  mirror: string;
  area: string;
  length: string;
  width: string;
  time: string;
  description: string;
  image: string;
}

export default function SelectedWorkSection() {
  const cardsSection = getSiteContent().cardsSection;
  const specLabels = cardsSection.specLabels;
  const baseProjects = cardsSection.projects as Project[];
  const dataArray = [...baseProjects, ...baseProjects, ...baseProjects];
  const [visibleCount, setVisibleCount] = useState(3);
  const [nowIndex, setNowIndex] = useState(baseProjects.length); // Start at middle copy
  const [isAnimate, setIsAnimate] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentDragOffsetRef = useRef(0);

  // Sync visible items dynamically on resize
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCount(1);
      } else if (width < 1024) {
        setVisibleCount(2);
      } else {
        setVisibleCount(3);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle re-enabling animation after seamless wrap
  useEffect(() => {
    if (!isAnimate) {
      const forceRef = containerRef.current?.offsetHeight; // Force reflow
      const raf = requestAnimationFrame(() => {
        setIsAnimate(true);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isAnimate]);

  const nextSlide = () => {
    if (!isAnimate) return;
    setNowIndex((prev) => prev + 1);
  };

  const prevSlide = () => {
    if (!isAnimate) return;
    setNowIndex((prev) => prev - 1);
  };

  // Infinite wrapping jump logic executed immediately when transition finishes
  const handleTransitionEnd = () => {
    const N = baseProjects.length;
    if (nowIndex >= 2 * N) {
      setIsAnimate(false);
      setNowIndex(nowIndex - N);
    } else if (nowIndex < N) {
      setIsAnimate(false);
      setNowIndex(nowIndex + N);
    }
  };

  // Pointer event mouse drag & mobile swipe
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click/standard touches only
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    currentDragOffsetRef.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    currentDragOffsetRef.current = deltaX;
    setDragOffset(deltaX);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);

    const deltaX = currentDragOffsetRef.current;
    setDragOffset(0);

    const swipeThreshold = 80; // Min px swipe to change card

    if (deltaX < -swipeThreshold) {
      nextSlide();
    } else if (deltaX > swipeThreshold) {
      prevSlide();
    }
  };

  const gap = 24; // Spacing in px

  return (
    <section id="lucrari" className="relative z-40 bg-[#130a01] py-24 md:py-32 px-6 md:px-16 border-t border-zinc-900 select-none overflow-hidden m-0 mb-0">
      <div className="max-w-[1340px] w-full mx-auto">
        {/* Section Title & Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div className="flex-1">
            <span className="text-[10px] md:text-xs text-[#c5a880] tracking-[0.25em] font-sans font-bold uppercase block mb-3">
              {cardsSection.eyebrow}
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-light text-white tracking-tight leading-tight">
              <SplitText
                text= {cardsSection.titleLine1}
                className=""
                delay={30}
                duration={0.9}
                ease="power3.out"
                splitType="chars"
                from={{ opacity: 0, y: 20 }}
                to={{ opacity: 1, y: 0 }}
                threshold={0.1}
                rootMargin="-100px"
                textAlign="left"
              />
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="#portfolio-collage-section"
              className="group inline-flex items-center gap-3 text-xs md:text-sm text-zinc-300 hover:text-[#c5a880] font-medium tracking-wider uppercase transition-colors duration-300 border-b border-zinc-800 pb-2 mr-4"
            >
              {cardsSection.linkText}
              <span className="transform group-hover:translate-x-1.5 transition-transform duration-300">
                &rarr;
              </span>
            </a>

            {/* Slider Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={prevSlide}
                className="w-10 h-10 rounded-full border border-zinc-800 hover:border-[#c5a880] flex items-center justify-center text-zinc-400 hover:text-white transition-colors duration-300 bg-zinc-950/40 active:scale-95"
                aria-label="Previous Project"
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={nextSlide}
                className="w-10 h-10 rounded-full border border-zinc-800 hover:border-[#c5a880] flex items-center justify-center text-zinc-400 hover:text-white transition-colors duration-300 bg-zinc-950/40 active:scale-95"
                aria-label="Next Project"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Outer Window */}
        <div
          ref={containerRef}
          className="relative w-full cursor-grab active:cursor-grabbing touch-action-pany overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: 'pan-y' }}
        >
          {/* Sliding Track */}
          <div
            className="flex w-full items-stretch"
            onTransitionEnd={handleTransitionEnd}
            style={{
              gap: `${gap}px`,
              transform: `translate3d(calc(-${nowIndex} * (100% + ${gap}px) / ${visibleCount} + ${dragOffset}px), 0, 0)`,
              transition: isAnimate && !isDraggingRef.current ? 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
              willChange: 'transform',
            }}
          >
            {dataArray.map((project, index) => {
              // Calculate responsive width for each card so the spacing is perfectly equal
              const cardWidthStyles = {
                width: `calc((100% - ${(visibleCount - 1) * gap}px) / ${visibleCount})`,
                flexShrink: 0,
              };

              return (
                <div key={`${project.id}-${index}`} style={cardWidthStyles} className="group">
                  <div className="border border-zinc-900 bg-zinc-950/30 rounded-sm p-5 md:p-6 flex flex-col justify-between h-full hover:border-[#c5a880]/30 hover:bg-zinc-950/50 transition-all duration-500">
                    {/* Project Image (exactly same height, cover crop) */}
                    <div className="relative h-[220px] sm:h-[260px] md:h-[300px] w-full overflow-hidden rounded-sm bg-zinc-900 mb-6 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] transition-all duration-500">
                      <img
                        src={project.image}
                        alt={project.title}
                        className="w-full h-full object-cover scale-100 group-hover:scale-[1.04] transition-transform duration-700 ease-out select-none"
                        draggable="false"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[9px] font-mono tracking-widest text-[#c5a880] uppercase border border-zinc-900 rounded-sm">
                        {project.location}
                      </div>
                    </div>

                    {/* Card Content - aligned vertically */}
                    <div className="flex-grow flex flex-col justify-between">
                      <div>
                        {/* Title & Type */}
                        <div className="mb-4">
                          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                            {project.type}
                          </span>
                          <h3 className="text-xl font-display font-light text-white tracking-tight leading-snug group-hover:text-[#c5a880] transition-colors duration-300">
                            {project.title}
                          </h3>
                        </div>

                        {/* Description (fixed-height, line-clamp to align cards) */}
                        <p className="text-sm text-zinc-400 font-sans font-light leading-relaxed line-clamp-3 mb-6 h-[60px]">
                          {project.description}
                        </p>
                      </div>

                      {/* Specifications Blueprint-style Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 pt-5 border-t border-zinc-900/80 text-[11px] font-mono">
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.finish}
                          </span>
                          <span className="text-zinc-200 line-clamp-1 block" title={project.finish}>
                            {project.finish}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.mirror}
                          </span>
                          <span className="text-zinc-200 line-clamp-1 block" title={project.mirror}>
                            {project.mirror}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.area}
                          </span>
                          <span className="text-zinc-200 block">{project.area}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.dimensions}
                          </span>
                          <span className="text-zinc-200 block">
                            {project.length} &times; {project.width}
                          </span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.time}
                          </span>
                          <span className="text-zinc-200 block">{project.time}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block uppercase text-[9px] tracking-wider mb-0.5">
                            {specLabels.status}
                          </span>
                          <span className="text-[#c5a880] font-semibold tracking-wider block">
                            {specLabels.statusValue}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carousel Pagination dots or progress bar */}
        <div className="mt-8 flex justify-center items-center gap-1.5">
          {baseProjects.map((_, idx) => {
            // Determine active dot corresponding to index in loop
            const isActive = (nowIndex - baseProjects.length) % baseProjects.length === idx;
            return (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${isActive ? 'w-6 bg-[#c5a880]' : 'w-1.5 bg-zinc-800'}`}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
