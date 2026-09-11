import { readFile, writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { mergeEpisodes, refreshCatalog } from '../server/catalog.js';
import type { Catalog, EpisodeVideo } from '../src/episodes.js';
export async function getCatalog(): Promise<Catalog> {
  const env = loadEnv('production', process.cwd(), '');
  for (const key of ['SPOTIFY_CLIENT_ID', 'SPOTIFY_CLIENT_SECRET', 'CATALOG_OFFLINE', 'CATALOG_REQUIRE_FRESH']) {
    if (process.env[key] === undefined && env[key]) process.env[key] = env[key];
  }
  const requireFresh = process.env.VERCEL === '1' || process.env.CATALOG_REQUIRE_FRESH === '1';
  if (requireFresh && process.env.CATALOG_OFFLINE === '1') throw new Error('Build de publicação não permite catálogo offline');
  let previous: Catalog = JSON.parse(await readFile('data/catalog.json', 'utf8'));
  if (process.env.CATALOG_OFFLINE !== '1') {
    // The public manifest preserves slugs assigned by preceding deployments.
    try {
      const response = await fetch('https://www.inpodcast.com.br/catalog.json', { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        const published = await response.json() as Catalog;
        if (published.episodes?.length) {
          for (const item of published.episodes) {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || !/^[a-zA-Z0-9]{22}$/.test(item.id)) throw new Error('Manifesto inválido');
          }
          previous = { ...previous, episodes: mergeEpisodes(previous.episodes, published.episodes) };
        }
      }
      else if (response.status !== 404) throw new Error('Manifesto publicado indisponível');
    } catch (error) {
      if (requireFresh) throw error;
      console.warn('Manifesto publicado indisponível; slugs do snapshot serão preservados.');
    }
    try { previous = await refreshCatalog(previous); }
    catch (error) {
      if (requireFresh) throw error;
      console.warn('Catálogo remoto indisponível; usando snapshot completo de', previous.fetchedAt);
    }
  }
  if (!previous.episodes.length) throw new Error('Build sem episódios não permitido');
  const videos: Record<string, EpisodeVideo> = JSON.parse(await readFile('data/videos.json', 'utf8'));
  for (const [id, video] of Object.entries(videos)) {
    if (!previous.episodes.some(item => item.id === id) || !/^[\w-]{11}$/.test(video.youtubeId) || !video.title || !video.description || !/^https:\/\//.test(video.thumbnail) || !Number.isFinite(Date.parse(video.uploadDate))) throw new Error(`Vídeo inválido para episódio ${id}`);
  }
  return { ...previous, episodes: previous.episodes.map(episode => ({ ...episode, video: videos[episode.id] })) };
}
if (process.argv.includes('--sync')) {
  const catalog = await getCatalog();
  await writeFile('data/catalog.json', JSON.stringify(catalog, null, 2) + '\n');
  console.log(`Snapshot atualizado: ${catalog.episodes.length} episódios (${catalog.source}).`);
}
