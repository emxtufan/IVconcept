export interface GalleryImageRecord {
  id: number;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: string;
}

export interface GalleryRecord {
  id: number;
  name: string;
  slug: string;
  folderPath: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: GalleryImageRecord[];
}

export function slugifyGalleryName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function getGalleryFolderPath(slug: string) {
  return `/uploads/galleries/${slug}`;
}
