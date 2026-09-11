import type { PageMetadata } from '../src/seo.js';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}

export function renderPageMetadata(html: string, metadata: PageMetadata) {
  let output = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(metadata.title)}</title>`);
  output = output.replace(/<html\s+lang="[^"]*"/i, '<html lang="ro"');
  const values: Record<string, string> = {
    description: metadata.description, robots: metadata.robots,
    'og:title': metadata.title, 'og:description': metadata.description, 'og:url': metadata.canonical,
    'og:locale': 'ro_RO', 'twitter:title': metadata.title, 'twitter:description': metadata.description,
  };
  if (metadata.image) {
    values['og:image'] = metadata.image;
    values['og:image:secure_url'] = metadata.image;
    values['twitter:image'] = metadata.image;
  }
  output = output.replace(/<meta\s+(name|property)="([^"]+)"\s+content="[^"]*"\s*\/?\s*>/gi, (tag, attribute, key) => (
    values[key] !== undefined ? `<meta ${attribute}="${key}" content="${escapeHtml(values[key])}" />` : tag
  ));
  return output.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/i, `<link rel="canonical" href="${escapeHtml(metadata.canonical)}" />`);
}
