import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHtml, homeDescription, homeTitle } from '../server/seo.js';
import type { Catalog } from '../src/episodes.js';
const catalog: Catalog = JSON.parse(await readFile('dist/catalog.json', 'utf8'));
function schemas(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m => JSON.parse(m[1]));
}
test('homepage contains complete SEO and visible content in raw HTML', async () => {
  const html = await readFile('dist/index.html', 'utf8');
  assert.ok(html.includes('<html lang="pt-BR">'));
  assert.ok(html.includes(`<title>${homeTitle}</title>`));
  assert.ok(html.includes(`name="description" content="${homeDescription}"`));
  assert.ok(html.includes('rel="canonical" href="https://www.inpodcast.com.br/"'));
  for (const key of ['og:title', 'og:description', 'og:image', 'og:url', 'og:locale', 'twitter:card', 'twitter:title', 'twitter:image']) assert.ok(html.includes(`"${key}"`));
  assert.ok(html.includes('<h1>InPodcast: conversas que não cabem em 50 minutos de aula</h1>'));
  assert.ok(html.includes('O InPodcast nasceu de uma inquietação de sala de aula'));
  assert.equal(schemas(html)[0]['@type'], 'PodcastSeries');
  assert.ok(!html.includes('opacity:0'));
  assert.ok(!html.includes(':: @InPodcast ::'));
});
test('every episode is listed in static HTML, has its own metadata/schema and appears in sitemap', async () => {
  const index = await readFile('dist/episodios.html', 'utf8');
  const sitemap = await readFile('dist/sitemap.xml', 'utf8');
  assert.equal((sitemap.match(/<loc>/g) || []).length, catalog.episodes.length + 2);
  for (const episode of catalog.episodes) {
    const path = `/episodios/${episode.slug}`;
    assert.ok(index.includes(`href="${path}"`), path);
    assert.ok(sitemap.includes(`<loc>https://www.inpodcast.com.br${path}</loc>`), path);
    const html = await readFile(`dist${path}.html`, 'utf8');
    assert.ok(html.includes(`<title>${escapeHtml(episode.title)} | InPodcast</title>`), path);
    assert.ok(html.includes(`<h1>${escapeHtml(episode.title)}</h1>`), path);
    assert.ok(html.includes(`rel="canonical" href="https://www.inpodcast.com.br${path}"`), path);
    assert.equal(schemas(html)[0]['@type'], 'PodcastEpisode');
    assert.ok(html.includes(`embed/episode/${episode.id}`));
    assert.ok(html.includes('Giovani Letti') && html.includes('Patrick Naufel'));
  }
});
test('robots references sitemap and 404 page is noindex', async () => {
  assert.match(await readFile('dist/robots.txt', 'utf8'), /Sitemap: https:\/\/www.inpodcast.com.br\/sitemap.xml/);
  assert.match(await readFile('dist/404.html', 'utf8'), /noindex, follow/);
});
