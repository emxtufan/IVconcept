import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { normalizeSiteContent, type CollageImage, type ImageSectionContent, type SiteContent } from '../types/siteContent';
import GalleriesPanel from './GalleriesPanel';
import ProductsPanel from './ProductsPanel';
import { uploadFilesWithProgress } from './uploadClient';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type PathSegment = string | number;
type MediaKind = 'image' | 'video';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type AdminAuthState = 'checking' | 'authenticated' | 'unauthenticated';

interface AdminSessionResponse {
  authenticated: boolean;
  message?: string;
}

function isPlainObject(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setAtPath<T>(source: T, path: PathSegment[], nextValue: JsonValue): T {
  if (path.length === 0) {
    return nextValue as T;
  }

  const [head, ...tail] = path;

  if (Array.isArray(source)) {
    const copy = [...source] as JsonValue[];
    copy[head as number] = tail.length === 0
      ? nextValue
      : setAtPath(copy[head as number], tail, nextValue) as JsonValue;
    return copy as T;
  }

  if (isPlainObject(source)) {
    return {
      ...source,
      [head]: tail.length === 0
        ? nextValue
        : setAtPath(source[head as keyof typeof source] as JsonValue, tail, nextValue),
    } as T;
  }

  return source;
}

function getAtPath(source: JsonValue, path: PathSegment[]): JsonValue {
  let current: JsonValue = source;

  for (const segment of path) {
    if (Array.isArray(current)) {
      current = current[segment as number];
      continue;
    }

    if (isPlainObject(current)) {
      current = current[String(segment)] as JsonValue;
      continue;
    }

    return current;
  }

  return current;
}

function removeAtPath<T>(source: T, path: PathSegment[]): T {
  if (path.length === 0) {
    return source;
  }

  if (path.length === 1) {
    const [head] = path;

    if (Array.isArray(source)) {
      return source.filter((_, index) => index !== head) as T;
    }

    if (isPlainObject(source)) {
      const copy = { ...source };
      delete copy[String(head)];
      return copy as T;
    }

    return source;
  }

  const [head, ...tail] = path;

  if (Array.isArray(source)) {
    const copy = [...source] as JsonValue[];
    copy[head as number] = removeAtPath(copy[head as number], tail) as JsonValue;
    return copy as T;
  }

  if (isPlainObject(source)) {
    return {
      ...source,
      [head]: removeAtPath(source[head as keyof typeof source] as JsonValue, tail),
    } as T;
  }

  return source;
}

function addAtPath<T>(source: T, path: PathSegment[], item: JsonValue): T {
  if (path.length === 0) {
    return source;
  }

  if (path.length === 1) {
    const [head] = path;
    if (Array.isArray(source)) {
      return source as T;
    }

    if (isPlainObject(source)) {
      const current = source[head as keyof typeof source];
      if (!Array.isArray(current)) {
        return source;
      }

      return {
        ...source,
        [head]: [...current, item],
      } as T;
    }

    return source;
  }

  const [head, ...tail] = path;

  if (Array.isArray(source)) {
    const copy = [...source] as JsonValue[];
    copy[head as number] = addAtPath(copy[head as number], tail, item) as JsonValue;
    return copy as T;
  }

  if (isPlainObject(source)) {
    return {
      ...source,
      [head]: addAtPath(source[head as keyof typeof source] as JsonValue, tail, item),
    } as T;
  }

  return source;
}

function duplicateAtPath<T>(source: T, path: PathSegment[], item: JsonValue): T {
  if (path.length === 0) {
    return source;
  }

  if (path.length === 1) {
    const [head] = path;
    if (isPlainObject(source)) {
      const current = source[head as keyof typeof source];
      if (!Array.isArray(current)) {
        return source;
      }

      return {
        ...source,
        [head]: [...current, item],
      } as T;
    }

    return source;
  }

  const [head, ...tail] = path;

  if (Array.isArray(source)) {
    const copy = [...source] as JsonValue[];
    copy[head as number] = duplicateAtPath(copy[head as number], tail, item) as JsonValue;
    return copy as T;
  }

  if (isPlainObject(source)) {
    return {
      ...source,
      [head]: duplicateAtPath(source[head as keyof typeof source] as JsonValue, tail, item),
    } as T;
  }

  return source;
}

function createEmptyFromExample(example: JsonValue, siblings: JsonValue[] = []): JsonValue {
  if (typeof example === 'string') {
    return '';
  }

  if (typeof example === 'number') {
    return 0;
  }

  if (typeof example === 'boolean') {
    return false;
  }

  if (example === null) {
    return null;
  }

  if (Array.isArray(example)) {
    return [];
  }

  const nextObject: Record<string, JsonValue> = {};

  Object.entries(example).forEach(([key, value]) => {
    if (key === 'id') {
      if (typeof value === 'number') {
        const max = siblings
          .filter(isPlainObject)
          .map((item) => item.id)
          .filter((item): item is number => typeof item === 'number')
          .reduce((current, item) => Math.max(current, item), 0);
        nextObject[key] = max + 1;
        return;
      }

      if (typeof value === 'string') {
        const matches = siblings
          .filter(isPlainObject)
          .map((item) => item.id)
          .filter((item): item is string => typeof item === 'string')
          .map((item) => {
            const match = item.match(/^(.*?)(\d+)$/);
            return match ? { prefix: match[1], number: Number(match[2]) } : null;
          })
          .filter((item): item is { prefix: string; number: number } => item !== null);
        const current = value.match(/^(.*?)(\d+)$/);

        if (current) {
          const prefix = current[1];
          const next = matches
            .filter((item) => item.prefix === prefix)
            .reduce((max, item) => Math.max(max, item.number), 0) + 1;
          nextObject[key] = `${prefix}${next}`;
        } else {
          nextObject[key] = `item-${Date.now()}`;
        }
        return;
      }
    }

    nextObject[key] = createEmptyFromExample(value, []);
  });

  return nextObject;
}

function createDefaultReviewItem(siblings: JsonValue[] = []): Record<string, JsonValue> {
  const ids = siblings
    .filter(isPlainObject)
    .map((item) => item.id)
    .filter((item): item is string => typeof item === 'string');

  const matches = ids
    .map((item) => {
      const match = item.match(/^(.*?)(\d+)$/);
      return match ? { prefix: match[1], number: Number(match[2]) } : null;
    })
    .filter((item): item is { prefix: string; number: number } => item !== null);

  const prefix = 'review-';
  const next = matches
    .filter((item) => item.prefix === prefix)
    .reduce((max, item) => Math.max(max, item.number), 0) + 1;

  return {
    id: `${prefix}${next}`,
    title: '',
    category: '',
    description: '',
    thumbnail: '',
    mediaType: 'image',
    mediaUrl: '',
    poster: ''
  };
}

function createDefaultSliderPanelItem(siblings: JsonValue[] = []): Record<string, JsonValue> {
  const ids = siblings
    .filter(isPlainObject)
    .map((item) => item.id)
    .filter((item): item is number => typeof item === 'number');

  const next = ids.reduce((max, item) => Math.max(max, item), 0) + 1;

  return {
    id: next,
    indexLabel: '',
    category: '',
    title: '',
    description: '',
    image: '',
    desktopImage: '',
    mobileImage: ''
  };
}

function createDefaultProjectItem(siblings: JsonValue[] = []): Record<string, JsonValue> {
  const ids = siblings
    .filter(isPlainObject)
    .map((item) => item.id)
    .filter((item): item is string => typeof item === 'string');

  const matches = ids
    .map((item) => {
      const match = item.match(/^(.*?)(\d+)$/);
      return match ? { prefix: match[1], number: Number(match[2]) } : null;
    })
    .filter((item): item is { prefix: string; number: number } => item !== null);

  const prefix = 'project-';
  const next = matches
    .filter((item) => item.prefix === prefix)
    .reduce((max, item) => Math.max(max, item.number), 0) + 1;

  return {
    id: `${prefix}${next}`,
    title: '',
    location: '',
    type: '',
    finish: '',
    mirror: '',
    area: '',
    length: '',
    width: '',
    time: '',
    description: '',
    image: ''
  };
}

function toTitleCase(value: string) {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (char) => char.toUpperCase())
    .trim();
}

function itemLabel(item: JsonValue, index: number) {
  if (isPlainObject(item)) {
    const candidate = item.title ?? item.label ?? item.name ?? item.id;
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
    if (typeof candidate === 'number') {
      return `Item ${candidate}`;
    }
  }

  if (typeof item === 'string' && item.trim()) {
    return item;
  }

  return `Item ${index + 1}`;
}

function truncate(value: string, maxLength = 56) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function shouldSkipHintKey(key: string) {
  return /url|image|video|poster|thumbnail|description|paragraph|content|quote|text|aspect|height/i.test(key);
}

function getObjectHints(value: Record<string, JsonValue>) {
  const hints: string[] = [];

  Object.entries(value).forEach(([key, item]) => {
    if (hints.length >= 3) {
      return;
    }

    if (shouldSkipHintKey(key)) {
      return;
    }

    if (typeof item === 'string' && item.trim()) {
      hints.push(`${toTitleCase(key)}: ${truncate(item, 26)}`);
      return;
    }

    if (typeof item === 'number') {
      hints.push(`${toTitleCase(key)}: ${item}`);
      return;
    }

    if (typeof item === 'boolean') {
      hints.push(`${toTitleCase(key)}: ${item ? 'Yes' : 'No'}`);
      return;
    }

    if (Array.isArray(item)) {
      hints.push(`${toTitleCase(key)}: ${item.length} items`);
      return;
    }
  });

  return hints;
}

