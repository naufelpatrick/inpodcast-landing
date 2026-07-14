import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import "./App.css";

const youtubeUrl = "https://www.youtube.com/@inpodcastoficial";
const instagramUrl = "https://www.instagram.com/inpodcastoficial";
const spotifyUrl = "https://open.spotify.com/show/3RbSarPxUhlBXUKSnFpYrc?si=58c4e82a946c4fd1";

type Episode = {
  title: string;
  videoId: string;
  url: string;
  thumbnail: string;
};

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.5 17.3a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.15a.75.75 0 1 1-.34-1.46c4.5-1.03 8.4-.57 11.5 1.32.35.22.46.68.24 1.04Zm1.45-3.22a.94.94 0 0 1-1.29.31c-3.2-1.97-8.1-2.54-11.9-1.39a.94.94 0 1 1-.55-1.8c4.35-1.32 9.8-.68 13.43 1.54.44.27.58.85.31 1.29Zm.12-3.35C15.23 8.45 8.9 8.24 5.24 9.35a1.13 1.13 0 1 1-.66-2.16c4.2-1.28 11.2-1.03 15.65 1.61a1.13 1.13 0 0 1-1.16 1.93Z" />
    </svg>
  );
}

function App() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [formStatus, setFormStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroContentParallax = useTransform(scrollY, [0, 900], [0, reduceMotion ? 0 : 110]);
  const heroCardParallax = useTransform(scrollY, [0, 900], [0, reduceMotion ? 0 : 230]);
  const stripParallax = useTransform(scrollY, [500, 3000], [reduceMotion ? "0%" : "8%", reduceMotion ? "0%" : "-32%"]);

  const latestEpisode = episodes[0];

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 26;
      const y = (event.clientY / window.innerHeight - 0.5) * 26;
      setOffset({ x, y });
    };

    window.addEventListener("mousemove", handleMouseMove);

    fetch("/api/youtube")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEpisodes(data);
      })
      .catch(() => setEpisodes([]));

    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus("sending");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Falha no envio");
      form.reset();
      setFormStatus("success");
    } catch {
      setFormStatus("error");
    }
  };

  return (
    <main className="site">
      <section className="hero">
        <div
          className="orb orb-one"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        />
        <div
          className="orb orb-two"
          style={{ transform: `translate(${-offset.x}px, ${-offset.y}px)` }}
        />

        <nav className="nav">
          <a className="brand logo-brand" href="#">
            <img
              src="/in-logo-horizontal-branco.png"
              alt="InPodcast"
              className="logo"
            />
          </a>

          <div className="nav-links">
            <a href="#episodios">Episódios</a>
            <a href="#sobre">Sobre</a>
            <a href="#hosts">Apresentadores</a>
            <a href="#contato">Contato</a>
          </div>
        </nav>

        <div className="hero-grid">
          <motion.div className="hero-content" style={{ y: heroContentParallax }}>
            <p className="eyebrow">O podcast para mentes interessantes</p>

            <h1>
              Ideias, cultura e tecnologia para quem pensa diferente.
            </h1>

            <p className="hero-text">
              Conversas francas sobre inovação, mercado, comportamento, design,
              tecnologia e curiosidades que ajudam a enxergar o mundo por outros
              ângulos.
            </p>

            <div className="buttons">
              <a className="btn primary" href={youtubeUrl} target="_blank" rel="noreferrer">
                Assistir no YouTube
              </a>

              <a className="btn secondary" href={instagramUrl} target="_blank" rel="noreferrer">
                Ver cortes no Instagram
              </a>
            </div>

            <div className="stats">
              <div>
                <strong>🎙️</strong>
                <span>Conversas inteligentes</span>
              </div>

              <div>
                <strong>⚡</strong>
                <span>Temas atuais</span>
              </div>

              <div>
                <strong>🧠</strong>
                <span>Curiosidade aplicada</span>
              </div>
            </div>
          </motion.div>

          <motion.div className="hero-card real-episode-card" style={{ y: heroCardParallax }}>
            <div className="player-top">
              <span className="live-dot" />
              <p>Último episódio</p>
            </div>

            {latestEpisode ? (
              <>
                <a href={latestEpisode.url} target="_blank" rel="noreferrer" className="hero-thumb-link">
                  <img
                    src={latestEpisode.thumbnail}
                    alt={latestEpisode.title}
                    className="hero-thumbnail"
                  />
                </a>

                <h3>{latestEpisode.title}</h3>

                <p>
                  O episódio mais recente do canal, atualizado automaticamente
                  pelo YouTube.
                </p>

                <a href={latestEpisode.url} target="_blank" rel="noreferrer">
                  Assistir agora →
                </a>
              </>
            ) : (
              <>
                <div className="episode-loading">
                  <span>IN</span>
                  <strong>Podcast</strong>
                </div>

                <h3>Carregando último episódio...</h3>

                <p>
                  O episódio mais recente aparecerá aqui automaticamente.
                </p>

                <a href={youtubeUrl} target="_blank" rel="noreferrer">
                  Ir para o canal →
                </a>
              </>
            )}
          </motion.div>
        </div>
      </section>

      <motion.section
        className="listen-banner"
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        aria-label="Onde ouvir o InPodcast"
      >
        <div>
          <p className="listen-kicker">Dê o play</p>
          <h2>Assista. Escute. Inspire-se.</h2>
        </div>

        <div className="listen-actions">
          <a className="btn banner-btn" href={youtubeUrl} target="_blank" rel="noreferrer">
            <YouTubeIcon />
            Assista no YouTube
          </a>
          <a className="btn banner-btn outline" href={spotifyUrl} target="_blank" rel="noreferrer">
            <SpotifyIcon />
            Escute no Spotify
          </a>
        </div>
      </motion.section>

      <div className="parallax-strip" aria-hidden="true">
        <motion.p style={{ x: stripParallax }}>IDEIAS • CULTURA • TECNOLOGIA • CONVERSAS •</motion.p>
      </div>

      <section id="sobre" className="section split">
        <div>
          <p className="eyebrow">Sobre o InPodcast</p>
          <h2>Um espaço para boas perguntas antes das respostas prontas.</h2>
        </div>

        <p>
          O InPodcast é conduzido por Patrick Naufel e Giovani Letti. O programa
          conecta temas como inovação, inteligência de mercado, tecnologia,
          cultura, design e sociedade em conversas leves, provocativas e
          acessíveis.
        </p>
      </section>

      <section id="episodios" className="section">
        <div className="section-header">
          <div>
            <p className="eyebrow">Episódios</p>
            <h2>Últimos episódios</h2>
          </div>

          <a href={youtubeUrl} target="_blank" rel="noreferrer">
            Ver canal completo →
          </a>
        </div>

        <div className="cards">
          {episodes.length > 0 ? (
            episodes.map((episode, index) => (
              <article className="card episode-card" key={episode.videoId}>
                <img src={episode.thumbnail} alt={episode.title} />
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{episode.title}</h3>

                <a href={episode.url} target="_blank" rel="noreferrer">
                  Assistir episódio →
                </a>
              </article>
            ))
          ) : (
            <article className="card">
              <span>01</span>
              <h3>Carregando episódios...</h3>
              <p>Os vídeos do canal aparecerão aqui automaticamente.</p>
            </article>
          )}
        </div>
      </section>

      <section className="section feature">
        <div>
          <p className="eyebrow">Cortes e melhores momentos</p>
          <h2>Ideias curtas para circular mais longe.</h2>

          <p>
            Acompanhe os cortes do InPodcast no Instagram: trechos rápidos,
            provocativos e fáceis de compartilhar.
          </p>
        </div>

        <a className="btn primary" href={instagramUrl} target="_blank" rel="noreferrer">
          Seguir no Instagram
        </a>
      </section>

      <section id="hosts" className="section hosts">
        <div className="host">
          <p className="eyebrow">Apresentador</p>
          <h3>Patrick Naufel</h3>

          <p>
            Professor, pesquisador e especialista em design, inovação e
            transformação digital.
          </p>
        </div>

        <div className="host">
          <p className="eyebrow">Apresentador</p>
          <h3>Giovani Letti</h3>

          <p>
            Coapresentador do InPodcast e parceiro em conversas sobre ideias,
            cultura, mercado e tecnologia.
          </p>
        </div>
      </section>

      <section id="contato" className="section cta">
        <div className="contact-intro">
          <p className="eyebrow">Fale com o InPodcast</p>
          <h2>Tem uma pauta, ideia ou sugestão de convidado?</h2>
          <p>Entre em contato e ajude a construir as próximas conversas.</p>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Nome
              <input type="text" name="name" autoComplete="name" required />
            </label>
            <label>
              E-mail
              <input type="email" name="email" autoComplete="email" required />
            </label>
          </div>

          <label>
            WhatsApp
            <input type="tel" name="whatsapp" autoComplete="tel" required />
          </label>

          <label>
            Mensagem
            <textarea name="message" rows={6} required />
          </label>

          <input className="form-trap" type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <button className="btn primary" type="submit" disabled={formStatus === "sending"}>
            {formStatus === "sending" ? "Enviando..." : "Enviar mensagem"}
          </button>

          <p className={`form-feedback ${formStatus}`} role="status" aria-live="polite">
            {formStatus === "success" && "Mensagem enviada. Obrigado pelo contato!"}
            {formStatus === "error" && "Não foi possível enviar agora. Tente novamente em instantes."}
          </p>
        </form>
      </section>

      <footer>
        <strong>InPodcast</strong>
        <p>Ideias, cultura e tecnologia para mentes interessantes.</p>
      </footer>
    </main>
  );
}

export default App;
