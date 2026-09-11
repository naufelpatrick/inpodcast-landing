import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchSpotifyEpisodes, mergeEpisodes, parseCreatorsState, plainText, slugify } from '../server/catalog.js';
import { episodeSchemas, safeJson, renderHead } from '../server/seo.js';
import type { Catalog, Episode } from '../src/episodes.js';
const catalog: Catalog = JSON.parse(await readFile('data/catalog.json', 'utf8'));
const first = catalog.episodes[0];
test('slugs normalize accents, punctuation and repeated whitespace', () => {
  assert.equal(slugify(' O Futuro "Disotimista"! '), 'o-futuro-disotimista');
  assert.equal(slugify('Educação, Inovação & Sociedade'), 'educacao-inovacao-sociedade');
});
test('published slugs survive title edits, removal and collisions', () => {
  const original: Episode = { ...first, id: 'a', title: 'Título', slug: 'titulo' };
  const result = mergeEpisodes([{ ...first, id: 'a', title: 'Novo título' }, { ...first, id: 'b', title: 'Título' }], [original]);
  assert.equal(result.find(e => e.id === 'a')?.slug, 'titulo');
  assert.match(result.find(e => e.id === 'b')!.slug, /^titulo-[a-f0-9]{10}$/);
  assert.equal(mergeEpisodes([], result).length, 2);
  assert.deepEqual(mergeEpisodes([...result].reverse(), result), result);
});
test('all real snapshot episodes have unique stable URLs and verified Spotify IDs', () => {
  assert.ok(catalog.episodes.length > 3);
  assert.equal(new Set(catalog.episodes.map(e => e.slug)).size, catalog.episodes.length);
  assert.equal(new Set(catalog.episodes.map(e => e.id)).size, catalog.episodes.length);
  for (const episode of catalog.episodes) {
    assert.match(episode.id, /^[a-zA-Z0-9]{22}$/);
    assert.equal(episode.spotifyUrl, `https://open.spotify.com/episode/${episode.id}`);
    assert.ok(episode.title && episode.description && episode.releaseDate);
  }
});
test('Spotify follows all pages with backend authorization and rejects hostile next URLs', async () => {
  const originalId = process.env.SPOTIFY_CLIENT_ID, originalSecret = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_ID = 'test-id'; process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
  const calls: string[] = [];
  const next = 'https://api.spotify.com/v1/shows/3RbSarPxUhlBXUKSnFpYrc/episodes?offset=50&limit=50';
  const item = { id: first.id, name: first.title, description: first.description, release_date: first.releaseDate, duration_ms: 1000, external_urls: { spotify: first.spotifyUrl }, images: [{ url: first.thumbnail }] };
  const mock: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url);
    if (url.includes('/api/token')) { assert.match(String((init?.headers as Record<string, string>).Authorization), /^Basic /); return Response.json({ access_token: 'mock-token' }); }
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer mock-token');
    return Response.json(url === next ? { items: [{ ...item, id: 'second' }], next: null } : { items: [item, null], next });
  };
  try {
    const episodes = await fetchSpotifyEpisodes(mock);
    assert.equal(episodes.length, 2); assert.equal(calls.length, 3);
    const hostile: typeof fetch = async input => Response.json(String(input).includes('/api/token') ? { access_token: 'mock-token' } : { items: [item], next: 'https://example.org/collect' });
    await assert.rejects(fetchSpotifyEpisodes(hostile), /Paginação Spotify inválida/);
  } finally {
    if (originalId === undefined) delete process.env.SPOTIFY_CLIENT_ID; else process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET; else process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
  }
});
test('public source is parsed as JSON without executing page scripts', () => {
  assert.deepEqual(parseCreatorsState('window.__STATE__ = {"text":"} escaped \\" quote","a":{"b":2}}; throw new Error();'), { text: '} escaped " quote', a: { b: 2 } });
  assert.throws(() => parseCreatorsState('window.__STATE__ = nope'), /inválidos/);
  assert.equal(plainText('<p>Educação &amp; tecnologia</p><script>alert(1)</script>'), 'Educação & tecnologia');
});
test('JSON-LD and hydration data cannot break out of a script', () => {
  const attack = '</script><script>alert(1)</script>';
  assert.ok(!safeJson({ attack }).includes('<'));
  assert.equal(JSON.parse(safeJson({ attack })).attack, attack);
  const head = renderHead({ pathname: `/episodios/${first.slug}`, episodes: [{ ...first, title: attack }] });
  assert.ok(!head.includes('<script>alert(1)'));
});
test('VideoObject is only generated for an explicitly supplied video', () => {
  assert.equal(episodeSchemas(first).length, 1);
  const result = episodeSchemas({ ...first, video: { youtubeId: 'testVideo12', title: 'Vídeo de teste', description: 'Descrição de teste', thumbnail: 'https://example.org/image.jpg', uploadDate: '2026-09-11T13:00:00Z' } });
  assert.equal(result[1]['@type'], 'VideoObject');
  assert.equal(result[1].embedUrl, 'https://www.youtube-nocookie.com/embed/testVideo12');
});
test('pagination errors never return a successful partial catalog', async () => {
  const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_ID = 'test'; process.env.SPOTIFY_CLIENT_SECRET = 'test';
  let calls = 0;
  const mock: typeof fetch = async () => {
    calls++;
    if (calls === 1) return Response.json({ access_token: 'test-token' });
    if (calls === 2) return Response.json({ items: [], next: 'https://api.spotify.com/v1/shows/3RbSarPxUhlBXUKSnFpYrc/episodes?offset=50' });
    return new Response('Rate limited', { status: 429 });
  };
  try { await assert.rejects(fetchSpotifyEpisodes(mock), /HTTP 429/); }
  finally {
    if (id === undefined) delete process.env.SPOTIFY_CLIENT_ID; else process.env.SPOTIFY_CLIENT_ID = id;
    if (secret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET; else process.env.SPOTIFY_CLIENT_SECRET = secret;
  }
});
