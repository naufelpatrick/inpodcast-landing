export const siteUrl = 'https://www.inpodcast.com.br';
export const showId = '3RbSarPxUhlBXUKSnFpYrc';
export const showUrl = `https://open.spotify.com/show/${showId}`;
export type EpisodeVideo = {
  youtubeId: string; title: string; description: string; thumbnail: string; uploadDate: string;
};
export type Episode = {
  id: string; slug: string; title: string; description: string; releaseDate: string;
  durationMs?: number; thumbnail: string; spotifyUrl: string; video?: EpisodeVideo;
};
export type Catalog = { fetchedAt: string; source: string; episodes: Episode[] };
export type PageData = { pathname: string; episodes: Episode[] };
export function episodePath(episode: Episode) { return `/episodios/${episode.slug}`; }
export function formatDate(value: string) {
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(`${value}-01T12:00:00Z`));
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}
export function summarize(text: string, maxLength = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength - 1);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (sentenceEnd >= maxLength * 0.6) return cut.slice(0, sentenceEnd + 1);
  const wordEnd = cut.lastIndexOf(' ');
  return `${cut.slice(0, wordEnd > 0 ? wordEnd : cut.length).replace(/[,;:]$/, '')}…`;
}
