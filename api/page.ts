import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getProductCategoryBySlug } from '../server/supabaseStore.js';
import { createPageHandler } from '../server/pageHandler.js';

export default createPageHandler({
  loadHtml: () => readFile(path.join(process.cwd(), 'dist', 'index.html'), 'utf8'),
  findCategory: getProductCategoryBySlug,
});
