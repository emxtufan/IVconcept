import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { getGalleryFolderPath, slugifyGalleryName, type GalleryRecord } from '../types/galleries';
import { uploadFilesWithProgress } from './uploadClient';

function resolveAssetUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (typeof window === 'undefined') {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGalleryDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString('ro-RO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function GalleryModal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[760px] overflow-hidden rounded-[30px] border border-[#2c2218]/10 bg-[#f5ede2] shadow-[0_30px_120px_rgba(44,34,24,0.16)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#2c2218]/10 px-5 py-5 md:px-6">
          <div>
            <h3 className="text-xl font-semibold tracking-[-0.05em] text-[#2c2218]">{title}</h3>
            {description ? (
              <p className="mt-2 max-w-[520px] text-sm leading-relaxed text-[#2c2218]/58">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2c2218]/10 text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
          >
            x
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-5 md:px-6">{children}</div>
      </div>
    </div>
  );
}

export default function GalleriesPanel() {
  const [galleries, setGalleries] = useState<GalleryRecord[] | null>(null);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expandedGalleryId, setExpandedGalleryId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createState, setCreateState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [createError, setCreateError] = useState('');

  const [renameGallery, setRenameGallery] = useState<GalleryRecord | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renameState, setRenameState] = useState<'idle' | 'saving' | 'error'>('idle');
  const [renameError, setRenameError] = useState('');

  const [uploadGallery, setUploadGallery] = useState<GalleryRecord | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [deletingGalleryId, setDeletingGalleryId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError('');

    fetch('/api/galleries')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load galleries: ${response.status}`);
        }

        return (await response.json()) as GalleryRecord[];
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        setGalleries(data);
        setExpandedGalleryId((current) => {
          if (current && data.some((gallery) => gallery.id === current)) {
            return current;
          }

          return data[0]?.id ?? null;
        });
      })
      .catch((loadError) => {
        console.error(loadError);
        if (!cancelled) {
          setGalleries([]);
          setError('Could not load the separate gallery library.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const totalImages = useMemo(
    () => (galleries ?? []).reduce((sum, gallery) => sum + gallery.itemCount, 0),
    [galleries],
  );

  const createSlugPreview = slugifyGalleryName(createName.trim()) || 'galerie';
  const renameSlugPreview = slugifyGalleryName(renameName.trim()) || 'galerie';

  const closeCreateModal = () => {
    if (createState === 'saving') {
      return;
    }

    setCreateOpen(false);
    setCreateName('');
    setCreateState('idle');
    setCreateError('');
  };

  const closeRenameModal = () => {
    if (renameState === 'saving') {
      return;
    }

    setRenameGallery(null);
    setRenameName('');
    setRenameState('idle');
    setRenameError('');
  };

  const closeUploadModal = () => {
    if (uploadState === 'uploading') {
      return;
    }

    setUploadGallery(null);
    setUploadFiles([]);
    setUploadState('idle');
    setUploadProgress(0);
    setUploadError('');
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  const handleCreateGallery = async () => {
    if (!createName.trim() || createState === 'saving') {
      return;
    }

    try {
      setCreateState('saving');
      setCreateError('');
      setStatusMessage('');

      const response = await fetch('/api/galleries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createName.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Failed to create gallery: ${response.status}`);
      }

      const gallery = (await response.json()) as GalleryRecord;

      setGalleries((current) => ([...(current ?? []), gallery]));
      setExpandedGalleryId(gallery.id);
      setStatusMessage(`Gallery "${gallery.name}" was created with its own storage prefix ${gallery.folderPath}.`);
      closeCreateModal();
    } catch (createGalleryError) {
      console.error(createGalleryError);
      setCreateState('error');
      setCreateError(
        createGalleryError instanceof Error ? createGalleryError.message : 'Failed to create gallery.',
      );
    }
  };

  const openRenameModal = (gallery: GalleryRecord) => {
    setRenameGallery(gallery);
    setRenameName(gallery.name);
    setRenameState('idle');
    setRenameError('');
  };

  const handleRenameGallery = async () => {
    if (!renameGallery || !renameName.trim() || renameState === 'saving') {
      return;
    }

    try {
      setRenameState('saving');
      setRenameError('');
      setStatusMessage('');

      const response = await fetch(`/api/galleries/${renameGallery.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: renameName.trim(),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Failed to rename gallery: ${response.status}`);
      }

      const gallery = (await response.json()) as GalleryRecord;

      setGalleries((current) =>
        (current ?? []).map((item) => (item.id === gallery.id ? gallery : item)),
      );
      setStatusMessage(`Gallery renamed to "${gallery.name}". Files now live under ${gallery.folderPath}.`);
      closeRenameModal();
    } catch (renameGalleryError) {
      console.error(renameGalleryError);
      setRenameState('error');
      setRenameError(
        renameGalleryError instanceof Error ? renameGalleryError.message : 'Failed to rename gallery.',
      );
    }
  };

  const handleDeleteGallery = async (gallery: GalleryRecord) => {
    if (!window.confirm(`Delete gallery "${gallery.name}" and all its uploaded images?`)) {
      return;
    }

    try {
      setDeletingGalleryId(gallery.id);
      setError('');
      setStatusMessage('');

      const response = await fetch(`/api/galleries/${gallery.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Failed to delete gallery: ${response.status}`);
      }

      setGalleries((current) => {
        const next = (current ?? []).filter((item) => item.id !== gallery.id);
        setExpandedGalleryId((expanded) => (expanded === gallery.id ? next[0]?.id ?? null : expanded));
        return next;
      });
      setStatusMessage(`Gallery "${gallery.name}" and its stored assets were removed.`);
    } catch (deleteGalleryError) {
      console.error(deleteGalleryError);
      setError(
        deleteGalleryError instanceof Error ? deleteGalleryError.message : 'Failed to delete gallery.',
      );
    } finally {
      setDeletingGalleryId(null);
    }
  };

  const handleDeleteItem = async (galleryId: number, itemId: number) => {
    if (!window.confirm('Delete this image from the gallery storage?')) {
      return;
    }

    try {
      setDeletingItemId(itemId);
      setError('');
      setStatusMessage('');

      const response = await fetch(`/api/galleries/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Failed to delete item: ${response.status}`);
      }

      setGalleries((current) =>
        (current ?? []).map((gallery) =>
          gallery.id === galleryId
            ? {
                ...gallery,
                itemCount: Math.max(0, gallery.itemCount - 1),
                items: gallery.items.filter((item) => item.id !== itemId),
              }
            : gallery,
        ),
      );
      setStatusMessage('The image was removed from the gallery storage.');
    } catch (deleteItemError) {
      console.error(deleteItemError);
      setError(deleteItemError instanceof Error ? deleteItemError.message : 'Failed to delete image.');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleUploadFiles = async () => {
    if (!uploadGallery || uploadFiles.length === 0 || uploadState === 'uploading') {
      return;
    }

    try {
      setUploadState('uploading');
      setUploadError('');
      setUploadProgress(0);
      setStatusMessage('');

      await uploadFilesWithProgress(
        uploadFiles,
        setUploadProgress,
        `/api/galleries/${uploadGallery.id}/upload`,
      );

      setUploadProgress(100);
      setStatusMessage(
        `${uploadFiles.length} image${uploadFiles.length === 1 ? '' : 's'} uploaded to ${uploadGallery.folderPath}.`,
      );
      closeUploadModal();
      setReloadKey((current) => current + 1);
    } catch (uploadGalleryError) {
      console.error(uploadGalleryError);
      setUploadState('error');
      setUploadError(
        uploadGalleryError instanceof Error ? uploadGalleryError.message : 'Failed to upload images.',
      );
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[28px] border border-[#2c2218]/10 bg-[#f5ede2] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.04em] text-[#2c2218]">Separate Photo Galleries</h3>
          <p className="mt-2 max-w-[700px] text-sm leading-relaxed text-[#2c2218]/48">
            Create independent galleries like Pereti, Oglinzi or Lampi. Each gallery gets its own Cloudflare R2 storage prefix and does not reuse the homepage feed images.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
              {(galleries ?? []).length} galleries
            </span>
            <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
              {totalImages} images
            </span>
            <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
              Storage: Cloudflare R2
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setCreateState('idle');
              setCreateError('');
            }}
            className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218]"
          >
            Create Gallery
          </button>
          <button
            type="button"
            onClick={() => setReloadKey((current) => current + 1)}
            className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
          >
            Reload
          </button>
        </div>
      </div>

      {statusMessage ? (
        <div className="rounded-[24px] border border-[#c5a880]/16 bg-[#f3e7d8] px-4 py-3 text-sm text-[#7a5b3e]">
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[24px] border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
          {error}
        </div>
      ) : null}

      {galleries === null ? (
        <div className="rounded-[28px] border border-[#2c2218]/10 bg-[#fbf6f0] px-6 py-12 text-center text-sm text-[#2c2218]/55">
          Loading galleries...
        </div>
      ) : galleries.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#2c2218]/12 bg-[#fbf6f0] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#2c2218]">No separate galleries yet</p>
          <p className="mt-2 text-sm text-[#2c2218]/42">
            Create the first gallery and then upload images into its own dedicated storage space.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {galleries.map((gallery) => {
            const expanded = expandedGalleryId === gallery.id;

            return (
              <article
                key={gallery.id}
                className="overflow-hidden rounded-[28px] border border-[#2c2218]/10 bg-[#fbf6f0]"
              >
                <div className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-start md:justify-between">
                  <button
                    type="button"
                    onClick={() => setExpandedGalleryId((current) => (current === gallery.id ? null : gallery.id))}
                    className="min-w-0 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold tracking-[-0.04em] text-[#2c2218]">{gallery.name}</h3>
                      <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/40">
                        {gallery.itemCount} images
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#2c2218]/38">{gallery.folderPath}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#2c2218]/28">
                      Updated {formatGalleryDate(gallery.updatedAt)}
                    </p>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUploadGallery(gallery);
                        setUploadFiles([]);
                        setUploadState('idle');
                        setUploadProgress(0);
                        setUploadError('');
                        if (uploadInputRef.current) {
                          uploadInputRef.current.value = '';
                        }
                      }}
                      className="rounded-full border border-[#c5a880]/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218]"
                    >
                      Upload Images
                    </button>
                    <button
                      type="button"
                      onClick={() => openRenameModal(gallery)}
                      className="rounded-full border border-[#2c2218]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteGallery(gallery)}
                      disabled={deletingGalleryId === gallery.id}
                      className="rounded-full border border-[#a76464]/28/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingGalleryId === gallery.id ? 'Deleting...' : 'Delete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedGalleryId((current) => (current === gallery.id ? null : gallery.id))}
                      className="rounded-full border border-[#2c2218]/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                    >
                      {expanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                {expanded ? (
                  <div className="border-t border-[#2c2218]/10 px-5 py-5">
                    {gallery.items.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-[#2c2218]/10 bg-[#f7efe4] px-5 py-10 text-center">
                        <p className="text-sm font-medium text-[#2c2218]">This gallery is empty</p>
                        <p className="mt-2 text-sm text-[#2c2218]/42">
                          Upload one or more images and they will appear on the public gallery page automatically.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {gallery.items.map((item) => (
                          <div
                            key={item.id}
                            className="overflow-hidden rounded-[24px] border border-[#2c2218]/10 bg-[#f7efe4]"
                          >
                            <div className="relative aspect-[4/5] overflow-hidden bg-[#070707]">
                              <img
                                src={resolveAssetUrl(item.url)}
                                alt={item.originalName}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute left-3 top-3 rounded-full border border-[#2c2218]/12 bg-[#f8f0e7]/82 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#2c2218]/75 backdrop-blur-md">
                                #{item.sortOrder + 1}
                              </div>
                            </div>

                            <div className="space-y-4 p-4">
                              <div>
                                <p className="truncate text-sm font-medium text-[#2c2218]">{item.originalName}</p>
                                <p className="mt-1 text-xs text-[#2c2218]/38">
                                  {formatBytes(item.size)}
                                  {item.width && item.height ? ` · ${item.width} x ${item.height}` : ''}
                                </p>
                                <p className="mt-2 truncate text-[11px] text-[#2c2218]/34">{item.url}</p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <a
                                  href={resolveAssetUrl(item.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                                >
                                  Preview
                                </a>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteItem(gallery.id, item.id)}
                                  disabled={deletingItemId === item.id}
                                  className="rounded-full border border-[#a76464]/28/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <GalleryModal
        open={createOpen}
        title="Create gallery"
        description="Each gallery gets its own dedicated Cloudflare R2 storage prefix."
        onClose={closeCreateModal}
      >
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/48">
              Gallery name
            </span>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="Pereti"
              className="h-12 w-full rounded-2xl border border-[#2c2218]/10 bg-[#f7efe4] px-4 text-sm text-[#2c2218] outline-none transition focus:border-[#c5a880]/60"
            />
          </label>

          <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/34">Storage prefix preview</p>
            <p className="mt-2 text-sm text-[#2c2218]">{getGalleryFolderPath(createSlugPreview)}</p>
          </div>

          {createError ? (
            <div className="rounded-[22px] border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
              {createError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateModal}
              className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreateGallery()}
              disabled={!createName.trim() || createState === 'saving'}
              className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {createState === 'saving' ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </GalleryModal>

      <GalleryModal
        open={renameGallery !== null}
        title="Rename gallery"
        description="Renaming the gallery also moves its uploaded images into the matching Cloudflare R2 prefix."
        onClose={closeRenameModal}
      >
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/48">
              Gallery name
            </span>
            <input
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              placeholder="Pereti"
              className="h-12 w-full rounded-2xl border border-[#2c2218]/10 bg-[#f7efe4] px-4 text-sm text-[#2c2218] outline-none transition focus:border-[#c5a880]/60"
            />
          </label>

          <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/34">Storage prefix preview</p>
            <p className="mt-2 text-sm text-[#2c2218]">{getGalleryFolderPath(renameSlugPreview)}</p>
          </div>

          {renameError ? (
            <div className="rounded-[22px] border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
              {renameError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeRenameModal}
              className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleRenameGallery()}
              disabled={!renameName.trim() || renameState === 'saving'}
              className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {renameState === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </GalleryModal>

      <GalleryModal
        open={uploadGallery !== null}
        title={uploadGallery ? `Upload images to ${uploadGallery.name}` : 'Upload images'}
        description="Selected files are optimized and saved into the matching Cloudflare R2 gallery storage."
        onClose={closeUploadModal}
      >
        <div className="space-y-5">
          <div
            className="rounded-[28px] border border-dashed border-[#2c2218]/12 bg-[#f8f2ea] px-5 py-8 text-center"
            onClick={() => uploadInputRef.current?.click()}
          >
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => setUploadFiles(event.target.files ? Array.from(event.target.files) : [])}
            />
            <p className="text-sm font-medium text-[#2c2218]">Choose images</p>
            <p className="mt-2 text-sm text-[#2c2218]/42">
              Click here to select one or more files from your computer.
            </p>
          </div>

          {uploadGallery ? (
            <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/34">Target folder</p>
              <p className="mt-2 text-sm text-[#2c2218]">{uploadGallery.folderPath}</p>
            </div>
          ) : null}

          {uploadFiles.length > 0 ? (
            <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0] p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-[#2c2218]">Selected files</p>
                  <p className="mt-1 text-xs text-[#2c2218]/40">{uploadFiles.length} items ready for upload</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUploadFiles([]);
                    if (uploadInputRef.current) {
                      uploadInputRef.current.value = '';
                    }
                  }}
                  className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-2">
                {uploadFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.lastModified}`}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#2c2218]">{file.name}</p>
                      <p className="mt-1 text-xs text-[#2c2218]/38">{formatBytes(file.size)}</p>
                    </div>
                    <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
                      Ready
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {uploadState === 'uploading' ? (
            <div className="rounded-[24px] border border-[#c5a880]/18 bg-[#f3e7d8] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-[#2c2218]">Uploading...</p>
                <p className="text-sm text-[#7a5b3e]">{uploadProgress}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2c2218]/10">
                <div
                  className="h-full rounded-full bg-[#c5a880] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {uploadError ? (
            <div className="rounded-[22px] border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
              {uploadError}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeUploadModal}
              disabled={uploadState === 'uploading'}
              className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleUploadFiles()}
              disabled={uploadFiles.length === 0 || uploadState === 'uploading'}
              className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {uploadState === 'uploading' ? 'Uploading...' : 'Upload Now'}
            </button>
          </div>
        </div>
      </GalleryModal>
    </section>
  );
}
