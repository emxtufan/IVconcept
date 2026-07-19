import seedContent from '../supabase/siteContentSeed.js';
import type { SiteContent } from '../src/types/siteContent.js';
import { supabaseAdmin, supabasePublic } from './supabase.js';

interface SiteContentRow {
  id: number;
  key: string;
  content: unknown;
  created_at: string;
  updated_at: string;
}

interface GalleryRow {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

interface GalleryItemRow {
  id: number;
  gallery_id: number;
  url: string;
  filename: string;
  original_name: string;
  size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  sort_order: number;
  created_at: string;
}

export interface GalleryItemEntity {
  id: number;
  galleryId: number;
  url: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  createdAt: Date;
}

export interface GalleryEntity {
  id: number;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  items: GalleryItemEntity[];
}

export interface NewsletterSubscriberEntity {
  id: number;
  email: string;
  source: string;
  createdAt: Date;
}

export interface InquiryEntity {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  projectDetails: string;
  createdAt: Date;
  status: string;
  images: string[];
  gdprAccepted: boolean;
  gdprAcceptedAt: Date;
}

interface ProductCategoryRow {
  id: number; title: string; slug: string; image: string; created_at: string; updated_at: string;
}

interface ProductRow {
  id: number; category_id: number; title: string; description: string; price: string;
  dimensions: string; images: unknown; created_at: string; updated_at: string;
}

function mapProductRow(row: ProductRow) {
  return {
    id: Number(row.id),
    categoryId: Number(row.category_id),
    title: row.title,
    description: row.description,
    price: row.price,
    dimensions: row.dimensions,
    images: Array.isArray(row.images) ? row.images.filter((item): item is string => typeof item === 'string') : [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function fetchProducts(categoryIds: number[]) {
  if (!categoryIds.length) return new Map<number, ReturnType<typeof mapProductRow>[]>();
  const { data, error } = await getPublicClient().from('products')
    .select('id,category_id,title,description,price,dimensions,images,created_at,updated_at')
    .in('category_id', categoryIds).order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'Failed to load products from Supabase');
  const result = new Map<number, ReturnType<typeof mapProductRow>[]>();
  for (const row of (data ?? []) as ProductRow[]) {
    const product = mapProductRow(row);
    result.set(product.categoryId, [...(result.get(product.categoryId) ?? []), product]);
  }
  return result;
}

export async function listProductCategories() {
  const { data, error } = await getPublicClient().from('product_categories')
    .select('id,title,slug,image,created_at,updated_at').order('created_at', { ascending: true });
  throwIfSupabaseError(error, 'Failed to load product categories from Supabase');
  const rows = (data ?? []) as ProductCategoryRow[];
  const products = await fetchProducts(rows.map((row) => Number(row.id)));
  return rows.map((row) => ({
    id: Number(row.id), title: row.title, slug: row.slug, image: row.image,
    createdAt: new Date(row.created_at), updatedAt: new Date(row.updated_at),
    products: products.get(Number(row.id)) ?? [],
  }));
}

export async function getProductCategoryBySlug(slug: string) {
  const categories = await listProductCategories();
  return categories.find((category) => category.slug === slug) ?? null;
}

export async function createProductCategory(values: { title: string; slug: string; image: string }) {
  const { error } = await getAdminClient().from('product_categories').insert(values);
  throwIfSupabaseError(error, 'Failed to create product category');
}

export async function updateProductCategory(id: number, values: { title: string; slug: string; image: string }) {
  const { error } = await getAdminClient().from('product_categories').update(values).eq('id', id);
  throwIfSupabaseError(error, 'Failed to update product category');
}

export async function deleteProductCategory(id: number) {
  const { error } = await getAdminClient().from('product_categories').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete product category');
}

export async function createProduct(values: { categoryId: number; title: string; description: string; price: string; dimensions: string; images: string[] }) {
  const { error } = await getAdminClient().from('products').insert({
    category_id: values.categoryId, title: values.title, description: values.description,
    price: values.price, dimensions: values.dimensions, images: values.images,
  });
  throwIfSupabaseError(error, 'Failed to create product');
}

export async function updateProduct(id: number, values: { title: string; description: string; price: string; dimensions: string; images: string[] }) {
  const { error } = await getAdminClient().from('products').update(values).eq('id', id);
  throwIfSupabaseError(error, 'Failed to update product');
}

export async function deleteProduct(id: number) {
  const { error } = await getAdminClient().from('products').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete product');
}

function getPublicClient() {
  if (!supabasePublic) {
    throw new Error('Supabase public client is not configured.');
  }

  return supabasePublic;
}

function getAdminClient() {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client is not configured.');
  }

  return supabaseAdmin;
}

function unwrapContent(content: unknown) {
  if (typeof content === 'string') {
    return JSON.parse(content) as SiteContent;
  }

  return content as SiteContent;
}

function toSiteContentRow(data: SiteContentRow | null) {
  if (!data) {
    return null;
  }

  return {
    id: Number(data.id),
    key: data.key,
    content: unwrapContent(data.content),
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function mapGalleryItemRow(row: GalleryItemRow): GalleryItemEntity {
  return {
    id: Number(row.id),
    galleryId: Number(row.gallery_id),
    url: row.url,
    filename: row.filename,
    originalName: row.original_name,
    size: Number(row.size),
    mimeType: row.mime_type,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at),
  };
}

function mapGalleryRow(row: GalleryRow, items: GalleryItemEntity[]): GalleryEntity {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    items,
  };
}

function mapNewsletterSubscriber(row: {
  id: number;
  email: string;
  source: string;
  created_at: string;
}): NewsletterSubscriberEntity {
  return {
    id: Number(row.id),
    email: row.email,
    source: row.source,
    createdAt: new Date(row.created_at),
  };
}

function mapInquiry(row: {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  project_details: string;
  created_at: string;
  status: string;
  images: unknown;
  gdpr_accepted: boolean;
  gdpr_accepted_at: string;
}): InquiryEntity {
  return {
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    projectDetails: row.project_details,
    createdAt: new Date(row.created_at),
    status: row.status,
    images: Array.isArray(row.images) ? row.images.filter((item): item is string => typeof item === 'string') : [],
    gdprAccepted: row.gdpr_accepted,
    gdprAcceptedAt: new Date(row.gdpr_accepted_at),
  };
}

function throwIfSupabaseError(error: { message: string } | null, context: string) {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

async function fetchGalleryItemsByGalleryIds(galleryIds: number[]) {
  if (galleryIds.length === 0) {
    return new Map<number, GalleryItemEntity[]>();
  }

  const client = getPublicClient();
  const { data, error } = await client
    .from('gallery_items')
    .select('id,gallery_id,url,filename,original_name,size,mime_type,width,height,sort_order,created_at')
    .in('gallery_id', galleryIds)
    .order('gallery_id', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  throwIfSupabaseError(error, 'Failed to load gallery items from Supabase');

  const itemsByGallery = new Map<number, GalleryItemEntity[]>();

  for (const row of (data ?? []) as GalleryItemRow[]) {
    const item = mapGalleryItemRow(row);
    const collection = itemsByGallery.get(item.galleryId) ?? [];
    collection.push(item);
    itemsByGallery.set(item.galleryId, collection);
  }

  return itemsByGallery;
}

export async function getMainSiteContent() {
  const client = getPublicClient();
  const { data, error } = await client
    .from('site_content')
    .select('id,key,content,created_at,updated_at')
    .eq('key', 'main')
    .maybeSingle();

  throwIfSupabaseError(error, 'Failed to load site content from Supabase');

  const record = toSiteContentRow(data as SiteContentRow | null);

  if (record) {
    return record;
  }

  if (!supabaseAdmin) {
    return null;
  }

  const { data: seededRow, error: seedError } = await supabaseAdmin
    .from('site_content')
    .upsert(
      {
        key: 'main',
        content: seedContent,
      },
      {
        onConflict: 'key',
      },
    )
    .select('id,key,content,created_at,updated_at')
    .single();

  throwIfSupabaseError(seedError, 'Failed to seed site content in Supabase');

  return toSiteContentRow(seededRow as SiteContentRow);
}

export async function saveMainSiteContent(content: SiteContent) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('site_content')
    .upsert(
      {
        key: 'main',
        content,
      },
      {
        onConflict: 'key',
      },
    )
    .select('id,key,content,created_at,updated_at')
    .single();

  throwIfSupabaseError(error, 'Failed to save site content to Supabase');

  return toSiteContentRow(data as SiteContentRow);
}

export async function getGalleryBySlug(slug: string) {
  const client = getPublicClient();
  const { data, error } = await client
    .from('galleries')
    .select('id,name,slug,created_at,updated_at')
    .eq('slug', slug)
    .maybeSingle();

  throwIfSupabaseError(error, 'Failed to load gallery by slug from Supabase');

  if (!data) {
    return null;
  }

  const galleryId = Number((data as GalleryRow).id);
  const itemsByGallery = await fetchGalleryItemsByGalleryIds([galleryId]);
  return mapGalleryRow(data as GalleryRow, itemsByGallery.get(galleryId) ?? []);
}

export async function listGalleries() {
  const client = getPublicClient();
  const { data, error } = await client
    .from('galleries')
    .select('id,name,slug,created_at,updated_at')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  throwIfSupabaseError(error, 'Failed to load galleries from Supabase');

  const galleryRows = (data ?? []) as GalleryRow[];
  const galleryIds = galleryRows.map((row) => Number(row.id));
  const itemsByGallery = await fetchGalleryItemsByGalleryIds(galleryIds);

  return galleryRows.map((row) => mapGalleryRow(row, itemsByGallery.get(Number(row.id)) ?? []));
}

export async function getGalleryById(id: number) {
  const client = getPublicClient();
  const { data, error } = await client
    .from('galleries')
    .select('id,name,slug,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  throwIfSupabaseError(error, 'Failed to load gallery from Supabase');

  if (!data) {
    return null;
  }

  const itemsByGallery = await fetchGalleryItemsByGalleryIds([id]);
  return mapGalleryRow(data as GalleryRow, itemsByGallery.get(id) ?? []);
}

export async function createGallery(name: string, slug: string) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('galleries')
    .insert({
      name,
      slug,
    })
    .select('id,name,slug,created_at,updated_at')
    .single();

  throwIfSupabaseError(error, 'Failed to create gallery in Supabase');

  return mapGalleryRow(data as GalleryRow, []);
}

export async function updateGallery(id: number, values: { name?: string; slug?: string }) {
  const client = getAdminClient();
  const payload: Record<string, string> = {};

  if (typeof values.name === 'string') {
    payload.name = values.name;
  }

  if (typeof values.slug === 'string') {
    payload.slug = values.slug;
  }

  const { data, error } = await client
    .from('galleries')
    .update(payload)
    .eq('id', id)
    .select('id,name,slug,created_at,updated_at')
    .single();

  throwIfSupabaseError(error, 'Failed to update gallery in Supabase');

  return data as GalleryRow;
}

export async function updateGalleryItemUrl(id: number, url: string) {
  const client = getAdminClient();
  const { error } = await client
    .from('gallery_items')
    .update({ url })
    .eq('id', id);

  throwIfSupabaseError(error, 'Failed to update gallery item URL in Supabase');
}

export async function deleteGallery(id: number) {
  const client = getAdminClient();
  const { error } = await client.from('galleries').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete gallery from Supabase');
}

export async function createGalleryItems(
  galleryId: number,
  files: Array<{
    url: string;
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    width: number | null;
    height: number | null;
    sortOrder: number;
  }>,
) {
  const client = getAdminClient();
  const { error } = await client.from('gallery_items').insert(
    files.map((file) => ({
      gallery_id: galleryId,
      url: file.url,
      filename: file.filename,
      original_name: file.originalName,
      size: file.size,
      mime_type: file.mimeType,
      width: file.width,
      height: file.height,
      sort_order: file.sortOrder,
    })),
  );

  throwIfSupabaseError(error, 'Failed to save gallery items to Supabase');
}

export async function getGalleryItemById(id: number) {
  const client = getPublicClient();
  const { data, error } = await client
    .from('gallery_items')
    .select('id,gallery_id,url,filename,original_name,size,mime_type,width,height,sort_order,created_at')
    .eq('id', id)
    .maybeSingle();

  throwIfSupabaseError(error, 'Failed to load gallery item from Supabase');

  if (!data) {
    return null;
  }

  const item = mapGalleryItemRow(data as GalleryItemRow);
  const gallery = await getGalleryById(item.galleryId);

  if (!gallery) {
    return null;
  }

  return {
    ...item,
    gallery,
  };
}

export async function deleteGalleryItem(id: number) {
  const client = getAdminClient();
  const { error } = await client.from('gallery_items').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete gallery item from Supabase');
}

export async function findNewsletterSubscriberByEmail(email: string) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('newsletter_subscribers')
    .select('id,email,source,created_at')
    .eq('email', email)
    .maybeSingle();

  throwIfSupabaseError(error, 'Failed to load newsletter subscriber from Supabase');

  return data ? mapNewsletterSubscriber(data as {
    id: number;
    email: string;
    source: string;
    created_at: string;
  }) : null;
}

export async function createNewsletterSubscriber(email: string, source: string) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('newsletter_subscribers')
    .insert({
      email,
      source,
    })
    .select('id,email,source,created_at')
    .single();

  throwIfSupabaseError(error, 'Failed to save newsletter subscriber to Supabase');

  return mapNewsletterSubscriber(data as {
    id: number;
    email: string;
    source: string;
    created_at: string;
  });
}

export async function listNewsletterSubscribers() {
  const client = getAdminClient();
  const { data, error } = await client
    .from('newsletter_subscribers')
    .select('id,email,source,created_at')
    .order('created_at', { ascending: false });

  throwIfSupabaseError(error, 'Failed to load newsletter subscribers from Supabase');

  return (data ?? []).map((row) =>
    mapNewsletterSubscriber(row as {
      id: number;
      email: string;
      source: string;
      created_at: string;
    }),
  );
}

export async function deleteNewsletterSubscriber(id: number) {
  const client = getAdminClient();
  const { error } = await client.from('newsletter_subscribers').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete newsletter subscriber from Supabase');
}

export interface CourseSubscriberEntity {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gdprAccepted: boolean;
  gdprAcceptedAt: Date;
  createdAt: Date;
}

function mapCourseSubscriber(row: {
  id: number; first_name: string; last_name: string; email: string; phone: string;
  gdpr_accepted: boolean; gdpr_accepted_at: string; created_at: string;
}): CourseSubscriberEntity {
  return {
    id: Number(row.id), firstName: row.first_name, lastName: row.last_name,
    email: row.email, phone: row.phone, gdprAccepted: row.gdpr_accepted,
    gdprAcceptedAt: new Date(row.gdpr_accepted_at), createdAt: new Date(row.created_at),
  };
}

const courseSubscriberColumns = 'id,first_name,last_name,email,phone,gdpr_accepted,gdpr_accepted_at,created_at';

export async function createCourseSubscriber(values: { firstName: string; lastName: string; email: string; phone: string }) {
  const { data, error } = await getAdminClient().from('course_subscribers').insert({
    first_name: values.firstName, last_name: values.lastName, email: values.email,
    phone: values.phone, gdpr_accepted: true,
  }).select(courseSubscriberColumns).single();
  throwIfSupabaseError(error, 'Failed to save course subscriber');
  return mapCourseSubscriber(data as Parameters<typeof mapCourseSubscriber>[0]);
}

export async function listCourseSubscribers() {
  const { data, error } = await getAdminClient().from('course_subscribers')
    .select(courseSubscriberColumns).order('created_at', { ascending: false });
  throwIfSupabaseError(error, 'Failed to load course subscribers');
  return (data ?? []).map((row) => mapCourseSubscriber(row as Parameters<typeof mapCourseSubscriber>[0]));
}

export async function deleteCourseSubscriber(id: number) {
  const { error } = await getAdminClient().from('course_subscribers').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete course subscriber');
}

export async function listInquiries() {
  const client = getAdminClient();
  const { data, error } = await client
    .from('inquiries')
    .select('id,first_name,last_name,email,phone,project_details,images,gdpr_accepted,gdpr_accepted_at,created_at,status')
    .order('created_at', { ascending: false });

  throwIfSupabaseError(error, 'Failed to load inquiries from Supabase');

  return (data ?? []).map((row) =>
    mapInquiry(row as {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      project_details: string;
      created_at: string;
      status: string;
      images: unknown;
      gdpr_accepted: boolean;
      gdpr_accepted_at: string;
    }),
  );
}

export async function createInquiry(values: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  projectDetails: string;
  status: string;
  images: string[];
}) {
  const client = getAdminClient();
  const { data, error } = await client
    .from('inquiries')
    .insert({
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email,
      phone: values.phone,
      project_details: values.projectDetails,
      status: values.status,
      images: values.images,
      gdpr_accepted: true,
    })
    .select('id,first_name,last_name,email,phone,project_details,images,gdpr_accepted,gdpr_accepted_at,created_at,status')
    .single();

  throwIfSupabaseError(error, 'Failed to save inquiry to Supabase');

  return mapInquiry(data as {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    project_details: string;
    created_at: string;
    status: string;
    images: unknown;
    gdpr_accepted: boolean;
    gdpr_accepted_at: string;
  });
}

export async function deleteInquiry(id: number) {
  const client = getAdminClient();
  const { error } = await client.from('inquiries').delete().eq('id', id);
  throwIfSupabaseError(error, 'Failed to delete inquiry from Supabase');
}
