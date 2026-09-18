export interface HeroShowReelContent {
  label: string;
  location: string;
  type: string;
  videoUrl: string;
}

export interface HeroContent {
  backgroundImage: string;
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

export interface SocialLink {
  label: string;
  url: string;
}

export interface CourseOfferContent {
  enabled: boolean;
  title: string;
  description: string;
  imageUrl: string;
  mobileImageUrl: string;
  buttonText: string;
  pageButtonText: string;
  successMessage: string;
}

export const DEFAULT_COURSE_OFFER: CourseOfferContent = {
  enabled: true,
  title: 'Înscrie-te la cursul IV Concept',
  description: 'Descoperă tehnicile din spatele finisajelor decorative IV Concept. Completează datele de contact pentru înscriere și te vom contacta cu oferta și detaliile cursului.',
  imageUrl: 'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?auto=format&fit=crop&w=1000&q=80',
  mobileImageUrl: '',
  buttonText: 'Mă înscriu la curs',
  pageButtonText: 'Vezi cursul',
  successMessage: 'Înscrierea ta a fost înregistrată. Te vom contacta pe email cu oferta și detaliile cursului.',
};

export function normalizeCourseOffer(content?: Partial<CourseOfferContent>): CourseOfferContent {
  return {
    enabled: typeof content?.enabled === 'boolean' ? content.enabled : DEFAULT_COURSE_OFFER.enabled,
    title: typeof content?.title === 'string' ? content.title : DEFAULT_COURSE_OFFER.title,
    description: typeof content?.description === 'string' ? content.description : DEFAULT_COURSE_OFFER.description,
    imageUrl: typeof content?.imageUrl === 'string' && content.imageUrl.trim() ? content.imageUrl : DEFAULT_COURSE_OFFER.imageUrl,
    mobileImageUrl: typeof content?.mobileImageUrl === 'string' ? content.mobileImageUrl.trim() : '',
    buttonText: typeof content?.buttonText === 'string' ? content.buttonText : DEFAULT_COURSE_OFFER.buttonText,
    pageButtonText: typeof content?.pageButtonText === 'string' ? content.pageButtonText : DEFAULT_COURSE_OFFER.pageButtonText,
    successMessage: typeof content?.successMessage === 'string' ? content.successMessage : DEFAULT_COURSE_OFFER.successMessage,
  };
}

export interface CoursePageContent {
  title: string;
  description: string;
  formTitle: string;
}

export const DEFAULT_COURSE_PAGE: CoursePageContent = {
  title: 'Cursul IV Concept de finisaje decorative',
  description: 'Descoperă tehnicile din spatele finisajelor decorative IV Concept. Completează datele de contact pentru înscriere și te vom contacta cu oferta și detaliile cursului.',
  formTitle: 'Înscrie-te la curs',
};

export function normalizeCoursePage(content?: Partial<CoursePageContent>): CoursePageContent {
  const text = (key: keyof CoursePageContent) =>
    typeof content?.[key] === 'string' ? (content[key] as string) : DEFAULT_COURSE_PAGE[key];

  return {
    title: text('title'),
    description: text('description'),
    formTitle: text('formTitle'),
  };
}

export interface LegalContent {
  legalEntityName: string;
  registrationNumber: string;
  address: string;
  contactEmail: string;
  retentionPeriod: string;
  lastUpdated: string;
  googleAnalyticsId: string;
  metaPixelId: string;
}

export const DEFAULT_LEGAL: LegalContent = {
  // Left empty on purpose: the operator has to be identified with its real
  // registered details, so the page falls back to the brand name until then.
  legalEntityName: '',
  registrationNumber: '',
  address: '',
  contactEmail: '',
  retentionPeriod: 'Păstrăm datele cât timp sunt necesare scopului pentru care le-ai transmis, apoi le ștergem. Poți cere ștergerea oricând.',
  lastUpdated: '',
  googleAnalyticsId: '',
  metaPixelId: '',
};

export function normalizeLegalContent(content?: Partial<LegalContent>): LegalContent {
  const text = (key: keyof LegalContent) =>
    typeof content?.[key] === 'string' ? (content[key] as string).trim() : DEFAULT_LEGAL[key];

  return {
    legalEntityName: text('legalEntityName'),
    registrationNumber: text('registrationNumber'),
    address: text('address'),
    contactEmail: text('contactEmail'),
    retentionPeriod: text('retentionPeriod') || DEFAULT_LEGAL.retentionPeriod,
    lastUpdated: text('lastUpdated'),
    googleAnalyticsId: text('googleAnalyticsId'),
    metaPixelId: text('metaPixelId'),
  };
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
  socialLinks: SocialLink[];
  imageUrl: string;
  copyright: string;
  craftedText: string;
  developerCreditText: string;
  developerCreditUrl: string;
  privacyPolicyText: string;
  termsText: string;
  wordmark: string;
}

export interface SiteContent {
  courseOffer: CourseOfferContent;
  coursePage: CoursePageContent;
  legal: LegalContent;
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
    backgroundImage: content.backgroundImage ?? '',
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

function normalizeReviewItem(item: ReviewItem): ReviewItem {
  const mediaType = item.mediaType === 'video' ? 'video' : 'image';
  const thumbnail = item.thumbnail ?? '';
  const mediaUrl = item.mediaUrl ?? '';
  const poster = item.poster ?? '';

  const normalizedThumbnail =
    mediaType === 'video'
      ? thumbnail || poster
      : thumbnail || mediaUrl;

  const normalizedMediaUrl =
    mediaType === 'video'
      ? mediaUrl
      : mediaUrl || thumbnail;

  const normalizedPoster =
    mediaType === 'video'
      ? poster || thumbnail
      : poster;

  return {
    id: item.id ?? '',
    title: item.title ?? '',
    category: item.category ?? '',
    description: item.description ?? '',
    thumbnail: normalizedThumbnail,
    mediaType,
    mediaUrl: normalizedMediaUrl,
    poster: normalizedPoster || undefined,
  };
}

export function normalizeReviewsSectionContent(content: ReviewsSectionContent): ReviewsSectionContent {
  return {
    eyebrow: content.eyebrow ?? '',
    titleLine1: content.titleLine1 ?? '',
    titleLine2: content.titleLine2 ?? '',
    description: content.description ?? '',
    hints: {
      mobileOpen: content.hints?.mobileOpen ?? '',
      mobileDrag: content.hints?.mobileDrag ?? '',
      desktopOpen: content.hints?.desktopOpen ?? '',
      desktopDrag: content.hints?.desktopDrag ?? '',
      scroll: content.hints?.scroll ?? '',
    },
    items: (content.items ?? []).map((item) => normalizeReviewItem(item)),
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

export function normalizeFooterContent(content: FooterContent): FooterContent {
  const rawLinks = Array.isArray(content.socialLinks) ? content.socialLinks : [];
  return {
    ...content,
    developerCreditText: content.developerCreditText ?? 'Website creat și întreținut de ESA-Coder Solutions',
    developerCreditUrl: content.developerCreditUrl ?? 'https://esa-coder.com',
    socialLinks: rawLinks.map((link) => {
      if (typeof link === 'string') {
        return { label: link, url: '' };
      }
      return {
        label: typeof link?.label === 'string' ? link.label : '',
        url: typeof link?.url === 'string' ? link.url : '',
      };
    }),
  };
}

export function normalizeSiteContent(content: SiteContent): SiteContent {
  return {
    ...content,
    courseOffer: normalizeCourseOffer(content.courseOffer),
    coursePage: normalizeCoursePage(content.coursePage),
    legal: normalizeLegalContent(content.legal),
    hero: normalizeHeroContent(content.hero),
    logoSection: normalizeLogoSectionContent(content.logoSection, content.textSection),
    slidersSection: normalizeSlidersSectionContent(content.slidersSection),
    textSection: normalizeTextSectionContent(content.textSection),
    reviews: normalizeReviewsSectionContent(content.reviews),
    footer: normalizeFooterContent(content.footer),
  };
}
