import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
} from 'motion/react';
import {
  ArrowDown,
  ArrowRight,
  Hand,
  MousePointerClick,
  MoveHorizontal,
  Play,
  Pointer,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { getSiteContent } from '../data';
import BlurText from './BlurText';

interface WatchProject {
  id: string;
  title: string;
  category: string;
  description: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  poster?: string;
}

const HEX_VERTICAL = Math.sqrt(3) / 2;

// Radial falloff: real-time distance (px) from the viewport center → scale.
// The stops are tuned for a ~700px radius and rescaled by `falloff` to the
// actual container size so the composition reads the same on mobile.
// Collision safety: lattice spacing is 1.5 × itemSize, so the worst adjacent
// pair (center at 1.55 plus a neighbour at ≤1.0) spans at most ~1.28 × spacing
// in radii — every gap stays ≥ ~28px at any drag position.
const DIST_STOPS = [0, 180, 420, 700];
const SCALE_STOPS = [1.55, 1.05, 0.65, 0.4];
const FALLOFF_RADIUS = 700;

// Deterministic PRNG so the repeated item distribution is stable across renders
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Touch-first devices get clamped vertical travel (instead of infinite
// vertical wrap) so upward swipes can hand off to native page scrolling
function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

// Wraps v into [-range/2, range/2); the double-modulo keeps negative values
// (JS % preserves sign) on the correct side.
const wrapCoord = (v: number, range: number) =>
  ((((v + range / 2) % range) + range) % range) - range / 2;

interface SelectedItem {
  project: WatchProject;
  // Screen rect of the clicked circle, used to expand the preview from its position
  origin: { x: number; y: number; width: number } | null;
}

interface HoneycombItemProps {
  key?: string | number;
  project: WatchProject;
  baseX: number;
  baseY: number;
  size: number;
  wrapW: number;
  wrapH: number;
  wrapVertical: boolean;
  falloff: number;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  prefersReducedMotion: boolean;
  onSelect: (item: SelectedItem) => void;
}

function HoneycombItem({
  project,
  baseX,
  baseY,
  size,
  wrapW,
  wrapH,
  wrapVertical,
  falloff,
  dragX,
  dragY,
  prefersReducedMotion,
  onSelect,
}: HoneycombItemProps) {
  // Infinite tiling: the item's on-screen offset from the viewport center is
  // its base lattice position plus the drag offset, wrapped into the tiling
  // region. The wrap jump happens in the hidden margin outside the viewport.
  // On touch devices the vertical axis doesn't wrap — dragY is clamped there.
  const x = useTransform(dragX, (dx) => wrapCoord(baseX + dx, wrapW));
  const y = useTransform(dragY, (dy) =>
    wrapVertical ? wrapCoord(baseY + dy, wrapH) : baseY + dy
  );
  const distance = useTransform([x, y], ([wx, wy]: number[]) => Math.hypot(wx, wy));

  const scaleStops = useMemo(() => DIST_STOPS.map((d) => d * falloff), [falloff]);
  const scale = useTransform(distance, scaleStops, SCALE_STOPS);
  const opacity = useTransform(
    distance,
    [0, 350 * falloff, FALLOFF_RADIUS * falloff],
    [1, 0.92, 0.32]
  );
  // Larger (closer-to-center) circles stack above their smaller neighbours
  const zIndex = useTransform(distance, (d) =>
    Math.max(0, 40 - Math.round((d / (FALLOFF_RADIUS * falloff)) * 40))
  );

  return (
    <motion.div
      className="absolute left-1/2 top-1/2"
      style={{
        x,
        y,
        zIndex,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        willChange: 'transform',
      }}
    >
      <motion.button
        type="button"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onSelect({
            project,
            origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width },
          });
        }}
        style={{
          scale: prefersReducedMotion ? 1 : scale,
          opacity: prefersReducedMotion ? 1 : opacity,
          willChange: 'transform',
        }}
        className="relative block h-full w-full overflow-hidden rounded-full border border-zinc-800 bg-zinc-900 shadow-[0_10px_30px_rgba(0,0,0,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c5a880]"
        aria-label={`Open story: ${project.title}`}
      >
        <img
          src={project.thumbnail}
          alt=""
          draggable={false}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="pointer-events-none h-full w-full select-none object-cover"
        />
        {project.mediaType === 'video' && (
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-sm">
              <Play size={14} className="fill-current" />
            </span>
          </span>
        )}
        <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" aria-hidden="true" />
      </motion.button>
    </motion.div>
  );
}

