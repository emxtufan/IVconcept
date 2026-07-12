import { normalizeSiteContent, type HeroShowReelContent, type SiteContent } from './types/siteContent';

let siteContent: SiteContent | null = null;

export let SERVICES: string[] = [];
export let DESCRIPTION = '';
export let TRUSTED_LABEL = '';
export let TRUSTED_AVATARS: string[] = [];
export let WELCOME_LABEL = '';
export let HERO_TITLE_LINE_1 = '';
export let HERO_TITLE_LINE_2 = '';
export let EXPLORE_SERVICES_TEXT = '';
export let SHOW_REEL_CONTENT: HeroShowReelContent = {
  label: '',
  location: '',
  type: '',
  videoUrl: '',
};
export let BRAND_LOCATION = '';

function syncExports(content: SiteContent) {
  SERVICES = content.hero.services;
  DESCRIPTION = content.hero.description;
  TRUSTED_LABEL = content.hero.trustedLabel;
  TRUSTED_AVATARS = content.hero.trustedAvatars;
  WELCOME_LABEL = content.hero.welcomeLabel;
  HERO_TITLE_LINE_1 = content.hero.titleLine1;
  HERO_TITLE_LINE_2 = content.hero.titleLine2;
  EXPLORE_SERVICES_TEXT = content.hero.exploreServicesText;
  SHOW_REEL_CONTENT = content.hero.showReel;
  BRAND_LOCATION = content.hero.showReel.location;
}

export function setSiteContent(content: SiteContent) {
  const normalized = normalizeSiteContent(content);
  siteContent = normalized;
  syncExports(normalized);
}

export function getSiteContent() {
  if (!siteContent) {
    throw new Error('Site content has not been loaded yet.');
  }

  return siteContent;
}

export async function loadSiteContent() {
  const response = await fetch('/api/site-content');

  if (!response.ok) {
    throw new Error(`Failed to load site content: ${response.status}`);
  }

  const content = (await response.json()) as SiteContent;
  setSiteContent(content);
  return content;
}