function getValueHints(value: JsonValue) {
  if (typeof value === 'string') {
    return value.trim() ? [truncate(value)] : ['Empty'];
  }

  if (typeof value === 'number') {
    return [`Value: ${value}`];
  }

  if (typeof value === 'boolean') {
    return [value ? 'Enabled' : 'Disabled'];
  }

  if (value === null) {
    return ['No value'];
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return ['No items'];
    }

    const stringItems = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, 2)
      .map((item) => truncate(item, 20));

    if (stringItems.length > 0) {
      return [`${value.length} items`, ...stringItems];
    }

    return [`${value.length} items`];
  }

  const hints = getObjectHints(value);
  if (hints.length > 0) {
    return hints;
  }

  return [`${Object.keys(value).length} fields`];
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

function fileNameStem(value: string) {
  return value.replace(/\.[^/.]+$/, '');
}

function extractFileNameFromUrl(url: string) {
  const cleaned = url.split('?')[0].split('#')[0];
  const segments = cleaned.split('/');
  return segments[segments.length - 1] || 'image';
}

function humanizeFileName(value: string) {
  return fileNameStem(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

const COLLAGE_ASPECT_SEQUENCE = [
  'aspect-[3/4]',
  'aspect-square',
  'aspect-[9/16]',
  'aspect-[4/3]',
  'aspect-[3/4]',
  'aspect-[4/5]',
  'aspect-[3/2]',
] as const;

function aspectClassFromRatio(width: number, height: number) {
  const ratio = width / height;

  if (ratio <= 0.62) {
    return 'aspect-[9/16]';
  }

  if (ratio <= 0.82) {
    return 'aspect-[3/4]';
  }

  if (ratio <= 0.95) {
    return 'aspect-[4/5]';
  }

  if (ratio <= 1.1) {
    return 'aspect-square';
  }

  if (ratio <= 1.45) {
    return 'aspect-[4/3]';
  }

  return 'aspect-[3/2]';
}

function getAspectWeightFromClass(aspectClass: string) {
  const normalized = aspectClass.trim();

  if (normalized === 'aspect-square') {
    return 1;
  }

  const match = normalized.match(/aspect-\[(\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)\]/);

  if (!match) {
    return 1;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!width || !height) {
    return 1;
  }

  return Math.max(0.72, Math.min(1.9, height / width));
}

function createImageCard(
  url: string,
  seed?: string,
  width?: number | null,
  height?: number | null,
  fallbackIndex = 0,
): CollageImage {
  const fileName = seed ?? extractFileNameFromUrl(url);
  const readableName = humanizeFileName(fileName) || 'Uploaded Image';
  const aspectClass =
    width && height
      ? aspectClassFromRatio(width, height)
      : COLLAGE_ASPECT_SEQUENCE[fallbackIndex % COLLAGE_ASPECT_SEQUENCE.length];

  return {
    url,
    label: `[ ${readableName.toUpperCase()} ]`,
    dimensions: readableName,
    aspectClass,
    heightClass: '',
  };
}

function flattenImageSection(section: ImageSectionContent) {
  return section.columns.flatMap((column) => column.images);
}

function buildImageSectionColumns(images: CollageImage[], previous: ImageSectionContent): ImageSectionContent {
  if (images.length === 0) {
    return { columns: [] };
  }

  const previousIds = previous.columns.map((column) => column.id);
  const requestedCount = previousIds.length > 0 ? previousIds.length : Math.min(images.length, 4);
  const columnCount = Math.max(1, Math.min(requestedCount, images.length));
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    id: previousIds[index] ?? index + 1,
    images: [] as CollageImage[],
    weight: 0,
  }));

  images.forEach((image) => {
    const nextColumn = columns.reduce((current, column) =>
      column.weight < current.weight ? column : current,
    );
    nextColumn.images.push(image);
    nextColumn.weight += getAspectWeightFromClass(image.aspectClass);
  });

  return {
    columns: columns.map(({ id, images: columnImages }) => ({
      id,
      images: columnImages,
    })),
  };
}

function resolveAssetUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (typeof window === 'undefined') {
    return url;
  }

  return new URL(url, window.location.origin).toString();
}

function inferMediaKind(
  label: string,
  path: PathSegment[],
  value: string,
  parentObject?: Record<string, JsonValue>,
): MediaKind | null {
  const key = label.toLowerCase();

  if (key === 'mediaurl' && parentObject && typeof parentObject.mediaType === 'string') {
    return parentObject.mediaType === 'video' ? 'video' : 'image';
  }

  if (/thumbnail|poster|image|logo/.test(key)) {
    return 'image';
  }

  if (/video/.test(key)) {
    return 'video';
  }

  if (/\.(mp4|webm|mov|m4v|ogg|avi|mkv)(\?|#|$)/i.test(value)) {
    return 'video';
  }

  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)(\?|#|$)/i.test(value)) {
    return 'image';
  }

  return null;
}

function isIndexedPath(path: PathSegment[]) {
  return typeof path[path.length - 1] === 'number';
}

function shouldHideObjectHeader(label: string, path: PathSegment[]) {
  return isIndexedPath(path) || /-\d+$/.test(label);
}

function shouldHideAdminField(path: PathSegment[]) {
  const normalizedPath = path.map(String);

  if (
    normalizedPath.length === 4 &&
    normalizedPath[0] === 'slidersSection' &&
    normalizedPath[1] === 'panels' &&
    normalizedPath[3] === 'image'
  ) {
    return true;
  }

  if (
    normalizedPath.length === 4 &&
    normalizedPath[0] === 'reviews' &&
    normalizedPath[1] === 'items' &&
    normalizedPath[3] === 'thumbnail'
  ) {
    return true;
  }

  return false;
}

const ADMIN_LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9a7754]';
const ADMIN_INPUT_CLASS = 'h-12 w-full rounded-2xl border border-[#2c2218]/12 bg-[#fbf6f0] px-4 text-sm text-[#2c2218] outline-none transition placeholder:text-[#2c2218]/32 focus:border-[#b38b60]/65';
const ADMIN_TEXTAREA_CLASS = 'min-h-[108px] w-full rounded-2xl border border-[#2c2218]/12 bg-[#fbf6f0] px-4 py-3 text-sm text-[#2c2218] outline-none transition placeholder:text-[#2c2218]/32 focus:border-[#b38b60]/65';
const ADMIN_CARD_CLASS = 'rounded-[28px] border border-[#2c2218]/10 bg-[#f5ede2]/92 shadow-[0_16px_45px_rgba(44,34,24,0.08)]';
const ADMIN_SUBCARD_CLASS = 'rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0]/96';
const ADMIN_DASHED_CARD_CLASS = 'rounded-[24px] border border-dashed border-[#2c2218]/14 bg-[#f8f2ea]/96';
const ADMIN_PRIMARY_BUTTON_CLASS = 'inline-flex h-11 items-center justify-center rounded-full border border-[#2c2218] bg-[#2c2218] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f8f0e6] transition hover:border-[#433223] hover:bg-[#433223] disabled:cursor-not-allowed disabled:opacity-35';
const ADMIN_SECONDARY_BUTTON_CLASS = 'inline-flex h-11 items-center justify-center rounded-full border border-[#2c2218]/14 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/76 transition hover:border-[#b38b60]/55 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35';
const ADMIN_TERTIARY_BUTTON_CLASS = 'inline-flex h-9 items-center justify-center rounded-full border border-[#b38b60]/28 bg-[#f3e6d6] px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8c6a49] transition hover:border-[#b38b60]/60 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35';
const ADMIN_DANGER_BUTTON_CLASS = 'inline-flex h-9 items-center justify-center rounded-full border border-[#a76464]/28 px-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#6f2b2b] disabled:cursor-not-allowed disabled:opacity-40';
const ADMIN_STATUS_PILL_CLASS = 'rounded-full border border-[#2c2218]/10 bg-[#fbf6f0]/92 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/55';
const ADMIN_INFO_BOX_CLASS = 'rounded-[24px] border border-[#b38b60]/20 bg-[#f3e7d8] px-4 py-3 text-sm text-[#7a5b3e]';
const ADMIN_ERROR_BOX_CLASS = 'rounded-[22px] border border-[#a76464]/24 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]';

interface FieldEditorProps {
  label: string;
  value: JsonValue;
  path: PathSegment[];
  depth: number;
  onChange: (path: PathSegment[], value: JsonValue) => void;
  onAdd: (path: PathSegment[], template: JsonValue) => void;
  onDuplicate: (path: PathSegment[], template: JsonValue) => void;
  onRemove: (path: PathSegment[]) => void;
  showLabel?: boolean;
  parentObject?: Record<string, JsonValue>;
}

