export interface HeroShowReelContent {
  label: string;
  location: string;
  type: string;
  videoUrl: string;
}

export interface HeroContent {
  welcomeLabel: string;
  titleLine1: string;
  titleLine2: string;
  trustedLabel: string;
  trustedAvatars: string[];
  description: string;
  exploreServicesText: string;
  services: string[];
  showReel: HeroShowReelContent;
}

export interface AboutContent {
  eyebrow: string;
  secondaryText: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  footerLeft: string;
  footerRight: string;
}

export interface CollageImage {
  url: string;
  label: string;
  dimensions: string;
  aspectClass: string;
  heightClass: string;
}

export interface CollageColumn {
  id: number;
  images: CollageImage[];
}

export interface ImageSectionContent {
  columns: CollageColumn[];
}

export interface LogoSectionContent {
  logoUrl: string;
  logoAlt: string;
}

export interface TextSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  descriptionLine1: string;
  descriptionLine2: string;
  useLogoInsteadOfText: boolean;
  logoUrl: string;
  logoAlt: string;
}

export interface CardSpecLabels {
  finish: string;
  mirror: string;
  area: string;
  dimensions: string;
  time: string;
  status: string;
  statusValue: string;
}

export interface SelectedWorkProject {
  id: string;
  title: string;
  location: string;
  type: string;
  finish: string;
  mirror: string;
  area: string;
  length: string;
  width: string;
  time: string;
  description: string;
  image: string;
}

export interface CardsSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  linkText: string;
  specLabels: CardSpecLabels;
  projects: SelectedWorkProject[];
}

export interface SliderPanel {
  id: number;
  indexLabel: string;
  category: string;
  title: string;
  description: string;
  image: string;
  desktopImage: string;
  mobileImage: string;
}

export interface SlidersSectionContent {
  panels: SliderPanel[];
}

export interface VideoCardSectionContent {
  eyebrow: string;
  quote: string;
  brandName: string;
  brandRole: string;
  storyTitle: string;
  paragraphOne: string;
  paragraphTwo: string;
  buttonText: string;
  videoUrl: string;
}

export interface ReviewHints {
  mobileOpen: string;
  mobileDrag: string;
  desktopOpen: string;
  desktopDrag: string;
  scroll: string;
}

export interface ReviewItem {
  id: string;
  title: string;
  category: string;
  description: string;
  thumbnail: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  poster?: string;
}

export interface ReviewsSectionContent {
  eyebrow: string;
  titleLine1: string;
  titleLine2: string;
  description: string;
  hints: ReviewHints;
  items: ReviewItem[];
}

export interface FooterContent {
  brandName: string;
  descriptor: string;
  address: string;
  email: string;
  phone: string;
  studioLabel: string;
  studioLinks: string[];
  projectsLabel: string;
  projectLinks: string[];
  newsletterLine1: string;
  newsletterLine2: string;
  newsletterLine3: string;
  newsletterPlaceholder: string;
  newsletterButtonText: string;
  newsletterDescription: string;
  socialLinks: string[];
  imageUrl: string;
  copyright: string;
  craftedText: string;
  privacyPolicyText: string;
  termsText: string;
  wordmark: string;
}

export interface SiteContent {
  hero: HeroContent;
  about: AboutContent;
  imageSection: ImageSectionContent;
  logoSection: LogoSectionContent;
  textSection: TextSectionContent;
  cardsSection: CardsSectionContent;
  slidersSection: SlidersSectionContent;
  videoCardSection: VideoCardSectionContent;
  reviews: ReviewsSectionContent;
  footer: FooterContent;
}

export const DEFAULT_TRUSTED_AVATARS = [
  'https://framerusercontent.com/images/ARmQOa71EvidN3oYWq9jWzn9OE.jpg?width=76&height=76',
  'https://framerusercontent.com/images/W7oQ4BScxWhGC5oVOzKGxVGAD4.jpg?width=76&height=76',
  'https://framerusercontent.com/images/UqrSyX3j0KDY0YY2JZCQuc7Wzzg.jpg?width=76&height=76',
  'https://framerusercontent.com/images/wFJgmAuVHn37SCJR5MDBtfbFdY.jpg?width=76&height=76',
  'https://framerusercontent.com/images/K6cUNifhQFa6qEX3kqNwfqMkiY.jpg?width=128&height=128',
];

export function normalizeHeroContent(content: HeroContent): HeroContent {
  return {
    welcomeLabel: content.welcomeLabel ?? '',
    titleLine1: content.titleLine1 ?? '',
    titleLine2: content.titleLine2 ?? '',
    trustedLabel: content.trustedLabel ?? '',
    trustedAvatars: Array.isArray(content.trustedAvatars)
      ? content.trustedAvatars.filter((item): item is string => typeof item === 'string')
      : [...DEFAULT_TRUSTED_AVATARS],
    description: content.description ?? '',
    exploreServicesText: content.exploreServicesText ?? '',
    services: Array.isArray(content.services)
      ? content.services.filter((item): item is string => typeof item === 'string')
      : [],
    showReel: {
      label: content.showReel?.label ?? '',
      location: content.showReel?.location ?? '',
      type: content.showReel?.type ?? '',
      videoUrl: content.showReel?.videoUrl ?? '',
    },
  };
}

export function normalizeLogoSectionContent(
  content: LogoSectionContent | undefined,
  legacyTextSection?: TextSectionContent,
): LogoSectionContent {
  const legacyLogoUrl =
    legacyTextSection?.useLogoInsteadOfText && legacyTextSection.logoUrl
      ? legacyTextSection.logoUrl
      : '';

  return {
    logoUrl: content?.logoUrl ?? legacyLogoUrl,
    logoAlt: content?.logoAlt ?? legacyTextSection?.logoAlt ?? 'Brand logo',
  };
}

export function normalizeTextSectionContent(content: TextSectionContent): TextSectionContent {
  return {
    eyebrow: content.eyebrow ?? '',
    titleLine1: content.titleLine1 ?? '',
    titleLine2: content.titleLine2 ?? '',
    descriptionLine1: content.descriptionLine1 ?? '',
    descriptionLine2: content.descriptionLine2 ?? '',
    useLogoInsteadOfText: content.useLogoInsteadOfText ?? false,
    logoUrl: content.logoUrl ?? '',
    logoAlt: content.logoAlt ?? '',
  };
}

export function normalizeSlidersSectionContent(content: SlidersSectionContent): SlidersSectionContent {
  return {
    panels: (content.panels ?? []).map((panel) => ({
      ...panel,
      image: panel.image ?? '',
      desktopImage: panel.desktopImage ?? panel.image ?? '',
      mobileImage: panel.mobileImage ?? panel.image ?? panel.desktopImage ?? '',
    })),
  };
}

export function normalizeSiteContent(content: SiteContent): SiteContent {
  return {
    ...content,
    hero: normalizeHeroContent(content.hero),
    logoSection: normalizeLogoSectionContent(content.logoSection, content.textSection),
    slidersSection: normalizeSlidersSectionContent(content.slidersSection),
    textSection: normalizeTextSectionContent(content.textSection),
  };
}
