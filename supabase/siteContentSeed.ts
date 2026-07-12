import { readFileSync } from 'node:fs';
import type { SiteContent } from '../src/types/siteContent.js';

const seedContentUrl = new URL('./siteContent.seed.json', import.meta.url);
const seedContent = JSON.parse(readFileSync(seedContentUrl, 'utf8')) as SiteContent;

export default seedContent;
