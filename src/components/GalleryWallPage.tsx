import { useEffect, useMemo, useState } from 'react';
import LightGallery from 'lightgallery/react';
import lgZoom from 'lightgallery/plugins/zoom';
import 'lightgallery/css/lightgallery.css';
import 'lightgallery/css/lg-zoom.css';
import { getSiteContent } from '../data';
import type { GalleryRecord } from '../types/galleries';

function resolveAssetUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (typeof window === 'undefined') {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

export default function GalleryWallPage() {
  const brandName = getSiteContent().footer.brandName;
  const [galleries, setGalleries] = useState<GalleryRecord[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/galleries')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load galleries: ${response.status}`);
        }

        return (await response.json()) as GalleryRecord[];
      })
      .then((data) => {
        if (!cancelled) {
          setGalleries(data);
        }
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) {
          setError('Nu am putut incarca galeriile separate.');
          setGalleries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalImages = useMemo(
    () => (galleries ?? []).reduce((sum, gallery) => sum + gallery.itemCount, 0),
    [galleries],
  );

  return (
    <div className="grain-bg relative min-h-screen overflow-x-clip bg-[#e8e0d6] text-[#2c2218]">
      <div className="grain-overlay" />

      <div className="sticky top-0 z-[120] border-b border-[#2c2218]/10 bg-[#e8e0d6]/82 backdrop-blur-xl">
        <div className="relative z-10 mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-6 py-5 md:px-10">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d3b186]">
              [ Galerie foto ]
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[#2c2218] md:text-3xl">
              Peretele complet de imagini
            </h1>
          </div>

          <a
            href="/"
            className="inline-flex items-center gap-3 rounded-full border border-[#2c2218]/12 bg-[#f2ebe2]/72 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/84 transition hover:border-[#2c2218]/24 hover:text-[#2c2218]"
          >
            <span>Inapoi</span>
            <span aria-hidden="true" className="text-base leading-none">
              &larr;
            </span>
          </a>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1480px] px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-[26px] border border-[#2c2218]/10 bg-[#f3ece3]/82 px-5 py-4 shadow-[0_24px_60px_rgba(44,34,24,0.08)]">
          <div>
            <p className="text-sm font-medium text-[#2c2218]">{brandName}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#2c2218]/42">
              {galleries === null ? 'Se incarca...' : `${totalImages} imagini in ${galleries.length} galerii`}
            </p>
          </div>

          <a
            href="/#gallery-section"
            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8d6c4c] transition hover:text-[#2c2218]"
          >
            <span>Vezi sectiunea din homepage</span>
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>

        {galleries && galleries.length > 0 ? (
          <div className="mb-8 flex flex-wrap gap-2">
            {galleries.map((gallery) => (
              <a
                key={gallery.id}
                href={`#${gallery.slug}`}
                className="rounded-full border border-[#2c2218]/10 bg-[#efe7dd]/78 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#2c2218]/24 hover:text-[#2c2218]"
              >
                {gallery.name}
              </a>
            ))}
          </div>
        ) : null}

        {galleries === null ? (
          <div className="rounded-[30px] border border-[#2c2218]/10 bg-[#f3ece3]/82 px-6 py-16 text-center text-sm text-[#2c2218]/52">
            Se incarca galeriile...
          </div>
        ) : error ? (
          <div className="rounded-[30px] border border-[#8f4f45]/22 bg-[#f1ddd7] px-6 py-12 text-center text-sm text-[#7a2f24]">
            {error}
          </div>
        ) : galleries.length === 0 ? (
          <div className="rounded-[30px] border border-dashed border-[#2c2218]/12 bg-[#f3ece3]/82 px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#2c2218]">Nu exista galerii separate inca.</p>
            <p className="mt-2 text-sm text-[#2c2218]/42">
              Creeaza prima galerie din `/admin`, apoi incarca imagini in folderul ei dedicat.
            </p>
          </div>
        ) : (
          <div className="space-y-10">
            {galleries.map((gallery) => (
              <section
                key={gallery.id}
                id={gallery.slug}
                className="scroll-mt-28 rounded-[34px] border border-[#2c2218]/10 bg-[#f3ece3]/78 p-4 shadow-[0_30px_80px_rgba(44,34,24,0.08)] md:p-6"
              >
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.05em] text-[#2c2218] md:text-3xl">
                      {gallery.name}
                    </h2>
                  </div>

                  <span className="rounded-full border border-[#2c2218]/10 bg-[#ede3d8] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/54">
                    {gallery.itemCount} imagini
                  </span>
                </div>

                <LightGallery
                  elementClassNames="columns-2 gap-4 sm:columns-2 md:columns-3 xl:columns-4"
                  plugins={[lgZoom]}
                  speed={500}
                  counter
                  download={false}
                  selector=".gallery-lightbox-item"
                  mobileSettings={{
                    controls: gallery.items.length > 1,
                    showCloseIcon: true,
                    download: false,
                  }}
                >
                  {gallery.items.map((item) => {
                    const imageUrl = resolveAssetUrl(item.url);
                    const size = item.width && item.height ? `${item.width}-${item.height}` : undefined;

                    return (
                      <a
                        key={item.id}
                        href={imageUrl}
                        data-src={imageUrl}
                        data-lg-size={size}
                        className="gallery-lightbox-item mb-4 block cursor-zoom-in break-inside-avoid overflow-hidden rounded-[22px] bg-[#d8cdbf] shadow-[0_18px_44px_rgba(44,34,24,0.12)]"
                        aria-label={`Deschide preview pentru ${gallery.name}`}
                      >
                        <img
                          src={imageUrl}
                          alt={item.originalName}
                          className="h-auto w-full object-cover transition duration-500 hover:scale-[1.015]"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </a>
                    );
                  })}
                </LightGallery>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
