export interface ProductRecord {
  id: number;
  categoryId: number;
  title: string;
  description: string;
  price: string;
  dimensions: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategoryRecord {
  id: number;
  title: string;
  slug: string;
  image: string;
  createdAt: string;
  updatedAt: string;
  products: ProductRecord[];
}

export function slugifyProductCategory(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
