import { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { getSiteContent } from '../data';
import TrueFocus from './TrueFocus';

export default function CommitmentSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const content = getSiteContent().textSection;
  const showLogo = content.useLogoInsteadOfText && content.logoUrl.trim().length > 0;

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 60,
    damping: 24,
    restDelta: 0.001,
  });

  const tlX = useTransform(smoothProgress, [0.1, 0.48], [140, 0]);
  const tlY = useTransform(smoothProgress, [0.1, 0.48], [100, 0]);

  const trX = useTransform(smoothProgress, [0.1, 0.48], [-140, 0]);
  const trY = useTransform(smoothProgress, [0.1, 0.48], [100, 0]);

  const blX = useTransform(smoothProgress, [0.1, 0.48], [140, 0]);
  const blY = useTransform(smoothProgress, [0.1, 0.48], [-100, 0]);

  const brX = useTransform(smoothProgress, [0.1, 0.48], [-140, 0]);
  const brY = useTransform(smoothProgress, [0.1, 0.48], [-100, 0]);

  const labelScale = useTransform(smoothProgress, [0.1, 0.48], [0.94, 1]);
  const labelY = useTransform(smoothProgress, [0.1, 0.48], [20, 0]);
  const labelOpacity = useTransform(smoothProgress, [0.1, 0.42], [0.2, 0.85]);

  const headlineScale = useTransform(smoothProgress, [0.1, 0.48], [0.88, 1]);
  const headlineY = useTransform(smoothProgress, [0.1, 0.48], [35, 0]);
  const headlineOpacity = useTransform(smoothProgress, [0.1, 0.46], [0.1, 1]);

  const logoScale = useTransform(smoothProgress, [0.1, 0.48], [0.62, 1.06]);
  const logoY = useTransform(smoothProgress, [0.1, 0.48], [42, 0]);
  const logoOpacity = useTransform(smoothProgress, [0.1, 0.44], [0.08, 1]);

  const dividerScaleWidth = useTransform(smoothProgress, [0.1, 0.48], [0.3, 1]);
  const dividerOpacity = useTransform(smoothProgress, [0.1, 0.45], [0, 1]);

  const paragraphScale = useTransform(smoothProgress, [0.1, 0.48], [0.92, 1]);
  const paragraphY = useTransform(smoothProgress, [0.1, 0.48], [45, 0]);
  const paragraphOpacity = useTransform(smoothProgress, [0.1, 0.48], [0, 0.85]);

  const cornerOpacity = useTransform(smoothProgress, [0.1, 0.42], [0.2, 1]);

  return (
    <section
      ref={containerRef}
      id="commitment-section"
      className="relative z-40 min-h-[50vh] w-full overflow-hidden px-6 pb-12 pt-4 select-none md:px-16 md:pb-16 md:pt-6"
      style={{ boxShadow: 'rgba(0, 0, 0, 0.6) 0px -20px 50px, rgba(0, 0, 0, 0.6) 0px 20px 50px' }}
    >
      <motion.div
        style={{ x: tlX, y: tlY, opacity: cornerOpacity }}
        className="pointer-events-none absolute left-8 top-8 h-6 w-6 border-l border-t sm:left-12 sm:top-12 md:left-16 md:top-16"
      />
      <motion.div
        style={{ x: trX, y: trY, opacity: cornerOpacity }}
        className="pointer-events-none absolute right-8 top-8 h-6 w-6 border-r border-t sm:right-12 sm:top-12 md:right-16 md:top-16"
      />
      <motion.div
        style={{ x: blX, y: blY, opacity: cornerOpacity }}
        className="pointer-events-none absolute bottom-8 left-8 h-6 w-6 border-b border-l sm:bottom-12 sm:left-12 md:bottom-16 md:left-16"
      />
      <motion.div
        style={{ x: brX, y: brY, opacity: cornerOpacity }}
        className="pointer-events-none absolute bottom-8 right-8 h-6 w-6 border-b border-r sm:bottom-12 sm:right-12 md:bottom-16 md:right-16"
      />

      <div className="mx-auto flex w-full max-w-[1140px] flex-col items-center justify-center py-12 text-center md:py-20">
        <motion.span
          style={{ scale: labelScale, y: labelY, opacity: labelOpacity }}
          className="mb-8 block font-sans text-[10px] font-bold uppercase tracking-[0.4em] text-[#c5a880] sm:mb-12 md:text-xs"
        >
          {content.eyebrow}
        </motion.span>

        {showLogo ? (
          <motion.div
            style={{ scale: logoScale, y: logoY, opacity: logoOpacity }}
            className="flex w-full items-center justify-center"
          >
            <img
              src={content.logoUrl}
              alt={content.logoAlt || 'Commitment logo'}
              className="h-auto max-h-[240px] w-full max-w-[360px] object-contain sm:max-w-[460px] md:max-w-[620px] lg:max-w-[760px]"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        ) : (
          <div className="flex w-full flex-col items-center pt-6 md:pt-10">
            <motion.h2
              style={{ scale: headlineScale, y: headlineY, opacity: headlineOpacity }}
              className="max-w-[750px] text-center font-display text-xl font-light leading-[1.4] tracking-widest text-[#2c2218] sm:text-2xl md:text-3xl lg:text-4xl xl:text-[40px]"
            >
              <TrueFocus 
                sentence={content.titleLine1}
                manualMode={false}
                blurAmount={4}
                borderColor="#130a01"
                animationDuration={0.5}
                pauseBetweenAnimations={1}
                glowColor="#c5a880"
                />  
              <br />
              {content.titleLine2}
            </motion.h2>

            <motion.div
              style={{ scaleX: dividerScaleWidth, opacity: dividerOpacity }}
              className="my-4 h-px w-12 bg-[#c5a880]/20"
            />

            <motion.p
              style={{ scale: paragraphScale, y: paragraphY, opacity: paragraphOpacity }}
              className="mt-4 max-w-[550px] text-center font-sans text-xs font-light leading-relaxed tracking-wider text-black sm:mt-6 sm:text-sm md:text-base lg:text-lg"
            >
              {content.descriptionLine1}
              <br />
              {content.descriptionLine2}
            </motion.p>
          </div>
        )}
      </div>
    </section>
  );
}
