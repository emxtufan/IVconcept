import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';

interface ScrollRevealProps {
  children: string;
  baseOpacity?: number;
  enableBlur?: boolean;
  baseRotation?: number;
  blurStrength?: number;
}

function RevealWord({ word, index, total, progress, baseOpacity, baseRotation, blurStrength }: {
  word: string;
  index: number;
  total: number;
  progress: MotionValue<number>;
  baseOpacity: number;
  baseRotation: number;
  blurStrength: number;
}) {
  const start = 0.15 + (index / total) * 0.5;
  const end = start + 0.12;
  const opacity = useTransform(progress, [start, end], [baseOpacity, 1]);
  const rotate = useTransform(progress, [start, end], [baseRotation, 0]);
  const blur = useTransform(progress, [start, end], [blurStrength, 0]);
  const filter = useTransform(blur, (value) => `blur(${value}px)`);
  return <motion.span aria-hidden="true" style={{ opacity, rotate, filter, transformOrigin: 'left center' }} className="mr-[0.25em] mb-[0.1em] inline-block">{word}</motion.span>;
}

export default function ScrollReveal({ children, baseOpacity = 0, enableBlur = true, baseRotation = 3, blurStrength = 4 }: ScrollRevealProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] });
  const words = children.split(/\s+/).filter(Boolean);
  return (
    <span ref={containerRef} className="inline-flex flex-wrap leading-relaxed text-left">
      {reducedMotion ? children : <>
        <span className="sr-only">{children}</span>
        {words.map((word, index) => <RevealWord key={`${index}-${word}`} word={word} index={index} total={words.length} progress={scrollYProgress} baseOpacity={baseOpacity} baseRotation={baseRotation} blurStrength={enableBlur ? blurStrength : 0} />)}
      </>}
    </span>
  );
}
