import { useEffect, type RefObject } from 'react';
import { useReducedMotion } from 'motion/react';

/** Do not download or decode decorative videos until they are actually visible. */
export function useVisibleVideo(ref: RefObject<HTMLVideoElement | null>) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let visible = false;
    const syncPlayback = () => {
      if (!visible || document.hidden || reducedMotion) video.pause();
      else void video.play().catch(() => { /* Browser autoplay policy. */ });
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) {
        let changed = false;
        video.querySelectorAll<HTMLSourceElement>('source[data-src]').forEach((source) => {
          if (!source.dataset.src?.trim()) return;
          if (source.getAttribute('src') !== source.dataset.src) {
            source.src = source.dataset.src ?? '';
            changed = true;
          }
        });
        if (changed) {
          video.preload = 'metadata';
          video.load();
        }
      }
      syncPlayback();
    }, { threshold: 0.01 });
    observer.observe(video);
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', syncPlayback);
      video.pause();
    };
  }, [ref, reducedMotion]);
}
