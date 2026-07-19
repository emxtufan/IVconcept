import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { getSiteContent, SERVICES } from '../data';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MENU_LINKS = [
  { label: 'Acasa', href: '#hero' },
  { label: 'Despre noi', href: '#despre' },
  { label: 'Galerie foto', href: '#gallery-section' },
  { label: 'Lucrari', href: '#lucrari' },
  { label: 'Pasii de colaborare', href: '#services' },
  { label: 'Proiecte pereti', href: '#proiecte' },
  { label: 'Cursuri', href: '#povestea' },
  { label: 'Reactii', href: '#recenzii' },
  { label: 'Contact', href: '#contact' },
];

export default function MenuDrawer({ isOpen, onClose }: MenuDrawerProps) {
  const footerContent = getSiteContent().footer;

  useEffect(() => {
    if (!isOpen) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.7 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[150] cursor-pointer bg-black"
          />

          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 200 }}
            className="fixed bottom-0 left-0 top-0 z-[160] flex w-full max-w-sm flex-col justify-between overflow-y-auto border-r border-white/10 bg-[#130a01] p-8"
            role="dialog"
            aria-modal="true"
            aria-label="Meniu"
          >
            <div>
              <div className="mb-10 flex items-center justify-between">
                <div>
                  <span className="block font-sans text-sm font-semibold uppercase tracking-wider text-white">
                    {footerContent.brandName}
                  </span>
                  <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {footerContent.descriptor}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:border-[#c5a880] hover:text-white"
                  aria-label="Inchide meniul"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <span className="mb-5 block text-[10px] font-sans font-bold uppercase tracking-[0.25em] text-[#c5a880]">
                [ MENIU ]
              </span>
              <nav className="flex flex-col gap-2.5">
                {MENU_LINKS.map((link, idx) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={onClose}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 + idx * 0.04, duration: 0.35, ease: 'easeOut' }}
                    className="group flex items-baseline gap-3"
                  >
                    <span className="w-6 font-mono text-[10px] tracking-widest text-[#c5a880]/60 transition-colors group-hover:text-[#c5a880]">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="font-display text-[22px] font-light tracking-tight text-white/80 transition-colors group-hover:text-[#c5a880]">
                      {link.label}
                    </span>
                  </motion.a>
                ))}
              </nav>
            </div>

            <div className="mt-10">
              <span className="mb-4 block text-[10px] uppercase tracking-widest text-white/40">
                Servicii disponibile
              </span>
              <ul className="mb-6 space-y-1.5">
                {SERVICES.map((srv, idx) => (
                  <li key={idx} className="text-xs text-white/55">
                    {srv}
                  </li>
                ))}
              </ul>

              <div className="space-y-0.5 border-t border-white/10 pt-5 text-xs text-white/55">
                <p>{footerContent.email}</p>
                <p>{footerContent.phone}</p>
              </div>

              <div className="mt-5 font-mono text-[10px] text-white/35">
                {footerContent.copyright}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
