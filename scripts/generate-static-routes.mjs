import { readFile, writeFile, mkdir } from 'node:fs/promises';

// The public pages receive route-specific metadata at build time. The member
// portal and 404 fallback must never inherit the public landing page's indexing.
const dist = new URL('../dist/', import.meta.url);
const source = await readFile(new URL('index.html', dist), 'utf8');
if (!/<script[^>]+src="\/assets\//.test(source)) {
  throw new Error('Expected root-relative bundled assets for GitHub Pages nested routes');
}

const origin = 'https://rosefires.com';
const basePath = '/eclipse-order-dashboard';
const pages = [
  {
    route: '/',
    title: 'The Eclipse Order | FFXIV Garlean Roleplay FC',
    description: 'Discover The Eclipse Order, a Garlean-aligned Final Fantasy XIV roleplay free company. Explore New Cassia, our story, recruitment, and events.',
  },
  {
    route: '/venue',
    title: 'The Midnight Eclipse | FFXIV Roleplay Venue',
    description: 'Visit The Midnight Eclipse, the Eclipse Order’s Final Fantasy XIV roleplay venue in New Cassia. Discover venue information and events.',
  },
  {
    route: '/venue/menu',
    title: 'The Midnight Eclipse Menu | FFXIV RP Venue',
    description: 'Browse the food and drink menu at The Midnight Eclipse, the Eclipse Order’s Final Fantasy XIV roleplay venue.',
  },
  {
    route: '/venue/rules',
    title: 'The Midnight Eclipse Rules | FFXIV RP Venue',
    description: 'Read the rules and visitor expectations for The Midnight Eclipse, an Eclipse Order roleplay venue in Final Fantasy XIV.',
  },
  {
    route: '/venue/people',
    title: 'The Midnight Eclipse Staff | FFXIV RP Venue',
    description: 'Meet the characters and staff of The Midnight Eclipse, the Eclipse Order’s Final Fantasy XIV roleplay venue.',
  },
];

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
function replaceTag(html, matcher, tag) {
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace('</head>', `  ${tag}\n  </head>`);
}
function render({ title, description, canonical, indexable }) {
  let html = source;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = replaceTag(html, /<meta name="description"[^>]*>/, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta name="robots"[^>]*>/, `<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, nofollow'}" />`);
  html = replaceTag(html, /<link rel="canonical"[^>]*>/, canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : '');
  html = replaceTag(html, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${escapeHtml(title)}" />`);
  html = replaceTag(html, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${escapeHtml(description)}" />`);
  html = replaceTag(html, /<meta property="og:url"[^>]*>/, canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" />` : '');
  return html;
}

for (const page of pages) {
  const canonical = `${origin}${basePath}${page.route === '/' ? '/' : page.route + '/'}`;
  const path = page.route === '/' ? 'index.html' : `${page.route.slice(1)}/index.html`;
  await mkdir(new URL(page.route === '/' ? './' : `${page.route.slice(1)}/`, dist), { recursive: true });
  await writeFile(new URL(path, dist), render({ ...page, canonical, indexable: true }));
}

const privateHtml = render({
  title: 'Eclipse Order Member Portal',
  description: 'Private member access for The Eclipse Order.',
  canonical: '',
  indexable: false,
});
for (const route of ['portal', 'app']) {
  await mkdir(new URL(`${route}/`, dist), { recursive: true });
  await writeFile(new URL(`${route}/index.html`, dist), privateHtml);
}
await writeFile(new URL('404.html', dist), render({
  title: 'Page Not Found | The Eclipse Order',
  description: 'The requested Eclipse Order page could not be found.',
  canonical: '',
  indexable: false,
}));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(page => `  <url><loc>${origin}${basePath}${page.route === '/' ? '/' : page.route + '/'}</loc></url>`).join('\n')}\n</urlset>\n`;
await writeFile(new URL('sitemap.xml', dist), sitemap);
