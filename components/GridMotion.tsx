import { useEffect, useRef, FC, ReactNode } from 'react';
import { gsap } from 'gsap';

interface GridMotionProps {
  items?: (string | ReactNode)[];
  gradientColor?: string;
}

const isImageSource = (value: string) =>
  /^(https?:\/\/|\/|data:image\/)/i.test(value);

const fillItemsToCount = (items: (string | ReactNode)[], totalItems: number) => {
  if (!items.length) {
    return Array.from({ length: totalItems }, (_, index) => `Item ${index + 1}`);
  }

  if (items.length >= totalItems) {
    return items.slice(0, totalItems);
  }

  return Array.from({ length: totalItems }, (_, index) => items[index % items.length]);
};

const GridMotion: FC<GridMotionProps> = ({ items = [], gradientColor = 'black' }) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cycleWidthsRef = useRef<number[]>([]);
  const rowPositionsRef = useRef<number[]>([]);

  const totalItems = 28;
  const combinedItems = fillItemsToCount(items, totalItems);
  const rows = Array.from({ length: 4 }, (_, rowIndex) =>
    combinedItems.slice(rowIndex * 7, rowIndex * 7 + 7),
  );

  useEffect(() => {
    gsap.ticker.lagSmoothing(0);

    const rowElements = rowRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!rowElements.length) {
      return;
    }

    const setMeasurements = () => {
      rowElements.forEach((row, index) => {
        const cycleWidth = row.scrollWidth / 3;

        if (!cycleWidth || Number.isNaN(cycleWidth)) {
          return;
        }

        cycleWidthsRef.current[index] = cycleWidth;

        if (typeof rowPositionsRef.current[index] !== 'number') {
          rowPositionsRef.current[index] = -cycleWidth;
        } else {
          rowPositionsRef.current[index] = gsap.utils.wrap(
            -2 * cycleWidth,
            0,
            rowPositionsRef.current[index],
          );
        }

        gsap.set(row, { x: rowPositionsRef.current[index] });
      });
    };

    const resizeObserver = new ResizeObserver(() => {
      setMeasurements();
    });

    rowElements.forEach((row) => resizeObserver.observe(row));
    setMeasurements();

    const updateMotion = (): void => {
      const delta = gsap.ticker.deltaRatio(60);

      rowElements.forEach((row, index) => {
        const cycleWidth = cycleWidthsRef.current[index];
        if (!cycleWidth) {
          return;
        }

        const direction = index % 2 === 0 ? -1 : 1;
        const speed = (0.38 + index * 0.035) * delta;
        const nextX = gsap.utils.wrap(
          -2 * cycleWidth,
          0,
          rowPositionsRef.current[index] + direction * speed,
        );

        rowPositionsRef.current[index] = nextX;
        gsap.set(row, { x: nextX });
      });
    };

    gsap.ticker.add(updateMotion);
    window.addEventListener('resize', setMeasurements);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', setMeasurements);
      gsap.ticker.remove(updateMotion);
    };
  }, [items.length]);

  return (
    <div ref={gridRef} className="h-full w-full overflow-hidden">
      <section
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          background: ``,
        }}
      >
        <div className="absolute inset-0 pointer-events-none z-[4] bg-[length:250px]"></div>
        <div className="absolute left-1/2 top-1/2 z-[2] grid h-[126vh] w-[180vw] -translate-x-1/2 -translate-y-1/2 grid-cols-1 grid-rows-4 gap-3 rotate-[-15deg] origin-center sm:h-[138vh] sm:gap-4 md:h-[155vh] md:w-[160vw]">
          {rows.map((rowItems, rowIndex) => (
            <div
              key={rowIndex}
              className="flex h-full w-max gap-4"
              style={{ willChange: 'transform, filter' }}
              ref={el => {
                rowRefs.current[rowIndex] = el;
              }}
            >
              {Array.from({ length: 3 }, (_, repeatIndex) =>
                rowItems.map((content, itemIndex) => {
                  const isImage = typeof content === 'string' && isImageSource(content);

                  return (
                    <div
                      key={`${rowIndex}-${repeatIndex}-${itemIndex}`}
                      className="relative h-full w-[38vw] min-w-[38vw] sm:w-[29vw] sm:min-w-[29vw] md:w-[22vw] md:min-w-[22vw] lg:w-[18vw] lg:min-w-[18vw] xl:w-[15vw] xl:min-w-[15vw]"
                    >
                      <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#111] text-white text-[1.5rem]">
                        {isImage ? (
                          <div
                            className="absolute left-0 top-0 h-full w-full bg-cover bg-center"
                            style={{ backgroundImage: `url(${content})` }}
                          />
                        ) : (
                          <div className="relative z-[1] flex h-full w-full items-center justify-center p-4 text-center">
                            {content}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          ))}
        </div>
        <div className="relative w-full h-full top-0 left-0 pointer-events-none"></div>
      </section>
    </div>
  );
};

export default GridMotion;
