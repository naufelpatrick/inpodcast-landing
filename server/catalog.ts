import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { showId } from '../src/episodes.js';
import type { Catalog, Episode } from '../src/episodes.js';
type RawEpisode = Omit<Episode, 'slug'>;
type Fetcher = typeof fetch;
export function slugify(title: string) {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'episodio';
}
export function mergeEpisodes(incoming: RawEpisode[], previous: Episode[]): Episode[] {
  const byId = new Map(previous.map(episode => [episode.id, episode]));
  const used = new Set(previous.map(episode => episode.slug));
  for (const episode of [...incoming].sort((a, b) => a.id.localeCompare(b.id))) {
    let slug = byId.get(episode.id)?.slug;
    if (!slug) {
      slug = slugify(episode.title);
      if (used.has(slug)) slug += `-${createHash('sha256').update(episode.id).digest('hex').slice(0, 10)}`;
      while (used.has(slug)) slug += '-2';
    }
    used.add(slug);
    byId.set(episode.id, { ...byId.get(episode.id), ...episode, slug });
  }
  // Preserve published URLs when the source temporarily omits an episode.
  return [...byId.values()].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate) || a.id.localeCompare(b.id));
}
async function request(url: string, init: RequestInit, fetcher: Fetcher) {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Fonte do catálogo respondeu HTTP ${response.status}`);
  return response;
}
type SpotifyItem = {
  id: string; name: string; description?: string; release_date: string; duration_ms?: number;
  external_urls: { spotify: string }; images: { url: string }[];
};
export async function fetchSpotifyEpisodes(fetcher: Fetcher = fetch): Promise<RawEpisode[]> {
  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) throw new Error('Credenciais Spotify indisponíveis');
  const tokenResponse = await request('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  }, fetcher);
  const { access_token: token } = await tokenResponse.json() as { access_token: string };
  if (!token) throw new Error('Token Spotify inválido');
  let next: string | null = `https://api.spotify.com/v1/shows/${showId}/episodes?market=BR&limit=50`;
  const visited = new Set<string>();
  const episodes: RawEpisode[] = [];
  while (next) {
    const url = new URL(next);
    if (url.origin !== 'https://api.spotify.com' || url.pathname !== `/v1/shows/${showId}/episodes` || visited.has(next)) throw new Error('Paginação Spotify inválida');
    visited.add(next);
    const response = await request(next, { headers: { Authorization: `Bearer ${token}` } }, fetcher);
    const page = await response.json() as { items: (SpotifyItem | null)[]; next: string | null };
    if (!Array.isArray(page.items)) throw new Error('Catálogo Spotify inválido');
    for (const item of page.items) {
      if (!item) continue;
      episodes.push({ id: item.id, title: item.name, description: item.description?.trim() || '',
        releaseDate: item.release_date, durationMs: item.duration_ms,
        thumbnail: item.images[0]?.url || '', spotifyUrl: item.external_urls.spotify });
    }
    next = page.next;
  }
  if (!episodes.length) throw new Error('Catálogo Spotify vazio');
  return episodes;
}
// Parse JSON only; never execute JavaScript from the public Creators page.
export function parseCreatorsState(html: string): Record<string, unknown> {
  const marker = 'window.__STATE__ = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('Links públicos do Spotify indisponíveis');
  const tail = html.slice(start + marker.length);
  let depth = 0, inString = false, escaped = false;
  for (let i = 0; i < tail.length; i++) {
    const char = tail[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return JSON.parse(tail.slice(0, i + 1));
  }
  throw new Error('Dados públicos do Spotify inválidos');
}
export function plainText(html: string) {
  const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ');
  const parser = new XMLParser({ ignoreAttributes: true, processEntities: true });
  const escaped = stripped.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&nbsp;/g, ' ');
  return String(parser.parse(`<text>${escaped}</text>`).text ?? '').replace(/\s+/g, ' ').trim();
}
export async function fetchRssEpisodes(fetcher: Fetcher = fetch): Promise<RawEpisode[]> {
  const [rssResponse, creatorsResponse] = await Promise.all([
    request('https://anchor.fm/s/fae1e4e8/podcast/rss', {}, fetcher),
    request('https://creators.spotify.com/pod/profile/inpodcastoficial', {}, fetcher),
  ]);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false });
  const channel = parser.parse(await rssResponse.text()).rss?.channel;
  if (channel?.title !== 'InPodcast' || !Array.isArray(channel.item)) throw new Error('RSS InPodcast inválido');
  const state = parseCreatorsState(await creatorsResponse.text());
  const creatorEpisodes = (state.episodePreview as { episodes?: { episodeId: string; spotifyUrl?: string; duration?: number }[] })?.episodes;
  if (!Array.isArray(creatorEpisodes)) throw new Error('Catálogo público Spotify inválido');
  const links = new Map(creatorEpisodes.map(item => [item.episodeId, item]));
  const episodes: RawEpisode[] = [];
  for (const item of channel.item) {
    const matched = links.get(String(item.link).split('-').at(-1)!);
    const spotifyUrl = matched?.spotifyUrl;
    const id = spotifyUrl?.match(/^https:\/\/open\.spotify\.com\/episode\/([a-zA-Z0-9]{22})$/)?.[1];
    if (!id || !spotifyUrl) throw new Error('Episódio RSS sem correspondência Spotify confirmada');
    const date = new Date(item.pubDate);
    if (!Number.isFinite(date.getTime())) throw new Error('Data RSS inválida');
    episodes.push({ id, title: item.title, description: plainText(item.description || ''),
      releaseDate: date.toISOString().slice(0, 10), durationMs: matched?.duration,
      thumbnail: item['itunes:image']?.['@_href'] || channel['itunes:image']?.['@_href'] || '', spotifyUrl });
  }
  if (!episodes.length) throw new Error('RSS vazio');
  return episodes;
}
export async function refreshCatalog(previous: Catalog, fetcher: Fetcher = fetch): Promise<Catalog> {
  let incoming: RawEpisode[], source = 'spotify';
  try { incoming = await fetchSpotifyEpisodes(fetcher); }
  catch { incoming = await fetchRssEpisodes(fetcher); source = 'rss'; }
  return { fetchedAt: new Date().toISOString(), source, episodes: mergeEpisodes(incoming, previous.episodes) };
}
