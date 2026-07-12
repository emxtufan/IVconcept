import { HERO_TITLE_LINE_1, HERO_TITLE_LINE_2, WELCOME_LABEL } from '../data';

export function HeroTitle() {
  return (
    <div className="flex flex-col items-start gap-3.5 select-none relative z-20">
      {/* Subtitle / Bracket Label */}
      <span className="text-[#2c2218]/80 font-sans tracking-[0.16em] text-[10.5px] font-bold uppercase">
        {WELCOME_LABEL}
      </span>

      {/* Main Large Heading */}
      <h1 className="text-[#2c2218] font-sans font-bold tracking-[-0.035em] leading-[0.92] text-[40px] sm:text-[54px] md:text-[68px] lg:text-[84px] xl:text-[96px] uppercase">
        {HERO_TITLE_LINE_1}
        <br />
        {HERO_TITLE_LINE_2}
      </h1>
    </div>
  );
}
