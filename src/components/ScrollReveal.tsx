import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

interface ScrollRevealProps {
  children: string;
  baseOpacity?: number;
  enableBlur?: boolean;
  baseRotation?: number;
  blurStrength?: number;
}

export default function ScrollReveal({
  children,
  baseOpacity = 0,
  enableBlur = true,
  baseRotation = 3,
  blurStrength = 4,
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track the scroll of this container relative to the viewport
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  // Split text into words
  const words = children.split(/\s+/).filter(Boolean);

  return (
    <span ref={containerRef} className="inline-flex flex-wrap leading-relaxed text-left">
      {words.map((word, index) => {
        const totalWords = words.length;
        
        // Stagger the activation of each word across the middle 50% of the scroll progress
        const start = 0.15 + (index / totalWords) * 0.5;
        const end = start + 0.12;

        // Custom transforms for opacity, rotation and blur based on scroll progress
        const opacity = useTransform(scrollYProgress, [start - 0.05, start, end - 0.03, end], [baseOpacity, baseOpacity, 1, 1]);
        const rotate = useTransform(scrollYProgress, [start - 0.05, start, end - 0.03, end], [baseRotation, baseRotation, 0, 0]);
        const blurVal = useTransform(scrollYProgress, [start - 0.05, start, end - 0.03, end], [enableBlur ? blurStrength : 0, enableBlur ? blurStrength : 0, 0, 0]);
        const filter = useTransform(blurVal, (v) => `blur(${v}px)`);

        return (
          <motion.span
            key={index}
            style={{
              opacity,
              rotate,
              filter,
              transformOrigin: 'left center',
              display: 'inline-block',
              willChange: 'opacity, filter, transform',
            }}
            className="mr-[0.25em] mb-[0.1em] origin-left select-none"
          >
            {word}
          </motion.span>
        );
      })}
    </span>
  );
}
