import 'dotenv/config';
import seedContent from '../supabase/siteContent.seed.json';
import { normalizeSiteContent, type SiteContent } from '../src/types/siteContent';
import { hasSupabaseAdminAccess } from '../server/supabase';
import { saveMainSiteContent } from '../server/supabaseStore';

async function main() {
  if (!hasSupabaseAdminAccess()) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to seed Supabase data.');
  }

  await saveMainSiteContent(normalizeSiteContent(seedContent as SiteContent));
  console.log('Supabase seed completed for site content.');
}

main().catch((error) => {
  console.error('Failed to seed Supabase:', error);
  process.exitCode = 1;
});
