import { motion } from 'motion/react';
import { DESCRIPTION, EXPLORE_SERVICES_TEXT, SERVICES, TRUSTED_AVATARS, TRUSTED_LABEL } from '../data';

export function StarsAndDescription() {
  return (
    <div className="relative z-20 flex w-full flex-col items-start gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="mb-1 flex h-11 items-center">
          <div className="flex -space-x-[10px]">
            {TRUSTED_AVATARS.map((avatar, index) => (
              <div
                key={avatar}
                className="relative h-8 w-8 overflow-hidden rounded-[10px] ring-2 ring-[#fafafa]"
                style={{ zIndex: TRUSTED_AVATARS.length - index }}
              >
                <img
                  src={avatar}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ))}
          </div>
        </div>
        <div className="select-none font-serif text-xs tracking-[0.2em] text-[#2c2218]">
          {String.fromCharCode(9733).repeat(5)}
        </div>
        <span className="font-sans text-[9.5px] font-bold uppercase tracking-[0.16em] text-[#2c2218]/80">
          {TRUSTED_LABEL}
        </span>
      </div>

      <p className="mt-2 max-w-[380px] font-sans text-[15.5px] leading-relaxed tracking-wide text-[#2c2218]">
        {DESCRIPTION}
      </p>

      <div className="mt-6 w-full max-w-[380px]">
        <div className="h-[1px] w-full bg-zinc-300" />

        <motion.a
          href="#services"
          className="group flex cursor-pointer items-center justify-between py-4 text-[#2c2218] transition-opacity hover:opacity-80"
        >
          <span className="font-sans text-[11px] font-bold tracking-[0.18em]">
            {EXPLORE_SERVICES_TEXT}
          </span>
          <motion.span
            variants={{
              initial: { x: 0 },
              hover: { x: 4 },
            }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            initial="initial"
            whileHover="hover"
            className="flex items-center"
          >
            <svg
              className="h-4 w-4 text-[#2c2218]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </motion.span>
        </motion.a>
      </div>
    </div>
  );
}

export function ServicesList() {
  return (
    <div className="relative z-20 flex h-full w-full select-none flex-col items-end justify-end text-right">
      <ul className="space-y-2">
        {SERVICES.map((service, index) => (
          <li
            key={index}
            className="cursor-pointer font-sans text-[13.5px] font-medium tracking-[0.05em] text-[#2c2218] transition-opacity duration-300 hover:opacity-75"
          >
            {service}
          </li>
        ))}
      </ul>
    </div>
  );
}
