import { getSiteContent } from '../data';
import BlurText from './BlurText';
import ShinyText from './ShinyText';
import SplitText from "./SplitText";

export default function PortfolioStorySection() {
  const content = getSiteContent().videoCardSection;
  const logoUrl = getSiteContent().logoSection.logoUrl;

  return (
    <section id="povestea" className="relative z-40 border-t border-white/10 bg-[#130a01] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-20 md:px-12 md:py-24 xl:px-16 xl:py-28">
        <div className="grid gap-10 md:grid-cols-[220px_minmax(0,1fr)] md:gap-16 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="pt-2 md:pt-4">
            <span className="block font-sans text-[12px] font-semibold uppercase tracking-[0.08em] text-white/82">
              {content.eyebrow}
            </span>
          </div>

          <div className="max-w-[1180px]">
            <h2 className="font-sans text-[18px] font-semibold leading-[0.96] tracking-[-0.055em] text-white/96 sm:text-[20px] md:text-[22px] lg:text-[24px] xl:text-[26px]">
              <ShinyText
                  text={content.quote}
                  speed={2}
                  delay={0}
                  color="#b5b5b5"
                  shineColor="#ffffff"
                  spread={120}
                  direction="left"
                  yoyo={true}
                  pauseOnHover={false}
                  disabled={false}
                />
            </h2>

            <div className="mt-10 flex items-center gap-4 md:mt-12">
              <div className="h-14 w-14 overflow-hidden rounded-[100%] border border-white/35 sm:h-16 sm:w-16">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="font-sans text-[15px] font-semibold uppercase tracking-[-0.02em] text-white">
                  <BlurText text={content.brandName} />
                </div>
                <div className="mt-1 font-sans text-[12px] font-medium uppercase tracking-[0.02em] text-white/72 sm:text-[13px]">
                  <BlurText text={content.brandRole} />

                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 border-t border-white/10 pt-14 md:mt-24 md:pt-20">
          <div className="grid gap-12 md:grid-cols-[220px_minmax(0,1fr)] md:gap-16 xl:grid-cols-[280px_minmax(0,1fr)]">
           <div className="hidden sm:flex items-start">
              <span className="font-sans text-[56px] font-semibold leading-none tracking-[-0.2em] text-white/96 sm:text-[68px]">
                ///
              </span>
            </div>

            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,610px)_minmax(320px,1fr)] lg:gap-12 xl:grid-cols-[minmax(0,610px)_460px] xl:gap-16">
              <div className="max-w-[610px]">
                <h3 className="font-sans text-[42px] font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-[48px] md:text-[56px]">
                  
                   <SplitText
                      text={content.storyTitle}
                      className=""
                      delay={50}
                      duration={1.25}
                      ease="power3.out"
                      splitType="chars"
                      from={{ opacity: 0, y: 40 }}
                      to={{ opacity: 1, y: 0 }}
                      threshold={0.1}
                      rootMargin="-100px"
                      textAlign="left"
                    />
                </h3>

                <p className="mt-10 font-sans text-[23px] font-normal leading-[1.22] tracking-[-0.035em] text-white/94 sm:text-[26px] md:mt-12 md:text-[30px]">
                  {content.paragraphOne}
                </p>

                <p className="mt-8 font-sans text-[23px] font-normal leading-[1.22] tracking-[-0.035em] text-white/94 sm:text-[26px] md:text-[30px]">
                  {content.paragraphTwo}
                </p>

                <button
                  type="button"
                  className="mt-12 flex w-full max-w-[320px] items-center justify-between border-t border-white/22 pt-5 text-left font-sans text-[15px] font-semibold uppercase tracking-[0.02em] text-white/95"
                >
                  <span>{content.buttonText}</span>
                  <span aria-hidden className="text-[28px] leading-none">
                    &rarr;
                  </span>
                </button>
              </div>

              <div className="w-full max-w-[460px] justify-self-start lg:justify-self-end">
                <div className="group relative aspect-square w-full overflow-hidden border border-white/16 bg-[#050505]">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="absolute inset-0 h-full w-full object-cover opacity-88 transition-transform duration-700 group-hover:scale-[1.02]"
                  >
                    <source src={content.videoUrl} type="video/mp4" />
                  </video>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.14)_0%,rgba(0,0,0,0.05)_38%,rgba(0,0,0,0.34)_100%)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
