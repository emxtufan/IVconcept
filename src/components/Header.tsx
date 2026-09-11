import type { RefObject } from 'react';
import { useReducedMotion } from 'motion/react';

interface HeaderProps {
  onMenuClick: () => void;
  isMenuOpen?: boolean;
  navbarLogoTargetRef?: RefObject<HTMLDivElement | null>;
  logoUrl?: string;
  logoAlt?: string;
  brandName?: string;
}

export default function Header({
  onMenuClick,
  isMenuOpen = false,
  navbarLogoTargetRef,
  logoUrl,
  logoAlt = 'Brand logo',
  brandName,
}: HeaderProps) {
  const reducedMotion = useReducedMotion();
  const showDockLogo = Boolean((logoUrl && logoUrl.trim()) || (brandName && brandName.trim()));

  return (
    <header className="relative w-full bg-transparent">
      {showDockLogo && (
        <div
          ref={navbarLogoTargetRef}
          aria-hidden="true"
          className={`pointer-events-none absolute left-1/2 top-1/2 z-30 flex h-[30px] w-[160px] -translate-x-1/2 -translate-y-1/2 origin-center scale-[1.65] items-center justify-center ${reducedMotion ? 'opacity-100' : 'opacity-0'} md:h-[36px] md:w-[220px] md:scale-[1.9]`}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={logoAlt}
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-center font-sans text-[15px] font-bold uppercase tracking-[-0.04em] text-[#2c2218] md:text-[18px]">
              {brandName}
            </span>
          )}
        </div>
      )}

      <div className="relative z-20 flex w-full items-center px-6 py-5 md:px-12 md:py-6">
        <button
          id="menu-btn"
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-[#2c2218]/15 bg-[#e8e0d6]/90 text-[#2c2218] backdrop-blur-sm transition-opacity hover:opacity-75"
          aria-label="Deschide meniul"
          aria-haspopup="dialog"
          aria-expanded={isMenuOpen}
          aria-controls={isMenuOpen ? 'site-menu' : undefined}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}
