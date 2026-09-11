import { episodePath, showUrl, siteUrl, summarize } from '../src/episodes.js';
import type { Episode, PageData } from '../src/episodes.js';
export const homeTitle = 'InPodcast com Giovani Letti e Patrick Naufel';
export const socialTitle = 'InPodcast — ideias que não cabem em 50 minutos de aula';
export const shortDescription = 'Podcast semanal com Giovani Letti e Patrick Naufel sobre inovação, tecnologia, design, cultura e comportamento.';
export const homeDescription = `${shortDescription} Ideias que não cabem em 50 minutos de aula.`;
export function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}
export function seriesSchema() {
  return { '@context': 'https://schema.org', '@type': 'PodcastSeries', name: 'InPodcast', url: `${siteUrl}/`,
    description: shortDescription, inLanguage: 'pt-BR',
    creator: [{ '@type': 'Person', name: 'Giovani Letti' }, { '@type': 'Person', name: 'Patrick Naufel' }],
    sameAs: ['https://www.youtube.com/@inpodcastoficial', 'https://www.instagram.com/inpodcastoficial', showUrl] };
}
export function episodeSchemas(episode: Episode) {
  const schemas: Record<string, unknown>[] = [{ '@context': 'https://schema.org', '@type': 'PodcastEpisode',
    name: episode.title, description: episode.description, datePublished: episode.releaseDate,
    url: siteUrl + episodePath(episode), inLanguage: 'pt-BR',
    partOfSeries: { '@type': 'PodcastSeries', name: 'InPodcast', url: `${siteUrl}/` },
    ...(episode.thumbnail ? { image: episode.thumbnail } : {}),
    ...(episode.durationMs ? { timeRequired: `PT${Math.round(episode.durationMs / 1000)}S` } : {}),
    sameAs: [episode.spotifyUrl],
  }];
  if (episode.video) schemas.push({ '@context': 'https://schema.org', '@type': 'VideoObject',
    name: episode.video.title, description: episode.video.description,
    thumbnailUrl: episode.video.thumbnail, uploadDate: episode.video.uploadDate,
    embedUrl: `https://www.youtube-nocookie.com/embed/${episode.video.youtubeId}`,
    url: `https://www.youtube.com/watch?v=${episode.video.youtubeId}` });
  return schemas;
}
export function renderHead(data: PageData) {
  const home = data.pathname === '/';
  const episode = data.episodes.find(item => episodePath(item) === data.pathname);
  const notFound = !home && data.pathname !== '/episodios' && !episode;
  const title = home ? homeTitle : episode ? `${episode.title} | InPodcast` : notFound ? 'Página não encontrada | InPodcast' : 'Todos os episódios | InPodcast';
  const description = home ? homeDescription : episode ? summarize(episode.description || `Ouça ${episode.title}, do InPodcast com Giovani Letti e Patrick Naufel.`) : 'Explore todos os episódios do InPodcast com Giovani Letti e Patrick Naufel sobre inovação, tecnologia, design, cultura, comportamento e sociedade.';
  const url = siteUrl + data.pathname;
  const image = episode?.thumbnail || `${siteUrl}/og/inpodcast.jpg`;
  const meta = (key: string, value: string, attribute = 'name') => `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`;
  const schemas = home ? [seriesSchema()] : episode ? episodeSchemas(episode) : [];
  return [`<title>${escapeHtml(title)}</title>`, meta('description', description),
    ...(notFound ? [meta('robots', 'noindex, follow')] : [`<link rel="canonical" href="${escapeHtml(url)}" />`]),
    meta('og:type', 'website', 'property'), meta('og:site_name', 'InPodcast', 'property'),
    meta('og:title', home ? socialTitle : title, 'property'), meta('og:description', home ? shortDescription : description, 'property'),
    meta('og:url', url, 'property'), meta('og:image', image, 'property'), meta('og:locale', 'pt_BR', 'property'),
    meta('twitter:card', 'summary_large_image'), meta('twitter:title', home ? socialTitle : title),
    meta('twitter:description', home ? shortDescription : description), meta('twitter:image', image),
    ...schemas.map(schema => `<script type="application/ld+json">${safeJson(schema)}</script>`),
  ].join('\n    ');
}
export function documentHtml(template: string, data: PageData, markup: string) {
  return template.replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, () => renderHead(data))
    .replace('<!--app-html-->', () => markup)
    .replace('<!--page-data-->', () => `<script id="page-data" type="application/json">${safeJson(data)}</script>`);
}
export function pageData(pathname: string, episodes: Episode[]): PageData {
  return { pathname, episodes: pathname === '/' ? episodes.slice(0, 3) : pathname === '/episodios' ? episodes : episodes.filter(item => episodePath(item) === pathname) };
}
export function sitemap(episodes: Episode[]) {
  const paths = ['/', '/episodios', ...episodes.map(episodePath)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${escapeHtml(siteUrl + path)}</loc></url>`).join('\n')}\n</urlset>\n`;
}
