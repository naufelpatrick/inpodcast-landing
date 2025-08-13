import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Youtube,
  Linkedin,
  Instagram,
  Mail,
  Play,
  ChevronLeft,
  ChevronRight,
  FileText,
  Headphones,
} from "lucide-react";

// =====================
// App.tsx – InPodcast LP
// =====================
// ✔ Seções: Último Episódio, Episódios, Apresentadores, Contato
// ✔ Menu fixo, rodapé com redes
// ✔ Responsivo (Tailwind) + animações (framer-motion)
// ✔ Integração YouTube: usa API KEY embutida abaixo

// Caminho do logo (coloque o arquivo em `public/`)
const LOGO_SRC = "/in-logo-horizontal-branco.png";

// YouTube config (a chave foi solicitada pelo usuário para ficar inline)
const YOUTUBE_CONFIG = {
  API_KEY: "AIzaSyAPSTgz0entjo65ZGJbc7MzYijZaJ5f57Q",
  CHANNEL_HANDLE: "@inpodcastoficial",
  CHANNEL_ID: "UCG6eDm81-Tk9WcD4P8Dkr1Q",
  MAX_RESULTS: 24,
};

// Tipos simples
interface VideoItem {
  id: string;
  title: string;
  publishedAt: string;
  thumbnail?: string;
}

interface PresenterItem {
  name: string;
  bio: string;
  photo: string;
  linkedin: string;
}

async function resolveChannelIdByHandle(apiKey: string, handle: string): Promise<string> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("forHandle", handle.startsWith("@") ? handle : `@${handle}`);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Falha ao resolver CHANNEL_ID por handle");
  const data = await res.json();
  const id = data?.items?.[0]?.id as string | undefined;
  if (!id) throw new Error("CHANNEL_ID não encontrado para o handle informado");
  return id;
}

async function fetchChannelVideos(apiKey: string, channelId: string, max = 24): Promise<VideoItem[]> {
  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("order", "date");
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", String(Math.min(max, 50)));
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Falha ao buscar vídeos do canal");
  const data = await res.json();
  const videos: VideoItem[] = (data.items || [])
    .map((it: any) => ({
      id: it?.id?.videoId as string,
      title: it?.snippet?.title as string,
      publishedAt: it?.snippet?.publishedAt as string,
      thumbnail: it?.snippet?.thumbnails?.high?.url || it?.snippet?.thumbnails?.medium?.url,
    }))
    .filter((v: VideoItem) => v.id);
  return videos;
}

function formatDate(d?: string) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

const SOCIALS: { name: string; href: string; icon: React.ComponentType<any> }[] = [
  { name: "LinkedIn", href: "https://www.linkedin.com/company/intelimerk/", icon: Linkedin },
  { name: "Instagram", href: "https://www.instagram.com/inpodcast.oficial/", icon: Instagram },
  { name: "Spotify", href: "https://open.spotify.com/show/", icon: Headphones },
  { name: "YouTube", href: "https://www.youtube.com/@inpodcastoficial", icon: Youtube },
  { name: "Substack", href: "https://substack.com/", icon: FileText },
];

const PRESENTERS: PresenterItem[] = [
  {
    name: "Patrick Naufel (Flashão)",
    bio: "Professor, pesquisador e especialista em transformação digital e inovação.",
    photo: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1200&auto=format&fit=crop",
    linkedin: "https://www.linkedin.com/in/patricknaufel/",
  },
  {
    name: "Giovani Letti",
    bio: "Estrategista de mercado e tecnologia — coapresentador do InPodcast.",
    photo: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?q=80&w=1200&auto=format&fit=crop",
    linkedin: "https://www.linkedin.com/in/giovani-letti-1332a1/",
  },
];