export default function AppleWatchGridSection() {
  const reviewsContent = getSiteContent().reviews;
  const reviewHints = reviewsContent.hints;
  const projects = reviewsContent.items as WatchProject[];
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isTouch = useIsCoarsePointer();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const panOriginRef = useRef({ x: 0, y: 0 });
  const minDragYRef = useRef(0);
  const [viewport, setViewport] = useState({ width: 1200, height: 560, itemSize: 104 });
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  // Interaction hint: shown until the first drag or circle click, remembered
  // for the rest of the browser session
  const [hintDismissed, setHintDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('watch-grid-hint-dismissed') === '1';
    } catch {
      return false;
    }
  });

  const dismissHint = useCallback(() => {
    setHintDismissed(true);
    try {
      sessionStorage.setItem('watch-grid-hint-dismissed', '1');
    } catch {
      // storage unavailable (private mode) — hide for this render only
    }
  }, []);

  // Unbounded drag offsets — the grid tiles forever, so no constraints
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (!width || !height) return;
      // Size the cells from the container area so roughly 14 circles are
      // visible at a time regardless of viewport shape
      const spacingTarget = Math.sqrt((width * height) / (14 * HEX_VERTICAL));
      setViewport({
        width,
        height,
        itemSize: Math.round(Math.min(150, Math.max(72, spacingTarget / 1.5))),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selected]);

  // Touch gestures (coarse pointers only): after a ~10px threshold the gesture
  // locks to one direction for its whole lifetime. Horizontal swipes drive the
  // infinite grid. Vertical swipes drive the clamped grid while travel
  // remains, then the handler stops consuming touchmoves so native page
  // scrolling takes over immediately. preventDefault is only called on
  // confirmed grid-owned moves, never on undecided or page-owned ones.
  useEffect(() => {
    const node = containerRef.current;
    if (!isTouch || !node) return;

    let lock: 'none' | 'x' | 'y' | 'page' = 'none';
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let velocityX = 0;
    let velocityY = 0;

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      dragX.stop();
      dragY.stop();
      const touch = event.touches[0];
      lock = 'none';
      startX = lastX = touch.clientX;
      startY = lastY = touch.clientY;
      originX = dragX.get();
      originY = dragY.get();
      velocityX = velocityY = 0;
      lastT = performance.now();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1 || lock === 'page') return;
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (lock === 'none') {
        if (Math.hypot(dx, dy) < 10) return; // direction not yet clear
        if (Math.abs(dx) > Math.abs(dy)) {
          lock = 'x';
        } else {
          // Vertical: own the gesture only if the grid can still travel that way
          const minY = minDragYRef.current;
          const canTravel = dy < 0 ? dragY.get() > minY + 0.5 : dragY.get() < -0.5;
          lock = canTravel ? 'y' : 'page';
        }
        if (lock !== 'page') {
          isDraggingRef.current = true;
          dismissHint();
        } else {
          return;
        }
      }

      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      if (lock === 'x') {
        event.preventDefault();
        dragX.set(originX + dx);
        velocityX = 0.8 * (((touch.clientX - lastX) / dt) * 1000) + 0.2 * velocityX;
      } else if (lock === 'y') {
        const minY = minDragYRef.current;
        const proposed = originY + dy;
        dragY.set(Math.min(0, Math.max(minY, proposed)));
        if (proposed < minY - 1 || proposed > 1) {
          // Limit reached mid-gesture: hand the rest of the swipe to the
          // browser so the page scrolls immediately (no more preventDefault)
          lock = 'page';
        } else {
          event.preventDefault();
          velocityY = 0.8 * (((touch.clientY - lastY) / dt) * 1000) + 0.2 * velocityY;
        }
      }
      lastX = touch.clientX;
      lastY = touch.clientY;
      lastT = now;
    };

    const onTouchEnd = () => {
      if (!prefersReducedMotion) {
        if (lock === 'x') {
          animate(dragX, dragX.get(), {
            type: 'inertia',
            velocity: velocityX,
            power: 0.5,
            timeConstant: 320,
            restDelta: 0.5,
          });
        } else if (lock === 'y') {
          animate(dragY, dragY.get(), {
            type: 'inertia',
            velocity: velocityY,
            power: 0.5,
            timeConstant: 320,
            min: minDragYRef.current,
            max: 0,
            bounceStiffness: 300,
            bounceDamping: 40,
            restDelta: 0.5,
          });
        }
      }
      lock = 'none';
      requestAnimationFrame(() => {
        isDraggingRef.current = false;
      });
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isTouch, prefersReducedMotion, dragX, dragY, dismissHint]);

  const { width, height, itemSize } = viewport;
  // Sparse lattice: 1.5× the base size leaves generous negative space and
  // keeps roughly 12–16 circles visible at a time
  const spacing = itemSize * 1.5;
  const rowHeight = spacing * HEX_VERTICAL;
  // Tiling region: viewport plus a hidden margin where items teleport, rounded
  // up to whole lattice periods (1 column / 2 rows) so wrapped items land
  // exactly back on the honeycomb with the correct row stagger.
  const cols = Math.ceil((width + itemSize * 3) / spacing);
  // On touch devices add one extra row pair: vertical wrap is off there, so
  // the extra rows become bounded vertical travel instead
  const rows = (Math.ceil((height + itemSize * 3) / (rowHeight * 2)) + (isTouch ? 1 : 0)) * 2;
  const wrapW = cols * spacing;
  const wrapH = rows * rowHeight;
  const falloff = Math.max(0.35, Math.min(1, Math.hypot(width, height) / 2 / FALLOFF_RADIUS));
  // Touch vertical limit, derived from the actual grid: the grid may move up
  // only until its last (bottom) row reaches the bottom edge of the section,
  // so no empty space ever shows. 0 = initial position; downward is blocked.
  const minDragY = isTouch
    ? Math.min(0, height / 2 - (rows - 1 - Math.floor(rows / 2)) * rowHeight)
    : 0;
  minDragYRef.current = minDragY;

  const items = useMemo(() => {
    // Seeded random distribution of the 10 unique projects over the torus,
    // with no project ever occupying two adjacent cells — including across
    // the horizontal/vertical wrap seams.
    const rand = mulberry32(0xc0ffee ^ (cols * 73 + rows * 179));
    const assignment = new Array<number>(rows * cols).fill(-1);
    const cellIndex = (col: number, row: number) =>
      ((row + rows) % rows) * cols + ((col + cols) % cols);
    // The 6 hex neighbours on the row-staggered torus (odd rows shift +½ cell)
    const neighborsOf = (col: number, row: number) => {
      const shift = row % 2 === 1 ? 1 : -1;
      return [
        cellIndex(col - 1, row),
        cellIndex(col + 1, row),
        cellIndex(col, row - 1),
        cellIndex(col + shift, row - 1),
        cellIndex(col, row + 1),
        cellIndex(col + shift, row + 1),
      ];
    };
    const pickFor = (col: number, row: number) => {
      const taken = new Set(neighborsOf(col, row).map((n) => assignment[n]));
      const start = Math.floor(rand() * projects.length);
      for (let k = 0; k < projects.length; k++) {
        const candidate = (start + k) % projects.length;
        if (!taken.has(candidate)) return candidate;
      }
      return start;
    };
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) assignment[cellIndex(col, row)] = pickFor(col, row);
    // The row-major fill can't see not-yet-assigned wrap neighbours; one repair
    // pass resolves seam conflicts (a re-pick avoids all 6 now-known neighbours,
    // so it never introduces a new conflict)
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const me = cellIndex(col, row);
        if (neighborsOf(col, row).some((n) => n !== me && assignment[n] === assignment[me])) {
          assignment[me] = pickFor(col, row);
        }
      }

    // Anchor the lattice so one cell sits exactly on the viewport center at
    // rest — the dominant circle. wrapCoord() renormalizes the offsets, so
    // this shift doesn't affect the tiling seams.
    const centerRow = Math.floor(rows / 2);
    const centerCol = Math.floor(cols / 2);
    const centerStagger = (centerRow % 2) * 0.5;
    const list: { key: string; project: WatchProject; baseX: number; baseY: number }[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        list.push({
          // Geometry and pointer mode baked into the key so items remount
          // (with fresh transform closures) when the pool is resized or the
          // input mode changes
          key: `${cols}x${rows}-${itemSize}-${isTouch ? 't' : 'd'}-${col}-${row}`,
          project: projects[assignment[cellIndex(col, row)]],
          baseX: (col + (row % 2) * 0.5 - centerCol - centerStagger) * spacing,
          baseY: (row - centerRow) * rowHeight,
        });
      }
    }
    return list;
  }, [cols, rows, spacing, rowHeight, wrapW, wrapH, itemSize, isTouch, projects]);

  const handleSelect = (item: SelectedItem) => {
    if (isDraggingRef.current) return;
    dismissHint();
    setSelected(item);
  };

  return (
    <section id="recenzii" className="relative z-40  py-24 md:py-32 px-6 md:px-16 border-t  select-none overflow-hidden">
      <div className="max-w-[1340px] w-full mx-auto">
        {/* Section Title & Heading */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
          <div className="flex-1">
            <span className="text-[10px] md:text-xs text-[#7a5c32] tracking-[0.25em] font-sans font-bold uppercase block mb-3">
              {reviewsContent.eyebrow}
            </span>
            <div
              role="heading"
              aria-level={2}
              className="text-3xl md:text-5xl font-display font-semibold text-[#2c2218] tracking-tight leading-tight"
            >
              <BlurText
                text={reviewsContent.titleLine1}
                delay={200}
                animateBy="words"
                direction="bottom"
                className="justify-start"
              />
              <BlurText
                text={reviewsContent.titleLine2}
                delay={200}
                animateBy="words"
                direction="bottom"
                className="justify-start"
              />
            </div>
          </div>
          <p className="text-xs md:text-sm text-zinc-600 font-medium tracking-wide max-w-xs md:text-right">
            {reviewsContent.description}
          </p>
        </div>

        {/* Honeycomb Viewport — pan gesture surface for the infinite grid */}
        <motion.div
          ref={containerRef}
          className="relative h-[70vh] min-h-[420px] max-h-[760px] w-full overflow-hidden   cursor-grab active:cursor-grabbing"
          // pan-y keeps native vertical page scrolling available on touch
          // devices; the touch handler claims moves only while the grid owns
          // the gesture. Desktop keeps the original capture-everything drag.
          style={{ touchAction: isTouch ? 'pan-y' : 'none' }}
          onPointerDown={() => {
            // A new pointer stops any in-flight momentum glide
            dragX.stop();
            dragY.stop();
          }}
          onPanStart={() => {
            if (isTouch) return; // touch gestures are handled manually
            dismissHint();
            isDraggingRef.current = true;
            panOriginRef.current = { x: dragX.get(), y: dragY.get() };
          }}
          onPan={(_, info) => {
            if (isTouch) return;
            dragX.set(panOriginRef.current.x + info.offset.x);
            dragY.set(panOriginRef.current.y + info.offset.y);
          }}
          onPanEnd={(_, info) => {
            if (isTouch) return;
            requestAnimationFrame(() => {
              isDraggingRef.current = false;
            });
            if (!prefersReducedMotion) {
              animate(dragX, dragX.get(), {
                type: 'inertia',
                velocity: info.velocity.x,
                power: 0.5,
                timeConstant: 320,
                restDelta: 0.5,
              });
              animate(dragY, dragY.get(), {
                type: 'inertia',
                velocity: info.velocity.y,
                power: 0.5,
                timeConstant: 320,
                restDelta: 0.5,
              });
            }
          }}
        >
          {/* Masked layer: circles fade out softly near every edge instead of
              being clipped hard by the container's overflow. The mask lives on
              this inner wrapper so the container's own border and background
              stay crisp; both -webkit- and standard properties for
              Safari/Chrome/mobile. */}
          <div
            className="absolute inset-0"
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%), linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)',
              WebkitMaskComposite: 'source-in',
              maskComposite: 'intersect',
            }}
          >
            {items.map((item) => (
              <HoneycombItem
                key={item.key}
                project={item.project}
                baseX={item.baseX}
                baseY={item.baseY}
                size={itemSize}
                wrapW={wrapW}
                wrapH={wrapH}
                wrapVertical={!isTouch}
                falloff={falloff}
                dragX={dragX}
                dragY={dragY}
                prefersReducedMotion={prefersReducedMotion}
                onSelect={handleSelect}
              />
            ))}
          </div>

          {/* Interaction hint — bottom-left, non-interactive, dismissed after
              the first drag or circle click and remembered per session */}
          <AnimatePresence>
            {!hintDismissed && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.35 } }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: prefersReducedMotion ? 0.2 : 0.7, delay: 0.25, ease: 'easeOut' }}
                className="pointer-events-none absolute bottom-3 left-3 md:bottom-5 md:left-5 z-[60] flex flex-col gap-2 rounded-md border border-white/10 bg-black/35 backdrop-blur-sm px-3.5 py-3"
              >
                {(isTouch
                  ? [
                      { icon: <Pointer size={11} />, label: reviewHints.mobileOpen, arrow: false },
                      { icon: <Hand size={11} />, label: reviewHints.mobileDrag, arrow: true },
                      { icon: <ArrowDown size={11} />, label: reviewHints.scroll, arrow: false },
                    ]
                  : [
                      { icon: <MousePointerClick size={11} />, label: reviewHints.desktopOpen, arrow: false },
                      { icon: <MoveHorizontal size={11} />, label: reviewHints.desktopDrag, arrow: true },
                      { icon: <ArrowDown size={11} />, label: reviewHints.scroll, arrow: false },
                    ]
                ).map((row) => (
                  <span
                    key={row.label}
                    className="flex items-center gap-2 font-mono text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-white/60"
                  >
                    <span className="text-white/45" aria-hidden="true">
                      {row.icon}
                    </span>
                    {row.label}
                    {row.arrow && (
                      <motion.span
                        className="text-white/45"
                        aria-hidden="true"
                        animate={prefersReducedMotion ? undefined : { x: [0, 5, 0] }}
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
                        }
                      >
                        <ArrowRight size={11} />
                      </motion.span>
                    )}
                  </span>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Expanded Story / Reel Preview */}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {selected && (
                <motion.div
                  className="fixed inset-0 z-[220] flex items-center justify-center p-4 md:p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="absolute inset-0 bg-black/88 backdrop-blur-md"
                    onClick={() => setSelected(null)}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={
                      prefersReducedMotion || !selected.origin
                        ? { opacity: 0, scale: 0.96 }
                        : {
                            opacity: 0.35,
                            x: selected.origin.x - window.innerWidth / 2,
                            y: selected.origin.y - window.innerHeight / 2,
                            scale: selected.origin.width / Math.min(380, window.innerWidth - 32),
                            borderRadius: 999,
                          }
                    }
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1, borderRadius: 34 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0.15 }
                        : { type: 'spring', stiffness: 260, damping: 28 }
                    }
                    className="relative z-10 w-full max-w-[380px] overflow-hidden rounded-[34px] border border-white/10 bg-[#090909] shadow-[0_30px_90px_rgba(0,0,0,0.78)]"
                    role="dialog"
                    aria-modal="true"
                    aria-label={selected.project.title}
                  >
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
                      {selected.project.mediaType === 'video' ? (
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          preload="auto"
                          disablePictureInPicture
                          poster={selected.project.poster ?? selected.project.thumbnail}
                          className="h-full w-full object-cover"
                        >
                          <source src={selected.project.mediaUrl} type="video/mp4" />
                        </video>
                      ) : (
                        <img
                          src={selected.project.mediaUrl}
                          alt={selected.project.title}
                          draggable={false}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.54)_0%,rgba(0,0,0,0.1)_30%,rgba(0,0,0,0.18)_56%,rgba(0,0,0,0.78)_100%)]" />

                      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
                        <div className="pr-4">
                          <span className="block font-mono text-[10px] uppercase tracking-[0.24em] text-[#f1d1a4]">
                            {selected.project.category}
                          </span>
                          <h3 className="mt-2 font-sans text-[22px] font-semibold leading-[1.02] tracking-[-0.04em] text-white">
                            {selected.project.title}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/12 bg-black/55 text-zinc-200 backdrop-blur-sm transition-colors duration-300 hover:border-[#c5a880] hover:text-white"
                          aria-label="Close story"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                        <p className="max-w-[88%] font-sans text-[13px] leading-relaxed text-white/82">
                          {selected.project.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </section>
  );
}
