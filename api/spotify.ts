import snapshot from '../data/catalog.json' with { type: 'json' };
import { refreshCatalog } from '../server/catalog.js';
import type { Catalog } from '../src/episodes.js';
type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};
let cached: Catalog = snapshot;
let expiresAt = 0;
let stale = false;
let inFlight: Promise<Catalog> | undefined;
export default async function handler(req: { method?: string }, res: ApiResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  if (Date.now() > expiresAt) {
    try {
      inFlight ??= refreshCatalog(cached);
      cached = await inFlight;
      stale = false;
      expiresAt = Date.now() + 15 * 60_000;
    } catch {
      stale = true;
      expiresAt = Date.now() + 60_000;
    } finally { inFlight = undefined; }
  }
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', `s-maxage=${stale ? 60 : 900}, stale-while-revalidate=3600`);
  res.setHeader('X-Catalog-Source', cached.source);
  return res.status(200).json({ ...cached, stale,
    episodes: cached.episodes.map(episode => ({ ...episode, url: episode.spotifyUrl })) });
}
