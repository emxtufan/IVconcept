import GridMotion from '../../components/GridMotion';
import { getSiteContent } from '../data';

export default function GallerySection() {
  const items = getSiteContent()
    .imageSection.columns
    .flatMap((column) => column.images)
    .map((image) => image.url)
    .slice(0, 28);

  if (!items.length) {
    return null;
  }

  return (
    <section id="gallery-section" className="relative z-30">
      <div className="relative h-[82vh] min-h-[560px] w-full md:h-[96vh]">
        <GridMotion items={items} gradientColor="#121110" />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.42)_100%)]" />

        <div className="absolute inset-x-0 bottom-6 z-20 flex justify-center px-6 md:bottom-8">
          <a
            href="/galerie-foto"
            className="inline-flex items-center gap-3 rounded-full border border-white/18 bg-black/12 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-md transition hover:border-white/32 hover:bg-black/18"
          >
            <span>Vezi galeria foto completă</span>
            <span aria-hidden="true" className="text-base leading-none">
              &rarr;
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