function HintPills({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.slice(0, 3).map((item) => (
        <span
          key={item}
          className="rounded-full border border-[#2c2218]/10 bg-[#f6eee4] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[#2c2218]/52"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ArrayFieldEditor({
  label,
  value,
  path,
  depth,
  onChange,
  onAdd,
  onDuplicate,
  onRemove,
  showLabel = true,
}: FieldEditorProps & { value: JsonValue[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(value.length === 1 ? 0 : null);

  useEffect(() => {
    if (expandedIndex !== null && expandedIndex >= value.length) {
      setExpandedIndex(value.length > 0 ? value.length - 1 : null);
    }
  }, [expandedIndex, value.length]);

  const pathStr = path.map(String).join('.');

  const template =
    pathStr === 'reviews.items'
      ? createDefaultReviewItem(value)
      : pathStr === 'slidersSection.panels'
      ? createDefaultSliderPanelItem(value)
      : pathStr === 'cardsSection.projects'
      ? createDefaultProjectItem(value)
      : value.length > 0
      ? createEmptyFromExample(value[0], value)
      : '';

  return (
    <section className={depth === 0 ? 'space-y-4' : 'space-y-3'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {showLabel ? (
            <>
              <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c2218]">
                {toTitleCase(label)}
              </h4>
              <p className="mt-1 text-xs text-[#2c2218]/46">{value.length} items</p>
            </>
          ) : (
            <p className="text-xs uppercase tracking-[0.16em] text-[#2c2218]/46">{value.length} items</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onAdd(path, deepClone(template));
            setExpandedIndex(value.length);
          }}
          className={ADMIN_PRIMARY_BUTTON_CLASS}
        >
          Add Item
        </button>
      </div>

      <div className="space-y-3">
        {value.map((item, index) => {
          const expanded = expandedIndex === index;
          const hints = getValueHints(item);

          return (
            <div
              key={`${label}-${index}`}
              className={`overflow-hidden rounded-[24px] border transition ${
                expanded
                  ? 'border-[#b38b60]/28 bg-[#f6ede3]'
                  : 'border-[#2c2218]/10 bg-[#fbf6f0]/96 hover:border-[#b38b60]/30'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(expanded ? null : index)}
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-[#2c2218]">{itemLabel(item, index)}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#2c2218]/34">
                      Card {index + 1}
                    </span>
                  </div>
                  <HintPills items={hints} />
                </div>

                <span className="pt-1 text-lg leading-none text-[#2c2218]/54">{expanded ? '-' : '+'}</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#2c2218]/10 px-4 py-3 md:px-5">
                <button
                  type="button"
                  onClick={() => {
                    onDuplicate(path, deepClone(item));
                    setExpandedIndex(value.length);
                  }}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() => onRemove([...path, index])}
                  className={ADMIN_DANGER_BUTTON_CLASS}
                >
                  Delete
                </button>
              </div>

              {expanded && (
                <div className="border-t border-[#2c2218]/10 px-4 py-4 md:px-5">
                  <FieldEditor
                    label={`${label}-${index}`}
                    value={item}
                    path={[...path, index]}
                    depth={depth + 1}
                    onChange={onChange}
                    onAdd={onAdd}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                    showLabel={false}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ObjectFieldEditor({
  label,
  value,
  path,
  depth,
  onChange,
  onAdd,
  onDuplicate,
  onRemove,
  showLabel = true,
  parentObject,
}: FieldEditorProps & { value: Record<string, JsonValue> }) {
  const indexedPath = isIndexedPath(path);
  const hideObjectHeader = shouldHideObjectHeader(label, path);
  const compactLayout = depth <= 1 && !indexedPath;
  const childEntries = Object.entries(value).filter(([key]) => !shouldHideAdminField([...path, key]));

  const isSliderPanel =
    path.length === 3 &&
    path[0] === 'slidersSection' &&
    path[1] === 'panels' &&
    typeof path[2] === 'number';

  const isVideoCardSection =
    path.length === 1 &&
    path[0] === 'videoCardSection';

  const isReviewItem =
    path.length === 3 &&
    path[0] === 'reviews' &&
    path[1] === 'items' &&
    typeof path[2] === 'number';

  const filteredChildEntries = isSliderPanel
    ? childEntries.filter(([key]) => key !== 'desktopImage' && key !== 'mobileImage')
    : isVideoCardSection
    ? childEntries.filter(([key]) => key !== 'videoUrl')
    : isReviewItem
    ? childEntries.filter(([key]) => key !== 'mediaUrl' && key !== 'poster')
    : childEntries;

  const [expandedKey, setExpandedKey] = useState<string | null>(
    depth === 0 ? filteredChildEntries[0]?.[0] ?? null : null
  );

  useEffect(() => {
    if (expandedKey && !(expandedKey in value)) {
      setExpandedKey(filteredChildEntries[0]?.[0] ?? null);
    }
  }, [filteredChildEntries, expandedKey, value]);

  if (compactLayout) {
    return (
      <section className="space-y-3">
        {showLabel && depth > 0 && !hideObjectHeader && (
          <div className="pb-1">
            <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c2218]">
              {toTitleCase(label)}
            </h4>
          </div>
        )}

        {isVideoCardSection && childEntries.find(([key]) => key === 'videoUrl') && (
          <div className="mb-6 rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0]/96 p-4 md:p-5">
            <FieldEditor
              key="videoUrl"
              label="videoUrl"
              value={value['videoUrl']}
              path={[...path, 'videoUrl']}
              depth={depth + 1}
              onChange={onChange}
              onAdd={onAdd}
              onDuplicate={onDuplicate}
              onRemove={onRemove}
              parentObject={value}
            />
          </div>
        )}

        {filteredChildEntries.map(([key, childValue]) => {
          const expanded = expandedKey === key;

          return (
            <div
              key={key}
              className={`overflow-hidden rounded-[24px] border transition ${
                expanded
                  ? 'border-[#b38b60]/28 bg-[#f6ede3]'
                  : 'border-[#2c2218]/10 bg-[#fbf6f0]/96 hover:border-[#b38b60]/30'
              }`}
            >
              <button
                type="button"
                onClick={() => setExpandedKey(expanded ? null : key)}
                className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[#2c2218]">{toTitleCase(key)}</div>
                  <HintPills items={getValueHints(childValue)} />
                </div>
                <span className="pt-1 text-lg leading-none text-[#2c2218]/54">{expanded ? '-' : '+'}</span>
              </button>

              {expanded && (
                <div className="border-t border-[#2c2218]/10 px-4 py-4 md:px-5">
                  <FieldEditor
                    label={key}
                    value={childValue}
                    path={[...path, key]}
                    depth={depth + 1}
                    onChange={onChange}
                    onAdd={onAdd}
                    onDuplicate={onDuplicate}
                    onRemove={onRemove}
                    showLabel={false}
                    parentObject={value}
                  />
                </div>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <section
      className={`space-y-4 ${
        depth === 0 || indexedPath ? '' : 'rounded-[22px] border border-[#2c2218]/10 bg-[#fbf6f0]/96 p-4'
      }`}
    >
      {showLabel && !hideObjectHeader && depth > 0 && (
        <div className="border-b border-[#2c2218]/10 pb-3">
          <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2c2218]">
            {toTitleCase(label)}
          </h4>
        </div>
      )}

      <div className={`grid gap-4 ${depth <= 2 ? 'md:grid-cols-2' : ''}`}>
        {filteredChildEntries.map(([key, childValue]) => (
          <FieldEditor
            key={key}
            label={key}
            value={childValue}
            path={[...path, key]}
            depth={depth + 1}
            onChange={onChange}
            onAdd={onAdd}
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            parentObject={value}
          />
        ))}
      </div>

      {isSliderPanel && (
        <div className="mt-6 border-t border-[#2c2218]/10 pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.6fr_1fr] items-start">
            {childEntries.find(([key]) => key === 'desktopImage') && (
              <FieldEditor
                key="desktopImage"
                label="desktopImage"
                value={value['desktopImage']}
                path={[...path, 'desktopImage']}
                depth={depth + 1}
                onChange={onChange}
                onAdd={onAdd}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                parentObject={value}
              />
            )}
            {childEntries.find(([key]) => key === 'mobileImage') && (
              <FieldEditor
                key="mobileImage"
                label="mobileImage"
                value={value['mobileImage']}
                path={[...path, 'mobileImage']}
                depth={depth + 1}
                onChange={onChange}
                onAdd={onAdd}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                parentObject={value}
              />
            )}
          </div>
        </div>
      )}

      {isReviewItem && (
        <div className="mt-6 border-t border-[#2c2218]/10 pt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-start">
            {childEntries.find(([key]) => key === 'mediaUrl') && (
              <FieldEditor
                key="mediaUrl"
                label="mediaUrl"
                value={value['mediaUrl']}
                path={[...path, 'mediaUrl']}
                depth={depth + 1}
                onChange={onChange}
                onAdd={onAdd}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                parentObject={value}
              />
            )}
            {childEntries.find(([key]) => key === 'poster') && (
              <FieldEditor
                key="poster"
                label="poster"
                value={value['poster']}
                path={[...path, 'poster']}
                depth={depth + 1}
                onChange={onChange}
                onAdd={onAdd}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                parentObject={value}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function FieldEditor({
  label,
  value,
  path,
  depth,
  onChange,
  onAdd,
  onDuplicate,
  onRemove,
  showLabel = true,
  parentObject,
}: FieldEditorProps) {
  if (shouldHideAdminField(path)) {
    return null;
  }

  const pathString = path.map(String).join('.');

  if (pathString === 'hero.trustedAvatars' && Array.isArray(value)) {
    return (
      <TrustedAvatarsEditor
        value={value}
        path={path}
        onChange={onChange}
        showLabel={showLabel}
      />
    );
  }

  if (typeof value === 'string') {
    const mediaKind = inferMediaKind(label, path, value, parentObject);

    if (mediaKind) {
      return (
        <MediaFieldEditor
          label={label}
          value={value}
          path={path}
          onChange={onChange}
          showLabel={showLabel}
          mediaKind={mediaKind}
        />
      );
    }

    const multiline =
      value.length > 90 ||
      /description|quote|paragraph|text|content|line/i.test(label) ||
      value.includes('\n');

    return (
      <label className="block space-y-2">
        {showLabel && (
          <span className={ADMIN_LABEL_CLASS}>
            {toTitleCase(label)}
          </span>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(event) => onChange(path, event.target.value)}
            rows={4}
            className={ADMIN_TEXTAREA_CLASS}
          />
        ) : (
          <input
            value={value}
            onChange={(event) => onChange(path, event.target.value)}
            className={ADMIN_INPUT_CLASS}
          />
        )}
      </label>
    );
  }

  if (typeof value === 'number') {
    return (
      <label className="block space-y-2">
        {showLabel && (
          <span className={ADMIN_LABEL_CLASS}>
            {toTitleCase(label)}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(path, Number(event.target.value))}
          className={ADMIN_INPUT_CLASS}
        />
      </label>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center justify-between rounded-2xl border border-[#2c2218]/12 bg-[#fbf6f0] px-4 py-3">
        <span className="text-sm text-[#2c2218]">{showLabel ? toTitleCase(label) : 'Enabled'}</span>
        <input
          type="checkbox"
          checked={value}
          onChange={(event) => onChange(path, event.target.checked)}
          className="h-4 w-4 accent-[#c5a880]"
        />
      </label>
    );
  }

  if (value === null) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2c2218]/14 bg-[#fbf6f0] px-4 py-3 text-sm text-[#2c2218]/46">
        {showLabel ? `${toTitleCase(label)} is null` : 'No value'}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <ArrayFieldEditor
        label={label}
        value={value}
        path={path}
        depth={depth}
        onChange={onChange}
        onAdd={onAdd}
        onDuplicate={onDuplicate}
        onRemove={onRemove}
        showLabel={showLabel}
      />
    );
  }

  return (
    <ObjectFieldEditor
      label={label}
      value={value}
      path={path}
      depth={depth}
      onChange={onChange}
      onAdd={onAdd}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
      showLabel={showLabel}
      parentObject={parentObject}
    />
  );
}

function AdminModal({
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
            {description && (
              <p className="mt-2 max-w-[520px] text-sm leading-relaxed text-[#2c2218]/58">{description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#2c2218]/12 text-[#2c2218]/62 transition hover:border-[#b38b60]/50 hover:text-[#2c2218]"
          >
            ×
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-5 md:px-6">{children}</div>
      </div>
    </div>
  );
}

function MediaFieldEditor({
  label,
  value,
  path,
  onChange,
  showLabel = true,
  mediaKind,
}: {
  label: string;
  value: string;
  path: PathSegment[];
  onChange: (path: PathSegment[], value: JsonValue) => void;
  showLabel?: boolean;
  mediaKind: MediaKind;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const localPreviewUrl = useMemo(() => {
    if (!selectedFile) {
      return '';
    }

    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
      }
    };
  }, [localPreviewUrl]);

  const previewSrc = value.trim() ? resolveAssetUrl(value) : '';
  const accept = mediaKind === 'video' ? 'video/*' : 'image/*';

  const closeModal = () => {
    if (uploadState === 'uploading') {
      return;
    }

    setUploadOpen(false);
    setSelectedFile(null);
    setUploadState('idle');
    setUploadProgress(0);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || uploadState === 'uploading') {
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError('');

    try {
      const response = await uploadFilesWithProgress([selectedFile], setUploadProgress);
      const uploadedFile = response.files[0];

      if (!uploadedFile) {
        throw new Error('The upload did not return a file.');
      }

      onChange(path, uploadedFile.url);
      closeModal();
    } catch (error) {
      console.error(error);
      setUploadState('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  return (
    <div className="space-y-3">
      {showLabel && (
        <span className={ADMIN_LABEL_CLASS}>
          {toTitleCase(label)}
        </span>
      )}

      <div className="overflow-hidden rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0]">
        <div className={`relative overflow-hidden bg-[#efe4d7] ${
          mediaKind === 'video'
            ? 'aspect-video'
            : label === 'desktopImage'
            ? 'aspect-video'
            : label === 'mobileImage'
            ? 'aspect-[9/16]'
            : 'aspect-[4/5]'
        }`}>
          {previewSrc ? (
            mediaKind === 'video' ? (
              <video
                key={previewSrc}
                src={previewSrc}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={previewSrc}
                alt={toTitleCase(label)}
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            )
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#2c2218]/38">
              No {mediaKind} selected
            </div>
          )}

          <div className="absolute left-3 top-3 rounded-full border border-[#2c2218]/10 bg-[#f8f0e7]/82 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#2c2218]/72 backdrop-blur-md">
            {mediaKind}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <input
            value={value}
            onChange={(event) => onChange(path, event.target.value)}
            placeholder={mediaKind === 'video' ? '/uploads/clip.mp4' : '/uploads/image.jpg'}
            className={ADMIN_INPUT_CLASS}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              Upload {mediaKind}
            </button>
            {previewSrc && (
              <a
                href={previewSrc}
                target="_blank"
                rel="noreferrer"
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Preview
              </a>
            )}
          </div>
        </div>
      </div>

      <AdminModal
        open={uploadOpen}
        title={`Upload ${mediaKind}`}
        description={`Choose a ${mediaKind} file and upload it to Cloudflare R2. The field will be updated automatically with the new asset URL.`}
        onClose={closeModal}
      >
        <div className="space-y-5">
          <div
            className="rounded-[28px] border border-dashed border-[#2c2218]/14 bg-[#f8f2ea] px-5 py-8 text-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-sm font-medium text-[#2c2218]">Choose {mediaKind}</p>
            <p className="mt-2 text-sm text-[#2c2218]/46">
              Click here to select a local {mediaKind} file from your computer.
            </p>
          </div>

          {selectedFile && (
            <div className="space-y-4 rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0] p-4">
              <div className="overflow-hidden rounded-[22px] border border-[#2c2218]/10 bg-[#efe4d7]">
                <div className={
                  mediaKind === 'video'
                    ? 'aspect-video'
                    : label === 'desktopImage'
                    ? 'aspect-video'
                    : label === 'mobileImage'
                    ? 'aspect-[9/16]'
                    : 'aspect-[4/5]'
                }>
                  {mediaKind === 'video' ? (
                    <video
                      key={localPreviewUrl}
                      src={localPreviewUrl}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={localPreviewUrl}
                      alt={selectedFile.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="rounded-[20px] border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-3">
                <p className="truncate text-sm text-[#2c2218]">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-[#2c2218]/38">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="rounded-[24px] border border-[#b38b60]/20 bg-[#f3e7d8] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-[#2c2218]">Uploading...</p>
                <p className="text-sm text-[#8c6a49]">{uploadProgress}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2c2218]/10">
                <div
                  className="h-full rounded-full bg-[#c5a880] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className={ADMIN_ERROR_BOX_CLASS}>
              {uploadError}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              disabled={uploadState === 'uploading'}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!selectedFile || uploadState === 'uploading'}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {uploadState === 'uploading' ? 'Uploading...' : 'Upload Now'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

function TrustedAvatarsEditor({
  value,
  path,
  onChange,
  showLabel = true,
}: {
  value: JsonValue[];
  path: PathSegment[];
  onChange: (path: PathSegment[], value: JsonValue) => void;
  showLabel?: boolean;
}) {
  const avatars = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [localMessage, setLocalMessage] = useState('');

  const resetUploadState = () => {
    setUploadFiles([]);
    setUploadState('idle');
    setUploadProgress(0);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openUploadModal = () => {
    resetUploadState();
    setUploadOpen(true);
  };

  const closeUploadModal = () => {
    if (uploadState === 'uploading') {
      return;
    }

    setUploadOpen(false);
    resetUploadState();
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0 || uploadState === 'uploading') {
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError('');
    setLocalMessage('');

    try {
      const payload = await uploadFilesWithProgress(uploadFiles, setUploadProgress, '/api/uploads/images');
      const nextAvatars = [...avatars, ...payload.files.map((file) => file.url)];

      onChange(path, nextAvatars);
      setLocalMessage(
        `${payload.files.length} avatar${payload.files.length === 1 ? '' : 'e'} încărcat${payload.files.length === 1 ? '' : 'e'}. Salvează schimbările pentru publicare.`,
      );
      setUploadOpen(false);
      resetUploadState();
    } catch (error) {
      console.error(error);
      setUploadState('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  const handleRemove = (index: number) => {
    onChange(
      path,
      avatars.filter((_, itemIndex) => itemIndex !== index),
    );
    setLocalMessage('');
  };

  return (
    <div className="space-y-4">
      {showLabel && (
        <div>
          <span className={ADMIN_LABEL_CLASS}>
            Trusted Avatars
          </span>
          <p className="mt-2 text-sm leading-relaxed text-[#2c2218]/46">
            Încarcă imaginile rotunde care apar deasupra stelelor în blocul de încredere din hero.
          </p>
        </div>
      )}

      <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[#2c2218]">Happy Clients Avatars</p>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[#2c2218]/34">
              {avatars.length} imagini active
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={openUploadModal}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              Upload imagini
            </button>
            {avatars.length > 0 && (
              <button
                type="button"
                onClick={() => onChange(path, [])}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Șterge tot
              </button>
            )}
          </div>
        </div>

        {localMessage && (
          <p className="mt-4 rounded-[18px] border border-[#b38b60]/20 bg-[#f3e7d8] px-4 py-3 text-sm text-[#7a5b3e]">
            {localMessage}
          </p>
        )}

        {avatars.length === 0 ? (
          <div className="mt-4 rounded-[20px] border border-dashed border-[#2c2218]/14 bg-[#f8f2ea] px-5 py-8 text-center text-sm text-[#2c2218]/42">
            Nu există încă imagini. Încarcă una sau mai multe și ele vor apărea automat în site.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {avatars.map((avatar, index) => (
              <div
                key={`${avatar}-${index}`}
                className="rounded-[22px] border border-[#2c2218]/10 bg-[#f8f2ea] p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full ring-2 ring-[#2c2218]/14">
                    <img
                      src={resolveAssetUrl(avatar)}
                      alt={`Avatar ${index + 1}`}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#2c2218]">Avatar {index + 1}</p>
                    <p className="mt-1 truncate text-xs text-[#2c2218]/34">{avatar}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={resolveAssetUrl(avatar)}
                    target="_blank"
                    rel="noreferrer"
                    className={ADMIN_SECONDARY_BUTTON_CLASS}
                  >
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className={ADMIN_DANGER_BUTTON_CLASS}
                  >
                    Șterge
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminModal
        open={uploadOpen}
        title="Upload trusted avatars"
        description="Selectează mai multe imagini și încarcă-le direct în folderul public. Fiecare fișier va deveni automat un avatar nou în blocul de trust."
        onClose={closeUploadModal}
      >
        <div className="space-y-5">
          <div
            className="rounded-[28px] border border-dashed border-[#2c2218]/14 bg-[#f8f2ea] px-5 py-8 text-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => setUploadFiles(event.target.files ? Array.from(event.target.files) : [])}
            />
            <p className="text-sm font-medium text-[#2c2218]">Choose images</p>
            <p className="mt-2 text-sm text-[#2c2218]/46">
              Click here to select one or more client avatar images.
            </p>
          </div>

          {uploadFiles.length > 0 && (
            <div className="rounded-[24px] border border-[#2c2218]/10 bg-[#fbf6f0] p-4">
              <div className="mb-4">
                <p className="text-sm font-medium text-[#2c2218]">Selected files</p>
                <p className="mt-1 text-xs text-[#2c2218]/40">{uploadFiles.length} items ready for upload</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {uploadFiles.map((file) => (
                  <div
                    key={`${file.name}-${file.lastModified}`}
                    className="rounded-[18px] border border-[#2c2218]/10 bg-[#f7efe4] px-4 py-3"
                  >
                    <p className="truncate text-sm text-[#2c2218]">{file.name}</p>
                    <p className="mt-1 text-xs text-[#2c2218]/38">{formatBytes(file.size)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadState === 'uploading' && (
            <div className="rounded-[24px] border border-[#b38b60]/20 bg-[#f3e7d8] p-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-[#2c2218]">Uploading...</p>
                <p className="text-sm text-[#8c6a49]">{uploadProgress}%</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#2c2218]/10">
                <div
                  className="h-full rounded-full bg-[#c5a880] transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className={ADMIN_ERROR_BOX_CLASS}>
              {uploadError}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeUploadModal}
              disabled={uploadState === 'uploading'}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploadFiles.length === 0 || uploadState === 'uploading'}
              className={ADMIN_PRIMARY_BUTTON_CLASS}
            >
              {uploadState === 'uploading' ? 'Uploading...' : 'Upload Now'}
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

function ImageSectionEditor({
  value,
  onChange,
}: {
  value: ImageSectionContent;
  onChange: (nextValue: ImageSectionContent) => void;
}) {
  const images = useMemo(() => flattenImageSection(value), [value]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [localMessage, setLocalMessage] = useState('');
  const [linkModal, setLinkModal] = useState<{ mode: 'add' | 'edit'; index: number; url: string } | null>(null);

  const applyImages = (nextImages: CollageImage[]) => {
    onChange(buildImageSectionColumns(nextImages, value));
  };

  const resetUploadState = () => {
    setUploadFiles([]);
    setUploadState('idle');
    setUploadProgress(0);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openUploadModal = () => {
    resetUploadState();
    setUploadOpen(true);
  };

  const closeUploadModal = () => {
    if (uploadState === 'uploading') {
      return;
    }

    setUploadOpen(false);
    resetUploadState();
  };

  const handleFileSelection = (files: FileList | null) => {
    setUploadFiles(files ? Array.from(files) : []);
    setUploadError('');
    setUploadProgress(0);
    setUploadState('idle');
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0 || uploadState === 'uploading') {
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError('');
    setLocalMessage('');

    try {
      const payload = await uploadFilesWithProgress(uploadFiles, setUploadProgress);

      const uploadedCards = payload.files.map((file, index) =>
        createImageCard(
          file.url,
          file.originalName,
          file.width,
          file.height,
          images.length + index,
        ),
      );
      applyImages([...flattenImageSection(value), ...uploadedCards]);
      setUploadProgress(100);
      setLocalMessage(`${uploadedCards.length} image${uploadedCards.length === 1 ? '' : 's'} uploaded. Save changes to publish them on the site.`);
      setUploadOpen(false);
      resetUploadState();
    } catch (error) {
      console.error(error);
      setUploadState('error');
      setUploadError(error instanceof Error ? error.message : 'Upload failed.');
    }
  };

  const handleDeleteImage = (index: number) => {
    const nextImages = images.filter((_, imageIndex) => imageIndex !== index);
    applyImages(nextImages);
    setLocalMessage('Image removed from the draft. Save changes to update the site.');
  };

  const handleSaveLink = () => {
    if (!linkModal) {
      return;
    }

    const trimmedUrl = linkModal.url.trim();
    if (!trimmedUrl) {
      return;
    }

    if (linkModal.mode === 'add') {
      applyImages([...images, createImageCard(trimmedUrl, undefined, null, null, images.length)]);
      setLocalMessage('Image link added to the draft. Save changes to publish it.');
    } else {
      const current = images[linkModal.index];
      if (!current) {
        setLinkModal(null);
        return;
      }

      const fallbackCard = createImageCard(trimmedUrl, undefined, null, null, linkModal.index);
      const nextImages = images.map((image, index) =>
        index === linkModal.index
          ? {
              ...image,
              url: trimmedUrl,
              label: image.label || fallbackCard.label,
              dimensions: image.dimensions || fallbackCard.dimensions,
            }
          : image,
      );

      applyImages(nextImages);
      setLocalMessage('Image link updated in the draft. Save changes to publish it.');
    }

    setLinkModal(null);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-[28px] border border-[#2c2218]/10 bg-[#f5ede2] p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-[-0.04em] text-[#2c2218]">Image Library</h3>
          <p className="mt-2 max-w-[620px] text-sm leading-relaxed text-[#2c2218]/48">
            Upload multiple images to Cloudflare R2, get a preview for every card, and keep only the image link visible here for fast editing.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
              {images.length} cards
            </span>
            <span className="rounded-full border border-[#2c2218]/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/38">
              Storage: Cloudflare R2
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setLinkModal({ mode: 'add', index: -1, url: '' })}
            className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
          >
            Add Link
          </button>
          <button
            type="button"
            onClick={openUploadModal}
            className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218]"
          >
            Upload Images
          </button>
        </div>
      </div>

      {localMessage && (
        <div className="rounded-[24px] border border-[#c5a880]/16 bg-[#f3e7d8] px-4 py-3 text-sm text-[#7a5b3e]">
          {localMessage}
        </div>
      )}

      {images.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#2c2218]/12 bg-[#fbf6f0] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#2c2218]">No images yet</p>
          <p className="mt-2 text-sm text-[#2c2218]/42">
            Upload multiple files or add a direct image URL to create the first cards.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <div key={`${image.url}-${index}`} className="overflow-hidden rounded-[28px] border border-[#2c2218]/10 bg-[#fbf6f0]">
              <div className="relative aspect-[4/5] overflow-hidden bg-[#070707]">
                <img
                  src={resolveAssetUrl(image.url)}
                  alt={image.label || `Image ${index + 1}`}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute left-3 top-3 rounded-full border border-[#2c2218]/12 bg-[#f8f0e7]/82 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-[#2c2218]/75 backdrop-blur-md">
                  Card {index + 1}
                </div>
              </div>

              <div className="space-y-4 p-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/34">Image Link</p>
                  <input
                    readOnly
                    value={image.url}
                    className="mt-2 h-11 w-full rounded-2xl border border-[#2c2218]/10 bg-[#f7efe4] px-4 text-xs text-[#2c2218]/72 outline-none"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={resolveAssetUrl(image.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                  >
                    Preview
                  </a>
                  <button
                    type="button"
                    onClick={() => setLinkModal({ mode: 'edit', index, url: image.url })}
                    className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/62 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
                  >
                    Edit Link
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(index)}
                    className="rounded-full border border-[#a76464]/28 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#2c2218]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AdminModal
        open={uploadOpen}
        title="Upload images"
        description="Select multiple images and upload them directly to Cloudflare R2. Every successful upload becomes a new image card automatically."
        onClose={closeUploadModal}
      >
        <div className="space-y-5">
          <div
            className="rounded-[28px] border border-dashed border-[#2c2218]/12 bg-[#f8f2ea] px-5 py-8 text-center"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files)}
            />
            <p className="text-sm font-medium text-[#2c2218]">Choose images</p>
            <p className="mt-2 text-sm text-[#2c2218]/42">
              Click here to select one or more files from your computer.
            </p>
          </div>

          {uploadFiles.length > 0 && (
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
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
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
                    key={`${file.name}-${file.size}`}
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
          )}

          {uploadState === 'uploading' && (
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
          )}

          {uploadError && (
            <div className="rounded-[22px] border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
              {uploadError}
            </div>
          )}

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
              onClick={handleUpload}
              disabled={uploadFiles.length === 0 || uploadState === 'uploading'}
              className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {uploadState === 'uploading' ? 'Uploading...' : 'Upload Now'}
            </button>
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={linkModal !== null}
        title={linkModal?.mode === 'edit' ? 'Edit image link' : 'Add image link'}
        description="Paste a direct image URL or keep the uploaded asset URL generated after the Cloudflare R2 upload."
        onClose={() => setLinkModal(null)}
      >
        <div className="space-y-5">
          {linkModal && linkModal.url.trim() && (
            <div className="overflow-hidden rounded-[28px] border border-[#2c2218]/10 bg-[#fbf6f0]">
              <div className="aspect-[4/5] bg-[#070707]">
                <img
                  src={resolveAssetUrl(linkModal.url)}
                  alt="Image preview"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          <label className="block space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/48">
              Image URL
            </span>
            <input
              value={linkModal?.url ?? ''}
              onChange={(event) =>
                setLinkModal((current) => (current ? { ...current, url: event.target.value } : current))
              }
              placeholder="/uploads/your-image.jpg or https://..."
              className="h-12 w-full rounded-2xl border border-[#2c2218]/10 bg-[#f7efe4] px-4 text-sm text-[#2c2218] outline-none transition focus:border-[#c5a880]/60"
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setLinkModal(null)}
              className="h-11 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveLink}
              disabled={!linkModal?.url.trim()}
              className="h-11 rounded-full border border-[#c5a880]/45 bg-[#17130f] px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3dfc3] transition hover:border-[#c5a880] hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-35"
            >
              Save Link
            </button>
          </div>
        </div>
      </AdminModal>
    </section>
  );
}

type AdminSectionKey = keyof SiteContent | 'galleries' | 'products' | 'inquiries' | 'subscribers' | 'courseSubscribers';

interface AdminSectionMeta {
  label: string;
  usage: string;
  description: string;
  readOnly?: boolean;
}

const SECTION_ORDER: AdminSectionKey[] = [
  'hero',
  'about',
  'imageSection',
  'logoSection',
  'textSection',
  'slidersSection',
  'videoCardSection',
  'reviews',
  'footer',
  'galleries',
  'products',
  'subscribers',
  'courseSubscribers',
  'inquiries',
];

const ADMIN_SECTION_META: Record<AdminSectionKey, AdminSectionMeta> = {
  hero: {
    label: 'Home',
    usage: 'Hero principal',
    description: 'Editezi continutul din prima sectiune Home / Hero.',
  },
  about: {
    label: 'About Me',
    usage: 'Sectiunea About',
    description: 'Editezi textele si detaliile din sectiunea About Me.',
  },
  imageSection: {
    label: 'Galerie Foto',
    usage: 'Galeria din homepage',
    description: 'Controlezi imaginile folosite in galeria foto de pe homepage.',
  },
  logoSection: {
    label: 'Logo Intro + Navbar',
    usage: 'Intro logo scroll',
    description: 'Controlezi logo-ul animat din intro si varianta care ajunge in navbar.',
  },
  textSection: {
    label: 'Motto',
    usage: 'Commitment Section',
    description: 'Controlezi sectiunea Motto / Commitment, separata de Hero si de logo.',
  },
  cardsSection: {
    label: 'Piesele / Lucrari',
    usage: 'Selected Work',
    description: 'Controlezi cardurile din sectiunea cu piesele sau lucrarile prezentate.',
  },
  slidersSection: {
    label: 'Proiecte Pereti',
    usage: 'Panouri parallax',
    description: 'Controlezi panourile parallax cu imagini desktop si mobile pentru proiecte.',
  },
  videoCardSection: {
    label: 'Cursuri / Povestea',
    usage: 'Blocul video patrat',
    description: 'Controlezi sectiunea editoriala cu text si video patrat din zona Povestea / Cursuri.',
  },
  reviews: {
    label: 'Reactii / Review',
    usage: 'Sectiunea testimoniale',
    description: 'Controlezi recomandarile, reactiile si media din sectiunea de review.',
  },
  footer: {
    label: 'Contact + Footer',
    usage: 'Footer si meniu',
    description: 'Controlezi footer-ul, contactul si textele care apar si in meniu.',
  },
  galleries: {
    label: 'Galerie Foto Completa',
    usage: 'Pagina /galerie-foto',
    description: 'Administrezi galeriile separate pentru pagina dedicata de galerie foto.',
  },
  products: {
    label: 'Categorii & Produse',
    usage: 'Pagina /produse',
    description: 'Creezi categorii și adaugi produse cu titlu, descriere, imagini, preț și dimensiune.',
    readOnly: true,
  },
  subscribers: {
    label: 'Abonari Newsletter',
    usage: 'Date colectate din footer',
    description: 'Vezi emailurile trimise din formularul de subscribe din footer.',
    readOnly: true,
  },
  courseSubscribers: {
    label: 'Abonați cursuri',
    usage: 'Formularul din secțiunea Cursuri',
    description: 'Vezi persoanele înscrise la curs și datele de contact trimise cu acord GDPR.',
    readOnly: true,
  },
  inquiries: {
    label: 'Contact / Cereri',
    usage: 'Formularul de contact',
    description: 'Vezi cererile salvate din formularul de contact si oferta.',
    readOnly: true,
  },
};

interface InquiryRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  projectDetails: string;
  status: string;
  createdAt: string;
  images: string[];
  gdprAccepted: boolean;
  gdprAcceptedAt: string;
}

interface NewsletterSubscriberRecord {
  id: number;
  email: string;
  source: string;
  createdAt: string;
}

interface CourseSubscriberRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gdprAccepted: boolean;
  gdprAcceptedAt: string;
  createdAt: string;
}

function formatInquiryName(inquiry: InquiryRecord) {
  // Single-word submissions are stored with the same value in both columns
  if (inquiry.lastName && inquiry.lastName !== inquiry.firstName) {
    return `${inquiry.firstName} ${inquiry.lastName}`;
  }
  return inquiry.firstName;
}

function formatInquiryDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
}

function InquiriesPanel() {
  const [inquiries, setInquiries] = useState<InquiryRecord[] | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError('');

    fetch('/api/inquiries')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load inquiries: ${response.status}`);
        }
        return (await response.json()) as InquiryRecord[];
      })
      .then((data) => {
        if (!cancelled) setInquiries(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setInquiries([]);
          setError('Nu am putut încărca cererile din baza de date.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ștergi definitiv această cerere?')) return;

    try {
      setDeletingId(id);
      setError('');
      const response = await fetch(`/api/inquiries/${id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Failed to delete inquiry: ${response.status}`);
      }
      setInquiries((prev) => (prev ? prev.filter((inquiry) => inquiry.id !== id) : prev));
    } catch (err) {
      console.error(err);
      setError('Ștergerea cererii a eșuat. Încearcă din nou.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/42">
          {inquiries === null ? 'Se încarcă...' : `${inquiries.length} ${inquiries.length === 1 ? 'cerere' : 'cereri'}`}
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="h-10 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
        >
          Reîncarcă
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
          {error}
        </p>
      )}

      {inquiries !== null && inquiries.length === 0 && !error && (
        <p className="mt-6 rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0]/92 px-5 py-6 text-sm text-[#2c2218]/55">
          Nicio cerere primită încă. Cererile trimise din formularul de ofertă apar automat aici.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {(inquiries ?? []).map((inquiry) => (
          <article
            key={inquiry.id}
            className="rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0]/92 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#2c2218]">
                  {formatInquiryName(inquiry)}
                </h3>
                <p className="mt-1 text-xs text-[#2c2218]/40">{formatInquiryDate(inquiry.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#c5a880]/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f1d9ba]">
                  {inquiry.status}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(inquiry.id)}
                  disabled={deletingId === inquiry.id}
                  className="h-8 rounded-full border border-[#a76464]/28/70 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingId === inquiry.id ? 'Se șterge...' : 'Șterge'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <a href={`mailto:${inquiry.email}`} className="text-[#c5a880] transition hover:text-[#2c2218]">
                {inquiry.email}
              </a>
              <a href={`tel:${inquiry.phone.replace(/\s/g, '')}`} className="text-[#2c2218]/70 transition hover:text-[#2c2218]">
                {inquiry.phone}
              </a>
            </div>

            <p className="mt-3 whitespace-pre-wrap border-t border-[#2c2218]/10 pt-3 text-sm leading-relaxed text-[#2c2218]/60">
              {inquiry.projectDetails}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-green-800/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-800">
                GDPR acceptat · {formatInquiryDate(inquiry.gdprAcceptedAt)}
              </span>
            </div>
            {inquiry.images?.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#2c2218]/10 pt-4 sm:grid-cols-3 lg:grid-cols-5">
                {inquiry.images.map((image, index) => (
                  <a key={image} href={image} target="_blank" rel="noreferrer" className="group block aspect-square overflow-hidden rounded-xl bg-[#2c2218]/5">
                    <img src={image} alt={`Fotografie proiect ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function NewsletterSubscribersPanel() {
  const [subscribers, setSubscribers] = useState<NewsletterSubscriberRecord[] | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError('');

    fetch('/api/newsletter-subscriptions')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load subscribers: ${response.status}`);
        }

        return (await response.json()) as NewsletterSubscriberRecord[];
      })
      .then((data) => {
        if (!cancelled) {
          setSubscribers(data);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setSubscribers([]);
          setError('Nu am putut încărca abonații newsletter din baza de date.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ștergi definitiv acest abonat?')) return;

    try {
      setDeletingId(id);
      setError('');
      const response = await fetch(`/api/newsletter-subscriptions/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete subscriber: ${response.status}`);
      }

      setSubscribers((prev) => (prev ? prev.filter((subscriber) => subscriber.id !== id) : prev));
    } catch (err) {
      console.error(err);
      setError('Ștergerea abonatului a eșuat. Încearcă din nou.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/42">
          {subscribers === null
            ? 'Se încarcă...'
            : `${subscribers.length} ${subscribers.length === 1 ? 'abonat' : 'abonați'}`}
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="h-10 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/72 transition hover:border-[#b38b60]/45 hover:text-[#2c2218]"
        >
          Reîncarcă
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-[#a76464]/28 bg-[#fff3f0] px-4 py-3 text-sm text-[#8d4040]">
          {error}
        </p>
      )}

      {subscribers !== null && subscribers.length === 0 && !error && (
        <p className="mt-6 rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0]/92 px-5 py-6 text-sm text-[#2c2218]/55">
          Încă nu există emailuri abonate. Adresele trimise din subscribe-ul din footer apar automat aici.
        </p>
      )}

      <div className="mt-6 space-y-4">
        {(subscribers ?? []).map((subscriber) => (
          <article
            key={subscriber.id}
            className="rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0]/92 p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.02em] text-[#2c2218]">
                  {subscriber.email}
                </h3>
                <p className="mt-1 text-xs text-[#2c2218]/40">{formatInquiryDate(subscriber.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#c5a880]/45 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f1d9ba]">
                  {subscriber.source}
                </span>
                <button
                  type="button"
                  onClick={() => void handleDelete(subscriber.id)}
                  disabled={deletingId === subscriber.id}
                  className="h-8 rounded-full border border-[#a76464]/28/70 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8d4040] transition hover:border-[#8d4040]/55 hover:text-[#2c2218] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {deletingId === subscriber.id ? 'Se șterge...' : 'Șterge'}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <a
                href={`mailto:${subscriber.email}`}
                className="text-[#c5a880] transition hover:text-[#2c2218]"
              >
                {subscriber.email}
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CourseSubscribersPanel() {
  const [subscribers, setSubscribers] = useState<CourseSubscriberRecord[] | null>(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/course-subscribers')
      .then(async (response) => {
        if (!response.ok) throw new Error(`Failed: ${response.status}`);
        return await response.json() as CourseSubscriberRecord[];
      })
      .then((data) => { if (!cancelled) setSubscribers(data); })
      .catch(() => {
        if (!cancelled) {
          setSubscribers([]);
          setError('Nu am putut încărca abonații la cursuri.');
        }
      });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Ștergi definitiv acest abonat?')) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/course-subscribers/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      setSubscribers((items) => items?.filter((item) => item.id !== id) ?? null);
    } catch {
      setError('Abonatul nu a putut fi șters.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full border border-[#2c2218]/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#2c2218]/42">
          {subscribers === null ? 'Se încarcă…' : `${subscribers.length} ${subscribers.length === 1 ? 'abonat' : 'abonați'}`}
        </span>
        <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="h-10 rounded-full border border-[#2c2218]/10 px-5 text-[11px] font-semibold uppercase tracking-[0.16em]">Reîncarcă</button>
      </div>
      {error && <p className="mt-4 rounded-2xl border border-red-800/20 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {subscribers?.length === 0 && !error && <p className="mt-6 rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0] px-5 py-6 text-sm text-[#2c2218]/55">Nu există încă înscrieri la curs.</p>}
      <div className="mt-6 space-y-4">
        {(subscribers ?? []).map((subscriber) => (
          <article key={subscriber.id} className="rounded-2xl border border-[#2c2218]/10 bg-[#fbf6f0] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{subscriber.firstName} {subscriber.lastName}</h3>
                <p className="mt-1 text-xs text-[#2c2218]/40">{formatInquiryDate(subscriber.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-green-800/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-green-800">GDPR acceptat</span>
                <button type="button" disabled={deletingId === subscriber.id} onClick={() => void handleDelete(subscriber.id)} className="rounded-full border border-red-800/20 px-3 py-1 text-[10px] font-semibold uppercase text-red-800 disabled:opacity-40">
                  {deletingId === subscriber.id ? 'Se șterge…' : 'Șterge'}
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#2c2218]/10 pt-4 text-sm">
              <a href={`mailto:${subscriber.email}`} className="text-[#9b744e]">{subscriber.email}</a>
              <a href={`tel:${subscriber.phone.replace(/\s/g, '')}`}>{subscriber.phone}</a>
              <span className="text-xs text-[#2c2218]/45">Acord: {formatInquiryDate(subscriber.gdprAcceptedAt)}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSectionKey>('hero');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [message, setMessage] = useState('');
  const [authState, setAuthState] = useState<AdminAuthState>('checking');
  const [authMessage, setAuthMessage] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const isDirty = useMemo(() => {
    if (!content || !draft) {
      return false;
    }

    return JSON.stringify(content) !== JSON.stringify(draft);
  }, [content, draft]);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        setAuthMessage('');
        const response = await fetch('/api/admin/session', {
          credentials: 'same-origin',
        });

        if (response.ok) {
          if (cancelled) return;
          setAuthState('authenticated');
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as Partial<AdminSessionResponse>;
        if (cancelled) return;

        setAuthState('unauthenticated');
        setAuthMessage(payload.message ?? 'Introdu parola pentru a accesa panoul de admin.');
        setLoading(false);
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setAuthState('unauthenticated');
        setAuthMessage('Nu am putut verifica sesiunea de admin. Incearca din nou.');
        setLoading(false);
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authState !== 'authenticated') {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const response = await fetch('/api/site-content');
        if (!response.ok) {
          throw new Error(`Failed to load admin content: ${response.status}`);
        }

        const payload = normalizeSiteContent((await response.json()) as SiteContent);
        if (cancelled) return;

        setContent(payload);
        setDraft(deepClone(payload));
      } catch (error) {
        console.error(error);
        if (cancelled) return;
        setMessage('Failed to load site content from the server.');
        setSaveState('error');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authState]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password.trim() || isSubmittingAuth) {
      return;
    }

    try {
      setIsSubmittingAuth(true);
      setAuthMessage('');

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          password,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? `Failed to login: ${response.status}`);
      }

      setPassword('');
      setContent(null);
      setDraft(null);
      setMessage('');
      setSaveState('idle');
      setLoading(true);
      setAuthState('authenticated');
    } catch (error) {
      console.error(error);
      setAuthState('unauthenticated');
      setAuthMessage(error instanceof Error ? error.message : 'Autentificarea a esuat.');
      setLoading(false);
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.error(error);
    } finally {
      setAuthState('unauthenticated');
      setAuthMessage('Sesiunea de admin a fost inchisa.');
      setPassword('');
      setContent(null);
      setDraft(null);
      setMessage('');
      setSaveState('idle');
      setLoading(false);
      setActiveSection('hero');
    }
  };

  const handleChange = (path: PathSegment[], nextValue: JsonValue) => {
    setDraft((current) => {
      if (!current) return current;
      return setAtPath(current, path, nextValue);
    });
    setSaveState('idle');
    setMessage('');
  };

  const handleAdd = (path: PathSegment[], template: JsonValue) => {
    setDraft((current) => {
      if (!current) return current;
      return addAtPath(current, path, template);
    });
    setSaveState('idle');
  };

  const handleDuplicate = (path: PathSegment[], template: JsonValue) => {
    setDraft((current) => {
      if (!current) return current;
      const currentArray = getAtPath(current as unknown as JsonValue, path);
      const siblings = Array.isArray(currentArray) ? currentArray : [];
      const nextTemplate = createEmptyFromExample(template, siblings);
      const payload =
        isPlainObject(template) && isPlainObject(nextTemplate)
          ? {
              ...deepClone(template),
              ...(nextTemplate.id !== undefined ? { id: nextTemplate.id } : {}),
            }
          : deepClone(template);
      return duplicateAtPath(current, path, payload);
    });
    setSaveState('idle');
  };

  const handleRemove = (path: PathSegment[]) => {
    setDraft((current) => {
      if (!current) return current;
      return removeAtPath(current, path);
    });
    setSaveState('idle');
  };

  const handleReset = () => {
    if (!content) return;
    setDraft(deepClone(content));
    setSaveState('idle');
    setMessage('');
  };

  const handleSave = async () => {
    if (!draft) return;

    try {
      setSaveState('saving');
      setMessage('');

      const response = await fetch('/api/site-content', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(draft),
      });

      if (!response.ok) {
        throw new Error(`Failed to save content: ${response.status}`);
      }

      const nextContent = normalizeSiteContent((await response.json()) as SiteContent);
      setContent(nextContent);
      setDraft(deepClone(nextContent));
      setSaveState('saved');
      setMessage('Changes saved to the database.');
    } catch (error) {
      console.error(error);
      setSaveState('error');
      setMessage('Could not save changes. Please try again.');
    }
  };

  if (authState === 'checking' || (authState === 'authenticated' && loading)) {
    return (
      <div className="grain-bg relative min-h-screen bg-[#e8e0d6] text-[#2c2218]">
        <div className="grain-overlay" />
        <div className="relative z-[60] mx-auto flex min-h-screen max-w-[1500px] items-center justify-center px-6">
          <div className="rounded-[28px] border border-[#2c2218]/10 bg-[#f5ede2] px-8 py-6 text-sm uppercase tracking-[0.18em] text-[#2c2218]/62 shadow-[0_18px_40px_rgba(44,34,24,0.08)]">
            {authState === 'checking' ? 'Verific accesul' : 'Se incarca adminul'}
          </div>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="grain-bg relative min-h-screen bg-[#e8e0d6] text-[#2c2218]">
        <div className="grain-overlay" />
        <div className="relative z-[60] mx-auto flex min-h-screen max-w-[540px] items-center justify-center px-6">
          <div className="w-full rounded-[34px] border border-[#2c2218]/10 bg-[#f5ede2] p-6 shadow-[0_24px_70px_rgba(44,34,24,0.09)] md:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b38b60]">
              Protected Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#2c2218]">
              Acces cu parola
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#2c2218]/56">
              Panoul de admin nu mai este public. Introdu parola de administrator pentru a continua.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleLogin}>
              <label className="block space-y-2">
                <span className={ADMIN_LABEL_CLASS}>
                  Parola admin
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className={ADMIN_INPUT_CLASS}
                  placeholder="Introdu parola"
                />
              </label>

              {authMessage ? (
                <div className={ADMIN_ERROR_BOX_CLASS}>
                  {authMessage}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={!password.trim() || isSubmittingAuth}
                  className={ADMIN_PRIMARY_BUTTON_CLASS}
                >
                  {isSubmittingAuth ? 'Se verifica...' : 'Intra in Admin'}
                </button>
                <a
                  href="/"
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Inapoi pe site
                </a>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="grain-bg relative min-h-screen bg-[#e8e0d6] text-[#2c2218]">
        <div className="grain-overlay" />
        <div className="relative z-[60] mx-auto flex min-h-screen max-w-[900px] items-center justify-center px-6">
          <div className="rounded-[32px] border border-[#a76464]/24 bg-[#fff3f0] px-8 py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d4040]">
              Admin Error
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[#2c2218]">
              Nu am putut incarca adminul
            </h1>
            <p className="mt-3 max-w-[420px] text-sm leading-relaxed text-[#2c2218]/62">
              {message || 'Panoul de admin nu a putut incarca continutul din serverul local.'}
            </p>
            <a
              href="/"
              className={`mt-6 inline-flex h-11 items-center ${ADMIN_SECONDARY_BUTTON_CLASS}`}
            >
              Inapoi pe site
            </a>
          </div>
        </div>
      </div>
    );
  }

  const activeSectionMeta = ADMIN_SECTION_META[activeSection];
  const finalIsReadonlySection = Boolean(activeSectionMeta.readOnly) || activeSection === 'galleries' || activeSection === 'products';

  return (
    <div className="grain-bg relative min-h-screen overflow-x-clip bg-[#e8e0d6] text-[#2c2218]">
      <div className="grain-overlay" />
      <div className="relative z-[60] mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-[#2c2218]/10 bg-[#efe7dc]/88 px-5 py-6 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-hidden lg:border-b-0 lg:border-r lg:px-6 lg:py-8">
          <div className="flex items-center justify-between gap-4 lg:block lg:shrink-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b38b60]">
                IV Concept Admin
              </p>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.06em] text-[#2c2218]">
                Editor Continut Site
              </h1>
              <p className="mt-3 max-w-[240px] text-sm leading-relaxed text-[#2c2218]/55">
                Design inspirat direct din site, cu fiecare editor redenumit dupa sectiunea reala unde este folosit.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 lg:mt-6">
              <a
                href="/"
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Vezi site-ul
              </a>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className={ADMIN_DANGER_BUTTON_CLASS}
              >
                Logout
              </button>
            </div>
          </div>

          <nav className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:mt-8 lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:overflow-y-auto lg:pr-1">
            {SECTION_ORDER.map((sectionKey) => {
              const active = sectionKey === activeSection;
              const sectionMeta = ADMIN_SECTION_META[sectionKey];
              return (
                <button
                  key={sectionKey}
                  type="button"
                  onClick={() => setActiveSection(sectionKey)}
                  className={`flex items-start gap-3 rounded-[24px] border px-4 py-4 text-left transition ${
                    active
                      ? 'border-[#b38b60]/45 bg-[#f7efe4] text-[#2c2218] shadow-[0_14px_32px_rgba(44,34,24,0.08)]'
                      : 'border-[#2c2218]/10 bg-[#f9f3ea]/82 text-[#2c2218]/72 hover:border-[#b38b60]/28 hover:text-[#2c2218]'
                  }`}
                >
                  <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#b38b60]">
                    {String(SECTION_ORDER.indexOf(sectionKey) + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{sectionMeta.label}</span>
                    <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-[#2c2218]/42">
                      {sectionMeta.usage}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="px-4 py-5 md:px-6 md:py-6 lg:px-10 lg:py-8">
          <div className="rounded-[34px] border border-[#2c2218]/10 bg-[#f5ede2]/94 p-5 shadow-[0_24px_80px_rgba(44,34,24,0.08)] md:p-7">
            <div className="flex flex-col gap-5 border-b border-[#2c2218]/10 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b38b60]">
                  Sectiune activa
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] text-[#2c2218]">
                  {activeSectionMeta.label}
                </h2>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2c2218]/44">
                  Folosit in: {activeSectionMeta.usage}
                </p>
                <p className="mt-3 max-w-[640px] text-sm leading-relaxed text-[#2c2218]/55">
                  {activeSectionMeta.description}
                </p>
              </div>

              {!finalIsReadonlySection && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isDirty}
                  className={ADMIN_SECONDARY_BUTTON_CLASS}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isDirty || saveState === 'saving'}
                  className={ADMIN_PRIMARY_BUTTON_CLASS}
                >
                  {saveState === 'saving' ? 'Se salveaza...' : 'Salveaza schimbarile'}
                </button>
              </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              {!finalIsReadonlySection && (
              <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isDirty
                  ? 'border-[#b38b60]/30 bg-[#f3e7d8] text-[#8c6a49]'
                  : 'border-[#2c2218]/10 bg-[#fbf6f0] text-[#2c2218]/42'
              }`}>
                {isDirty ? 'Schimbari nesalvate' : 'Sincronizat'}
              </span>
              )}

              {message && (
                <span className={`text-sm ${
                  saveState === 'error' ? 'text-[#8d4040]' : 'text-[#2c2218]/58'
                }`}>
                  {message}
                </span>
              )}
            </div>

            <div className="mt-8">
              {activeSection === 'inquiries' ? (
                <InquiriesPanel />
              ) : activeSection === 'courseSubscribers' ? (
                <CourseSubscribersPanel />
              ) : activeSection === 'subscribers' ? (
                <NewsletterSubscribersPanel />
              ) : activeSection === 'galleries' ? (
                <GalleriesPanel />
              ) : activeSection === 'products' ? (
                <ProductsPanel />
              ) : activeSection === 'imageSection' ? (
                <ImageSectionEditor
                  value={draft.imageSection}
                  onChange={(nextValue) => handleChange(['imageSection'], nextValue as unknown as JsonValue)}
                />
              ) : (
                <FieldEditor
                  label={activeSection}
                  value={draft[activeSection] as unknown as JsonValue}
                  path={[activeSection]}
                  depth={0}
                  onChange={handleChange}
                  onAdd={handleAdd}
                  onDuplicate={handleDuplicate}
                  onRemove={handleRemove}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
