interface RenamedItem { id: number; filename: string }

export interface GalleryRenameOperations {
  copy: (sourceKey: string, destinationKey: string) => Promise<unknown>;
  commit: (galleryId: number, name: string, slug: string, previousSlug: string, items: Array<{ id: number; url: string }>) => Promise<unknown>;
  remove: (objectKey: string) => Promise<unknown>;
  objectKey: (slug: string, filename: string) => string;
  assetUrl: (objectKey: string) => string;
  reportCleanupFailure: (objectKeys: string[]) => void;
}

/** The database transaction is the commit point. Never roll back its live files. */
export async function renameGallerySafely(
  gallery: { id: number; slug: string; items: RenamedItem[] },
  name: string,
  nextSlug: string,
  operations: GalleryRenameOperations,
) {
  const slugChanged = gallery.slug !== nextSlug;
  if (slugChanged) {
    for (const item of gallery.items) {
      const destination = operations.objectKey(nextSlug, item.filename);
      // Keep copies on failure. A concurrent rename to this same slug may already
      // have committed them, even if this operation has not reached its commit.
      await operations.copy(operations.objectKey(gallery.slug, item.filename), destination);
    }
  }

  // An error/timeout during commit has an ambiguous outcome. Keep the copied files:
  // the transaction may already be committed even though its response was lost.
  await operations.commit(gallery.id, name, nextSlug, gallery.slug, gallery.items.map((item) => ({
    id: item.id,
    url: operations.assetUrl(operations.objectKey(nextSlug, item.filename)),
  })));

  if (slugChanged) {
    const oldKeys = gallery.items.map((item) => operations.objectKey(gallery.slug, item.filename));
    const results = await Promise.allSettled(oldKeys.map((key) => operations.remove(key)));
    const failedKeys = oldKeys.filter((_key, index) => results[index].status === 'rejected');
    if (failedKeys.length) operations.reportCleanupFailure(failedKeys);
  }
}
