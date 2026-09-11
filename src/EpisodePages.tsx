import { episodePath, formatDate, showUrl, summarize } from './episodes';
import type { Episode } from './episodes';

function Header() {
  return <nav className="nav" aria-label="Navegação principal">
    <a className="brand logo-brand" href="/" aria-label="InPodcast — início">
      <img src="/in-logo-horizontal-branco.png" alt="InPodcast" className="logo" width={1463} height={511} />
    </a>
    <div className="nav-links">
      <a href="/episodios">Episódios</a><a href="/#sobre">Sobre</a>
      <a href="/#hosts">Apresentadores</a><a href="/#contato">Contato</a>
    </div>
  </nav>;
}
function Footer() {
  return <footer><strong>InPodcast</strong><p>Com Giovani Letti e Patrick Naufel: ideias que não cabem em 50 minutos de aula.</p>
    <a href={showUrl} target="_blank" rel="noreferrer">Ouça no Spotify</a></footer>;
}
export function EpisodeIndex({ episodes }: { episodes: Episode[] }) {
  return <main className="site episode-site"><header className="episode-header"><Header />
    <p className="eyebrow">InPodcast • Giovani Letti e Patrick Naufel</p>
    <h1>Todos os episódios do InPodcast</h1>
    <p className="hero-text">Conversas que não cabem em 50 minutos de aula. Explore inovação, tecnologia, design, cultura, comportamento e sociedade.</p>
  </header>
    <section className="section episode-catalog" aria-label="Catálogo de episódios">
      <div className="cards">{episodes.map(episode => <article className="card episode-card" key={episode.id}>
        {episode.thumbnail && <a href={episodePath(episode)} tabIndex={-1} aria-hidden="true"><img src={episode.thumbnail} alt="" width={640} height={640} loading="lazy" decoding="async" /></a>}
        <h2><a href={episodePath(episode)}>{episode.title}</a></h2>
        <p><time dateTime={episode.releaseDate}>{formatDate(episode.releaseDate)}</time></p>
        {episode.description && <p>{summarize(episode.description, 230)}</p>}
        <div className="episode-links"><a href={episodePath(episode)}>Sobre o episódio →</a>
          <a href={episode.spotifyUrl} target="_blank" rel="noreferrer">Ouvir no Spotify ↗</a></div>
      </article>)}</div>
    </section><Footer />
  </main>;
}
export function EpisodeDetail({ episode }: { episode: Episode }) {
  return <main className="site episode-site"><header className="episode-header"><Header />
    <a className="back-link" href="/episodios">← Todos os episódios</a>
    <p className="eyebrow">InPodcast</p><h1>{episode.title}</h1>
    <p className="episode-meta"><time dateTime={episode.releaseDate}>{formatDate(episode.releaseDate)}</time>
      {episode.durationMs ? ` • ${Math.round(episode.durationMs / 60_000)} min` : ''}</p>
    <p className="hero-text">Com Giovani Letti e Patrick Naufel.</p>
  </header>
    <article className="section episode-detail">
      <div>{episode.thumbnail && <img className="episode-cover" src={episode.thumbnail} alt={`Capa: ${episode.title}`} width={640} height={640} fetchPriority="high" />}</div>
      <div className="episode-body"><h2>Sobre este episódio</h2>
        <p className="episode-description">{episode.description || 'Uma conversa do InPodcast com Giovani Letti e Patrick Naufel. Ouça o episódio completo no Spotify.'}</p>
        <iframe className="spotify-player" src={`https://open.spotify.com/embed/episode/${episode.id}?utm_source=generator&theme=0`}
          title={`Spotify: ${episode.title}`} width="100%" height="232" loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" />
        <a className="btn primary" href={episode.spotifyUrl} target="_blank" rel="noreferrer">Ouvir no Spotify</a>
        {episode.video && <section className="episode-video"><h2>Assista no YouTube</h2>
          <iframe src={`https://www.youtube-nocookie.com/embed/${episode.video.youtubeId}`} title={episode.video.title}
            width="560" height="315" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          <a href={`https://www.youtube.com/watch?v=${episode.video.youtubeId}`} target="_blank" rel="noreferrer">Abrir no YouTube ↗</a>
        </section>}
      </div>
    </article><Footer />
  </main>;
}
export function NotFound() {
  return <main className="site episode-site"><header className="episode-header"><Header />
    <p className="eyebrow">404</p><h1>Página não encontrada</h1>
    <p className="hero-text">Essa conversa não está neste endereço.</p><a className="btn primary" href="/episodios">Explorar episódios</a>
  </header><Footer /></main>;
}
