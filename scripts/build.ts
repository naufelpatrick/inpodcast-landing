import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { build } from 'vite';
import { getCatalog } from './catalog.js';
import { documentHtml, pageData, sitemap } from '../server/seo.js';
import { episodePath } from '../src/episodes.js';
import type { PageData } from '../src/episodes.js';
const catalog = await getCatalog();
await build();
await build({ build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr', emptyOutDir: true, copyPublicDir: false } });
const { render } = await import(pathToFileURL(resolve('dist-ssr/entry-server.js')).href) as { render: (data: PageData) => string };
const template = await readFile('dist/index.html', 'utf8');
await mkdir('dist/episodios', { recursive: true });
for (const pathname of ['/', '/episodios', ...catalog.episodes.map(episodePath), '/404']) {
  const data = pageData(pathname, catalog.episodes);
  const destination = pathname === '/' ? 'dist/index.html' : `dist${pathname}.html`;
  await writeFile(destination, documentHtml(template, data, render(data)));
}
await writeFile('dist/sitemap.xml', sitemap(catalog.episodes));
await writeFile('dist/catalog.json', JSON.stringify(catalog));
console.log(`HTML estático: homepage, catálogo, ${catalog.episodes.length} episódios e 404. Sitemap: ${catalog.episodes.length + 2} URLs.`);
