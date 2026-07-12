import { useState, useRef, useEffect } from 'react';
import Lenis from 'lenis';
import { motion, useScroll, useTransform } from 'motion/react';
import Header from './components/Header';
import MenuDrawer from './components/MenuDrawer';
import ShowReel from './components/ShowReel';
import { StarsAndDescription, ServicesList } from './components/ServicesSection';
import { HeroTitle } from './components/HeroTitle';
import SplashCursor from './components/SplashCursor';
import ScrollReveal from './components/ScrollReveal';
import ServicesScrollSection from './components/ServicesScrollSection';
import IntroLogoSection from './components/IntroLogoSection';
import GallerySection from './components/gallery';
import GalleryWallPage from './components/GalleryWallPage';
import SelectedWorkSection from './components/SelectedWorkSection';
import CommitmentSection from './components/CommitmentSection';
import ProjectParallaxPanels from './components/ProjectParallaxPanels';
import PortfolioStorySection from './components/PortfolioStorySection';
import AppleWatchGridSection from './components/applewach';
import Footer from './components/footer';
import { getSiteContent } from './data';
import BlurText from './components/BlurText';
import FormSection from './components/formsection';

export default function App() {
  const isGalleryWallRoute = window.location.pathname === '/galerie-foto';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHoveringHero, setIsHoveringHero] = useState(false);
  const [isHeroVisible, setIsHeroVisible] = useState(true);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const headerLogoTargetRef = useRef<HTMLDivElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const lastScrollYRef = useRef(0);
  const headerVisibleRef = useRef(true);
  const about = getSiteContent().about;
  const logoSection = getSiteContent().logoSection;
  const commitment = getSiteContent().textSection;
  const introBrandName = getSiteContent().footer.brandName;
  const showIntroLogo = logoSection.logoUrl.trim().length > 0;

  const { scrollY } = useScroll();

  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.06,
      wheelMultiplier: 0.75,
      touchMultiplier: 1,
      overscroll: true,
      // Smooth-scroll in-page anchor links (e.g. the footer section links)
      anchors: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    const heroElement = heroRef.current;

    if (!heroElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroVisible(entry.isIntersecting);
      },
      {
        threshold: 0.01,
      },
    );

    observer.observe(heroElement);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    headerVisibleRef.current = isHeaderVisible;
  }, [isHeaderVisible]);

  useEffect(() => {
    if (isMenuOpen) {
      lastScrollYRef.current = window.scrollY;
      if (!headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setIsHeaderVisible(true);
      }
      return;
    }

    const threshold = 2;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 24) {
        if (!headerVisibleRef.current) {
          headerVisibleRef.current = true;
          setIsHeaderVisible(true);
        }
        lastScrollYRef.current = currentY;
        return;
      }

      if (delta > threshold && headerVisibleRef.current) {
        headerVisibleRef.current = false;
        setIsHeaderVisible(false);
      } else if (delta < -threshold && !headerVisibleRef.current) {
        headerVisibleRef.current = true;
        setIsHeaderVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isMenuOpen]);

  const heroY = useTransform(scrollY, (y) => {
    const heroStart = window.innerHeight || 1;
    const local = Math.max(0, y - heroStart);
    return Math.min(320, local * 0.32);
  });

  if (isGalleryWallRoute) {
    return <GalleryWallPage />;
  }

  return (
    <div
      id="app-container"
      className="min-h-screen bg-[#e8e0d6] text-[#2c2218] flex flex-col select-none relative overflow-x-clip grain-bg animate-fade-in"
    >
      <div className="grain-overlay" />

      <MenuDrawer isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

      <div className="relative bg-[#e8e0d6]">
        <div
          className={`fixed inset-x-0 top-0 z-[140] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
          }`}
        >
          <Header
            onMenuClick={() => setIsMenuOpen(true)}
            navbarLogoTargetRef={headerLogoTargetRef}
            logoUrl={showIntroLogo ? logoSection.logoUrl : undefined}
            logoAlt={logoSection.logoAlt}
            brandName={showIntroLogo ? undefined : introBrandName}
          />
        </div>

        <div
          ref={heroRef}
          id="hero"
          onMouseEnter={() => setIsHoveringHero(true)}
          onMouseLeave={() => setIsHoveringHero(false)}
          className="relative min-h-screen md:min-h-[860px] lg:min-h-[920px] xl:min-h-[980px] w-full overflow-hidden bg-[#e8e0d6] z-10 flex flex-col justify-between"
        >
          <SplashCursor
            DENSITY_DISSIPATION={1.5}
            VELOCITY_DISSIPATION={3}
            PRESSURE={0.55}
            CURL={2}
            SPLAT_RADIUS={0.27}
            SPLAT_FORCE={20000}
            COLOR_UPDATE_SPEED={19}
            SHADING
            RAINBOW_MODE={false}
            position="absolute"
            zIndex={1}
            isActive={isHeroVisible && isHoveringHero}
          />

          <motion.div
            style={{ y: heroY }}
            className="h-full w-full flex flex-col justify-between relative z-10"
          >
            <div className="h-[65px] shrink-0 md:h-[81px]" />

            <main
              id="desktop-layout"
              className="hidden md:flex flex-col flex-grow justify-between max-w-[1340px] w-full mx-auto px-12 lg:px-16 py-12 lg:py-16 relative z-10"
            >
              <div className="grid grid-cols-12 gap-10 lg:gap-14 items-end mt-4">
                <div className="col-span-5">
                  <ShowReel />
                </div>

                <div className="col-span-4 pb-1">
                  <StarsAndDescription />
                </div>

                <div className="col-span-3 pb-1">
                  <ServicesList />
                </div>
              </div>

              <div className="w-full my-10 lg:my-14 relative z-20">
                <div className="h-[1px] w-full bg-zinc-300" />
              </div>

              <div className="flex justify-between items-end gap-12 pb-4">
                <div>
                  <HeroTitle />
                </div>
              </div>
            </main>

            <main
              id="mobile-layout"
              className="flex md:hidden flex-col gap-10 px-6 py-8 flex-grow justify-between relative z-10"
            >
              <div className="mt-2">
                <HeroTitle />
              </div>

              <div className="mt-2">
                <StarsAndDescription />
              </div>

              <div className="mt-2 mb-4">
                <ShowReel />
              </div>
            </main>
          </motion.div>

          <IntroLogoSection
            logoUrl={showIntroLogo ? logoSection.logoUrl : undefined}
            logoAlt={logoSection.logoAlt}
            brandName={introBrandName}
            navbarLogoTargetRef={headerLogoTargetRef}
            heroRef={heroRef}
          />
        </div>
      </div>

      <section
        id="despre"
        className="relative z-40 -mb-12 md:-mb-16 bg-[#130a01] min-h-screen text-white flex flex-col justify-center py-24 md:py-32 px-6 md:px-16"
        style={{
          boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.6), 0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        <div className="max-w-[1140px] w-full mx-auto flex flex-col gap-12 md:gap-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
            <span className="text-[10px] md:text-xs text-zinc-400 tracking-[0.25em] font-sans font-bold uppercase">
              {about.eyebrow}
            </span>
            <span className="text-xs md:text-sm text-zinc-500 font-medium tracking-wide">
              {about.secondaryText}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-16 items-start">
            <div className="md:col-span-4">
              <h2 className="text-3xl md:text-5xl font-display font-light tracking-tight text-white leading-tight">
                <BlurText
                  text={`${about.titleLine1} ${about.titleLine2}`}
                  delay={200}
                  animateBy="words"
                  direction="top"
                  className=""
                />  <br className="hidden md:block" />
                
              </h2>
              <div className="h-1 w-12 bg-white mt-6 opacity-30" />
            </div>

            <div className="md:col-span-8 text-xl md:text-3xl font-light text-zinc-300 leading-relaxed tracking-wide font-sans">
              <ScrollReveal
                baseOpacity={0.1}
                enableBlur
                baseRotation={3}
                blurStrength={4}
              >
                {about.description}
              </ScrollReveal>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-zinc-600 font-mono tracking-widest uppercase mt-12 md:mt-24 border-t border-zinc-900 pt-8">
            <span>{about.footerLeft}</span>
            <span>{about.footerRight}</span>
          </div>
        </div>
      </section>

      <GallerySection />

      <CommitmentSection />

      <SelectedWorkSection />

      <ServicesScrollSection />   

      <ProjectParallaxPanels />

      <PortfolioStorySection />

      <AppleWatchGridSection />
      <FormSection />

      <Footer />
    </div>  
  );
}
