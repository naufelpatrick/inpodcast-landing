import App from './App';
import { EpisodeDetail, EpisodeIndex, NotFound } from './EpisodePages';
import { episodePath } from './episodes';
import type { PageData } from './episodes';
export default function Page({ pathname, episodes }: PageData) {
  if (pathname === '/') return <App initialEpisodes={episodes} />;
  if (pathname === '/episodios') return <EpisodeIndex episodes={episodes} />;
  const episode = episodes.find(item => episodePath(item) === pathname);
  return episode ? <EpisodeDetail episode={episode} /> : <NotFound />;
}