export default function App() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const channelId = YOUTUBE_CONFIG.CHANNEL_ID || (await resolveChannelIdByHandle(YOUTUBE_CONFIG.API_KEY, YOUTUBE_CONFIG.CHANNEL_HANDLE));
        const vids = await fetchChannelVideos(YOUTUBE_CONFIG.API_KEY, channelId, YOUTUBE_CONFIG.MAX_RESULTS);
        if (!mounted) return;
        setVideos(vids);
        setLatestId(vids[0]?.id || null);
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar vídeos do YouTube");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <Navbar />
      <main className="pt-24">
        <HeaderHero />

        {/* Último Episódio */}
        <section id="ultimo-episodio" className="relative scroll-mt-24">
          <SectionHeader title="Último Episódio" subtitle="Assista agora o vídeo mais recente do nosso canal" />
          {error && <FallbackLatest />}
          {!error && latestId && (
            <div className="mx-auto max-w-5xl px-4">
              <ResponsiveYouTube videoId={latestId} />
            </div>
          )}
        </section>

        {/* Episódios */}
        <section id="episodios" className="relative scroll-mt-24">
          <SectionHeader title="Episódios" subtitle="Navegue pelos episódios em vídeo" />
          {videos.length > 0 ? (
            <div className="mx-auto max-w-6xl px-4">
              <EpisodesCarousel videos={videos} />
            </div>
          ) : (
            <div className="mx-auto max-w-6xl px-4">
              <EpisodesPlaceholder />
            </div>
          )}
        </section>

        {/* Apresentadores */}
        <section id="apresentadores" className="relative scroll-mt-24">
          <SectionHeader title="Apresentadores" subtitle="Quem comanda o InPodcast" />
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 md:grid-cols-2">
            {PRESENTERS.map((p, i) => (
              <motion.article
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 shadow-xl"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-neutral-800">
                  <img src={p.photo} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="space-y-2 p-6">
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="text-neutral-300">{p.bio}</p>
                  <a
                    href={p.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-800"
                  >
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="relative scroll-mt-24">
          <SectionHeader title="Contato" subtitle="Fale com a equipe do InPodcast" />
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <Mail className="mx-auto h-8 w-8" />
              <p className="mt-3 text-sm text-neutral-300">Nosso e‑mail</p>
              <a href="mailto:info@intelimerk.com" className="mt-1 inline-block text-lg font-medium text-white underline-offset-4 hover:underline">
                info@intelimerk.com
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-neutral-800/80">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-8 md:flex-row md:justify-between">
          <div className="text-sm text-neutral-400">© {new Date().getFullYear()} InPodcast • Todos os direitos reservados</div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {SOCIALS.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border border-neutral-800 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800"
                aria-label={s.name}
                title={s.name}
              >
                <s.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{s.name}</span>
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function Navbar() {
  const links = [
    { href: "#ultimo-episodio", label: "Último Episódio" },
    { href: "#episodios", label: "Episódios" },
    { href: "#apresentadores", label: "Apresentadores" },
    { href: "#contato", label: "Contato" },
  ];
  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-neutral-900 text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#top" className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="InPodcast" className="h-7 w-auto sm:h-8 md:h-9 lg:h-10 shrink-0" />
        </a>
        <nav className="flex items-center gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function HeaderHero() {
  return (
    <header id="top" className="relative isolate overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-balance bg-gradient-to-br from-white to-neutral-300 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl"
        >
          Ideias que movem mercado.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-3 max-w-2xl text-lg text-neutral-300"
        >
          InPodcast é o seu podcast sobre inteligência de mercado, inovação e estratégia — com conversas francas e aplicáveis.
        </motion.p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="#ultimo-episodio" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-neutral-900 hover:bg-neutral-200">
            <Play className="h-4 w-4" /> Assistir o último episódio
          </a>
          <a href="#episodios" className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-neutral-100 hover:bg-neutral-800">
            Ver todos os episódios
          </a>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-72 bg-[radial-gradient(1200px_1200px_at_50%_-20%,rgba(88,101,242,0.35),transparent_60%)]"/>
    </header>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-10">
      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.45 }}
        className="text-2xl font-bold text-white sm:text-3xl"
      >
        {title}
      </motion.h2>
      {subtitle && <p className="mt-1 text-neutral-300">{subtitle}</p>}
    </div>
  );
}

function ResponsiveYouTube({ videoId }: { videoId: string }) {
  return (
    <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-xl">
      <iframe
        className="absolute inset-0 h-full w-full"
        src={`https://www.youtube.com/embed/${videoId}`}
        title="YouTube video player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

function FallbackLatest() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
        <p className="text-neutral-300">Não foi possível carregar automaticamente o último episódio.</p>
        <a className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800" href="https://www.youtube.com/@inpodcastoficial/videos" target="_blank" rel="noreferrer">
          <Youtube className="h-4 w-4" /> Ver vídeos no YouTube
        </a>
      </div>
    </div>
  );
}

function EpisodesCarousel({ videos }: { videos: VideoItem[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  function scrollBy(delta: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }
  return (
    <div className="relative">
      <div className="absolute -left-3 top-1/2 hidden -translate-y-1/2 md:block">
        <button onClick={() => scrollBy(-480)} className="rounded-full border border-neutral-800 bg-neutral-900/70 p-2 hover:bg-neutral-800" aria-label="Anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 md:block">
        <button onClick={() => scrollBy(480)} className="rounded-full border border-neutral-800 bg-neutral-900/70 p-2 hover:bg-neutral-800" aria-label="Próximo">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`https://www.youtube.com/watch?v=${v.id}`}
            target="_blank"
            rel="noreferrer"
            className="group w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40 shadow hover:shadow-lg"
          >
            <div className="relative aspect-video w-full bg-neutral-800">
              {v.thumbnail ? (
                <img src={v.thumbnail} alt={v.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-neutral-400"><Play className="h-7 w-7" /></div>
              )}
            </div>
            <div className="space-y-1 p-4">
              <h4 className="line-clamp-2 text-sm font-medium text-white group-hover:underline">{v.title}</h4>
              <p className="text-xs text-neutral-400">{formatDate(v.publishedAt)}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function EpisodesPlaceholder() {
  const items = new Array(6).fill(0);
  return (
    <div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
        <p className="text-sm text-neutral-300">Conecte sua API do YouTube para exibir automaticamente o carrossel de episódios. Enquanto isso, você pode direcionar os visitantes ao canal:</p>
        <a href="https://www.youtube.com/@inpodcastoficial/videos" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
          <Youtube className="h-4 w-4" /> Abrir canal no YouTube
        </a>
      </div>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((_, i) => (
          <div key={i} className="w-72 shrink-0 overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/40">
            <div className="aspect-video w-full animate-pulse bg-neutral-800" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-800" />
              <div className="h-3 w-2/5 animate-pulse rounded bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
