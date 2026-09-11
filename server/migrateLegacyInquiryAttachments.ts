import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { supabaseAdmin } from './supabase.js';
import { copyLegacyInquiryObjectToPrivate, deleteR2Object, extractManagedObjectKeyFromUrl, buildPublicAssetUrl, isPrivateR2Configured } from './r2Storage.js';
import { isMediaAssetReferenced, registerPendingInquiryUploads } from './supabaseStore.js';
import { inquiryAttachmentUrl } from './uploadSecurity.js';

/** Explicit maintenance command. A dry run reads metadata but never changes data. */
export async function migrateLegacyInquiryAttachments(apply = false) {
  if (!supabaseAdmin) throw new Error('Configure Supabase admin access first.');
  if (apply && !isPrivateR2Configured()) throw new Error('Configure a separate private R2 bucket first.');
  const legacySources = new Set<string>();
  let reviewed = 0;
  let migrated = 0;
  let failed = 0;
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await supabaseAdmin.from('inquiries').select('id,images').order('id').range(offset, offset + 199);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const inquiry of data) {
      const images = Array.isArray(inquiry.images) ? inquiry.images as string[] : [];
      const candidates = images.map((url, index) => ({ index, key: extractManagedObjectKeyFromUrl(url) }))
        .filter((item): item is { index: number; key: string } => Boolean(item.key?.startsWith('uploads/inquiries/')));
      if (!candidates.length) continue;
      reviewed += candidates.length;
      if (!apply) continue;
      try {
        const replacements = candidates.map((candidate) => ({ ...candidate, destination: `inquiries/migrated-${inquiry.id}-${randomUUID()}` }));
        await registerPendingInquiryUploads(replacements.map((item) => item.destination));
        const nextImages = [...images];
        for (const item of replacements) {
          await copyLegacyInquiryObjectToPrivate(item.key, item.destination);
          nextImages[item.index] = inquiryAttachmentUrl(item.destination);
        }
        const { error: migrationError } = await supabaseAdmin.rpc('migrate_inquiry_attachments', {
          p_inquiry_id: inquiry.id, p_expected_images: images, p_next_images: nextImages,
          p_object_keys: replacements.map((item) => item.destination),
        });
        // Preserve every copy on an ambiguous commit result. Pending-upload cleanup
        // later removes only expired objects that have no attachment reference.
        if (migrationError) throw new Error(migrationError.message);
        replacements.forEach((item) => legacySources.add(item.key));
        migrated += replacements.length;
      } catch (error) {
        failed += candidates.length;
        console.error(`Inquiry ${inquiry.id} needs migration retry:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }
    if (data.length < 200) break;
  }
  if (apply) {
    // Wait until all rows have migrated, including rows sharing a legacy source.
    for (const key of legacySources) {
      if (!await isMediaAssetReferenced([buildPublicAssetUrl(key), `/${key}`])) await deleteR2Object(key);
    }
  }
  return { dryRun: !apply, reviewed, migrated, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help')) {
    console.log('Dry run: node --import tsx server/migrateLegacyInquiryAttachments.ts\nApply: node --import tsx server/migrateLegacyInquiryAttachments.ts --apply\nApply backend_security_migration.sql first; use a separate private bucket. Purge legacy /uploads/inquiries/* URLs from the public CDN cache after migration.');
  } else {
    migrateLegacyInquiryAttachments(process.argv.includes('--apply'))
      .then((result) => { console.log(JSON.stringify(result)); if (result.failed) process.exitCode = 1; })
      .catch((error) => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; });
  }
}
