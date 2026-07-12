import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { SHOW_REEL_CONTENT } from '../data';

export default function ShowReel() {
  const [isPlayingFull, setIsPlayingFull] = useState(false);
  const closeGuardUntilRef = useRef(0);

  const videoUrl = SHOW_REEL_CONTENT.videoUrl;

  const openFullscreen = () => {
    if (Date.now() < closeGuardUntilRef.current) return;
    setIsPlayingFull(true);
  };

  const closeFullscreen = () => {
    closeGuardUntilRef.current = Date.now() + 400;
    setIsPlayingFull(false);
  };

  useEffect(() => {
    if (!isPlayingFull) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlayingFull]);

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Video Box Container */}
      <motion.div
        whileHover={{ scale: 1.01 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        onClick={openFullscreen}
        className="relative aspect-[1.5/1] md:aspect-[1.48/1] w-full bg-[#050505] border border-zinc-300 overflow-hidden group cursor-pointer"
      >
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-95 group-hover:scale-[1.02] transition-all duration-700"
        >
          <source src={videoUrl} type="video/mp4" />
        </video>

        {/* Subtle Dark Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30 pointer-events-none" />

        {/* Play Icon and Label in Top-Left */}
        <div className="absolute top-5 left-5 flex items-center gap-3 select-none">
          {/* Solid white circle with black triangle */}
          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-2.5 h-2.5 text-black fill-current ml-[1px]" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-[11px] font-sans font-bold text-white tracking-[0.16em]">
            {SHOW_REEL_CONTENT.label}
          </span>
        </div>
      </motion.div>

      {/* Under-Card Details Row */}
      <div className="flex items-center gap-12 text-[11px] tracking-[0.15em] font-sans font-semibold uppercase mt-0.5 px-0.5 relative z-20">
        <span className="text-[#2c2218]">{SHOW_REEL_CONTENT.location}</span>
        <div className="flex items-center gap-2">
          {/* Faint solid bullet */}
          <span className="text-[#2c2218]/50 text-[10px]">•</span>
          <span className="text-[#2c2218]/80">{SHOW_REEL_CONTENT.type}</span>
        </div>
      </div>

      {/* Fullscreen Video Overlay Player */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {isPlayingFull && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={closeFullscreen}
                  className="fixed inset-0 z-[220] flex items-center justify-center bg-black/95 p-4 md:p-8"
                >
                  {/* Close Button */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      closeFullscreen();
                    }}
                    className="absolute top-6 right-6 z-[230] rounded-full border border-zinc-800 bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-800"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Video Element */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    className="relative w-full max-w-5xl aspect-video overflow-hidden rounded-lg border border-zinc-800 bg-black shadow-2xl"
                  >
                    <video
                      autoPlay
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    >
                      <source src={videoUrl} type="video/mp4" />
                    </video>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </div>
  );
}
