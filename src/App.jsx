import { useEffect, useRef, useState } from "react";
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
// App.jsx – InPodcast LP (JavaScript)
// =====================
// ✔ Seções: Último Episódio, Episódios, Apresentadores, Contato
// ✔ Menu fixo, rodapé com redes
// ✔ Responsivo (Tailwind) + animações (framer-motion)
// ✔ Integração YouTube: usa API KEY embutida abaixo

// Caminho do logo (coloque o arquivo em `public/`)
const LOGO_SRC = "/in-logo-horizontal-branco.png";

// Substack RSS (defina seu feed depois, ex.: "https://SEU.substack.com/feed")
const SUBSTACK_RSS_URL = "https://inpodcast.substack.com/feed";

// YouTube config (a chave foi solicitada pelo usuário para ficar inline)
const YOUTUBE_CONFIG = {
  API_KEY: "AIzaSyAPSTgz0entjo65ZGJbc7MzYijZaJ5f57Q",
  CHANNEL_HANDLE: "@inpodcastoficial",
  CHANNEL_ID: "UCG6eDm81-Tk9WcD4P8Dkr1Q",
  MAX_RESULTS: 24,
};

async function resolveChannelIdByHandle(apiKey, handle) {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "id");
  url.searchParams.set("forHandle", handle.startsWith("@") ? handle : `@${handle}`);
  url.searchParams.set("key", apiKey);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Falha ao resolver CHANNEL_ID por handle");
  const data = await res.json();
  const id = data?.items?.[0]?.id;
  if (!id) throw new Error("CHANNEL_ID não encontrado para o handle informado");
  return id;
}

async function fetchChannelVideos(apiKey, channelId, max = 24) {
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
  const videos = (data.items || [])
    .map((it) => ({
      id: it?.id?.videoId,
      title: it?.snippet?.title,
      publishedAt: it?.snippet?.publishedAt,
      thumbnail: it?.snippet?.thumbnails?.high?.url || it?.snippet?.thumbnails?.medium?.url,
    }))
    .filter((v) => v.id);
  return videos;
}

function formatDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

const SOCIALS = [
  { name: "LinkedIn", href: "https://www.linkedin.com/company/inpodcastoficial/", icon: Linkedin },
  { name: "Instagram", href: "https://www.instagram.com/inpodcast.oficial/", icon: Instagram },
  { name: "Spotify", href: "https://open.spotify.com/show/", icon: Headphones },
  { name: "YouTube", href: "https://www.youtube.com/@inpodcastoficial", icon: Youtube },
  { name: "Substack", href: "https://substack.com/", icon: FileText },
];

const PRESENTERS = [
  {
    name: "Patrick Naufel (Flashão)",
    bio: "Professor, pesquisador e especialista em transformação digital e inovação.",
    photo: "/1731084367538.jpeg",
    linkedin: "https://www.linkedin.com/in/naufelpatrick/",
  },
  {
    name: "Giovanni Letti",
    bio: "Estrategista de mercado e tecnologia — coapresentador do InPodcast.",
    photo: "/1752886107474.jpeg",
    linkedin: "https://www.linkedin.com/in/giovani-letti-1332a1/",
  },
];

// === Substack RSS helpers (robusto, sem throw em parse) ===
async function fetchSubstackArticles(rssUrl, max = 12) {
  const res = await fetch(rssUrl);
  if (!res.ok) throw new Error(`RSS HTTP ${res.status}`); // só erra em HTTP != 200
  const xmlText = await res.text();

  const norm = (u) => (u && u.startsWith("//") ? "https:" + u : u || "");
  const stripCdata = (s = "") => s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");

  // 1) Tenta DOMParser (RSS 2.0 / Atom)
  try {
    let xml = new DOMParser().parseFromString(xmlText, "application/xml");
    if (xml.querySelector("parsererror")) {
      xml = new DOMParser().parseFromString(xmlText, "text/xml");
    }
    if (!xml.querySelector("parsererror")) {
      // RSS 2.0
      let list = Array.from(xml.querySelectorAll("item")).map((item) => {
        const title = stripCdata(item.querySelector("title")?.textContent?.trim() || "");
        const link =
          (item.querySelector("link")?.textContent || "").trim() ||
          item.querySelector("guid")?.textContent?.trim() ||
          "#";
        const enclosure = item.querySelector("enclosure")?.getAttribute("url") || "";
        const media =
          item.querySelector("media\\:content")?.getAttribute("url") ||
          item.querySelector("media\\:thumbnail")?.getAttribute("url") ||
          "";
        const contentEncoded =
          item.querySelector("content\\:encoded")?.textContent ||
          item.querySelector("description")?.textContent ||
          "";
        const thumb = norm(enclosure || media || extractFirstImgSrc(contentEncoded));
        return { title, link, thumbnail: thumb };
      });

      // Atom fallback
      if (list.length === 0) {
        list = Array.from(xml.querySelectorAll("entry")).map((entry) => {
          const title = stripCdata(entry.querySelector("title")?.textContent?.trim() || "");
          const link = entry.querySelector("link")?.getAttribute("href") || "#";
          const content = entry.querySelector("content")?.textContent || entry.querySelector("summary")?.textContent || "";
          const thumb = norm(extractFirstImgSrc(content));
          return { title, link, thumbnail: thumb };
        });
      }

      console.log("Substack RSS items:", list.length);
      return list.slice(0, max); // pode ser [], e tudo bem
    }
  } catch {
    console.warn("DOMParser falhou, ativando fallback por regex.");
  }

  // 2) Fallback por regex (lê mesmo com XML “estranho”)
  const items = [];

  // RSS <item>...</item>
  const itemBlocks = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks.slice(0, max)) {
    const title = stripCdata(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const link =
      (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim() ||
      (block.match(/<guid>([\s\S]*?)<\/guid>/i)?.[1] || "").trim() ||
      "#";
    const content =
      block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
      block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
      "";
    const thumb = norm(extractFirstImgSrc(content));
    if (title) items.push({ title, link, thumbnail: thumb });
  }

  // Atom <entry>...</entry>
  if (items.length === 0) {
    const entryBlocks = xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];
    for (const block of entryBlocks.slice(0, max)) {
      const title = stripCdata(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
      const link = (block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "").trim() || "#";
      const content =
        block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
        "";
      const thumb = norm(extractFirstImgSrc(content));
      if (title) items.push({ title, link, thumbnail: thumb });
    }
  }

  console.log("Substack RSS (regex) items:", items.length);
  return items.slice(0, max); // pode ser [], e tudo bem
}
// Carrega artigos do Substack
useEffect(() => {
  let mounted = true;
  if (!SUBSTACK_RSS_URL) {
    setArticlesLoading(false);
    return () => { mounted = false; };
  }
  (async () => {
    setArticlesLoading(true);
    try {
      const endpoint = `/api/substack?url=${encodeURIComponent(SUBSTACK_RSS_URL)}&t=${Date.now()}`;
      console.log("Buscando RSS:", endpoint);
      const items = await fetchSubstackArticles(endpoint, 12);
      if (!mounted) return;
      setArticles(items);           // [] é válido
      setArticlesError(null);       // não mostra erro vermelho
    } catch (e) {
      if (!mounted) return;
      console.error("Erro RSS:", e);
      setArticlesError(e?.message || "Erro ao carregar artigos do Substack");
    } finally {
      if (mounted) setArticlesLoading(false);
    }
  })();
  return () => { mounted = false; };
}, []);

export default function App() {
  const [videos, setVideos] = useState([]);
  const [latestId, setLatestId] = useState(null);
  const [error, setError] = useState(null);
  const [articles, setArticles] = useState([]);
  const [articlesError, setArticlesError] = useState(null);
  const [articlesLoading, setArticlesLoading] = useState(true);

  // Carrega vídeos do YouTube
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const channelId = YOUTUBE_CONFIG.CHANNEL_ID || (await resolveChannelIdByHandle(YOUTUBE_CONFIG.API_KEY, YOUTUBE_CONFIG.CHANNEL_HANDLE));
        const vids = await fetchChannelVideos(YOUTUBE_CONFIG.API_KEY, channelId, YOUTUBE_CONFIG.MAX_RESULTS);
        if (!mounted) return;
        setVideos(vids);
        setLatestId(vids[0]?.id || null);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Erro ao carregar vídeos do YouTube");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Carrega artigos do Substack
  useEffect(() => {
    let mounted = true;
    if (!SUBSTACK_RSS_URL) {
      setArticlesLoading(false);
      return () => { mounted = false; };
    }
    (async () => {
      setArticlesLoading(true);
      try {
        const endpoint = `/api/substack?url=${encodeURIComponent(SUBSTACK_RSS_URL)}&t=${Date.now()}`; // evita cache
        console.log("Buscando RSS:", endpoint);
        const items = await fetchSubstackArticles(endpoint, 12);
        if (!mounted) return;
        setArticles(items);
        setArticlesError(null);
      } catch (e) {
        if (!mounted) return;
        console.error("Erro RSS:", e);
        setArticlesError(e?.message || "Erro ao carregar artigos do Substack");
      } finally {
        if (mounted) setArticlesLoading(false);
      }
    })();
    return () => { mounted = false; };
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
                <div className="space-y-2 p-6 text-center">
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  <p className="text-neutral-300">{p.bio}</p>
                  <a
                    href={p.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="mx-auto inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-800"
                  >
                    <Linkedin className="h-4 w-4" /> LinkedIn
                  </a>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Últimos Artigos */}
        <section id="artigos" className="relative scroll-mt-24">
          <SectionHeader title="Últimos Artigos" subtitle="Direto do nosso Substack" />
          <div className="mx-auto max-w-6xl px-4">
            {articlesLoading ? (
              <ArticlesPlaceholder />
            ) : articles.length > 0 ? (
              <ArticlesCarousel articles={articles} />
            ) : articlesError ? (
              <div className="rounded-xl border border-red-900 bg-red-950/50 p-4 text-center text-red-300">
                Não foi possível carregar o feed do Substack. Verifique a URL ou habilite o proxy <code>/api/substack</code> na Vercel.
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center text-neutral-300">
                Nenhum artigo encontrado no feed.
              </div>
            )}
          </div>
        </section>

        {/* Contato */}
        <section id="contato" className="relative scroll-mt-24">
          <SectionHeader title="Contato" subtitle="Fale com a equipe do InPodcast" />
          <div className="mx-auto max-w-3xl px-4">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <Mail className="mx-auto h-8 w-8" />
              <p className="mt-3 text-sm text-neutral-300">Nosso e-mail</p>
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
  const [open, setOpen] = useState(false);
  const links = [
    { href: "#ultimo-episodio", label: "Último Episódio" },
    { href: "#episodios", label: "Episódios" },
    { href: "#apresentadores", label: "Apresentadores" },
    { href: "#artigos", label: "Artigos" },
    { href: "#contato", label: "Contato" },
  ];
  return (
    <div className="fixed inset-x-0 top-0 z-[100] bg-neutral-900 text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="#top" className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="InPodcast" className="h-7 w-auto sm:h-8 md:h-9 lg:h-10 shrink-0" />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 md:flex">
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

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-neutral-800 p-2 md:hidden"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-controls="mobile-menu"
          aria-expanded={open}
        >
          {open ? (
            // Ícone X
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          ) : (
            // Ícone hambúrguer
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path fillRule="evenodd" d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm.75 4.5a.75.75 0 0 0 0 1.5h16.5a.75.75 0 0 0 0-1.5H3.75Z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      <div id="mobile-menu" className={`md:hidden ${open ? "block" : "hidden"} border-t border-neutral-800/80 bg-neutral-900`}>
        <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
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
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-balance bg-gradient-to-br from-white to-neutral-300 bg-clip-text text-4xl font-extrabold text-transparent sm:text-5xl"
        >
          IN pode ser o que você quiser.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="mt-3 max-w-2xl mx-auto text-lg text-neutral-300"
        >
          Um podcast sobre inteligência de mercado, inventividade e inovação. Conceitos, ferramentas, estudos de caso e algum humor ☺️ . Apresentado por Giovanni Letti e Patrick Naufel.
        </motion.p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="#ultimo-episodio" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-neutral-900 hover:bg-neutral-200">
            <Play className="h-4 w-4" /> Assistir o último episódio
          </a>
          <a href="#episodios" className="inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-neutral-100 hover:bg-neutral-800">
            Ver todos os episódios
          </a>
        </div>
      </div>
      
    </header>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-6 pt-10 text-center">
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

function ResponsiveYouTube({ videoId }) {
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
      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 text-center">
        <p className="text-neutral-300">Não foi possível carregar automaticamente o último episódio.</p>
        <a className="mt-4 inline-flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800" href="https://www.youtube.com/@inpodcastoficial/videos" target="_blank" rel="noreferrer">
          <Youtube className="h-4 w-4" /> Ver vídeos no YouTube
        </a>
      </div>
    </div>
  );
}

function EpisodesCarousel({ videos }) {
  const trackRef = useRef(null);
  function scrollBy(delta) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }
  return (
    <div className="relative isolate">
      <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 md:block z-30 pointer-events-none">
        <button onClick={() => scrollBy(-480)} className="pointer-events-auto rounded-full border border-neutral-800 bg-neutral-900/70 p-2 shadow-lg hover:bg-neutral-800" aria-label="Anterior">
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 md:block z-30 pointer-events-none">
        <button onClick={() => scrollBy(480)} className="pointer-events-auto rounded-full border border-neutral-800 bg-neutral-900/70 p-2 shadow-lg hover:bg-neutral-800" aria-label="Próximo">
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
            <div className="space-y-1 p-4 text-center">
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
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-center">
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

function ArticlesCarousel({ articles }) {
  const trackRef = useRef(null);
  function scrollBy(delta) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: "smooth" });
  }
  return (
    <div className="relative isolate">
      <div className="absolute left-2 top-1/2 hidden -translate-y-1/2 md:block z-30 pointer-events-none">
        <button onClick={() => scrollBy(-480)} className="pointer-events-auto rounded-full border border-neutral-200 bg-white/80 p-2 shadow-lg hover:bg-white">
          <ChevronLeft className="h-5 w-5 text-neutral-900" />
        </button>
      </div>
      <div className="absolute right-2 top-1/2 hidden -translate-y-1/2 md:block z-30 pointer-events-none">
        <button onClick={() => scrollBy(480)} className="pointer-events-auto rounded-full border border-neutral-200 bg-white/80 p-2 shadow-lg hover:bg-white">
          <ChevronRight className="h-5 w-5 text-neutral-900" />
        </button>
      </div>

      <div ref={trackRef} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {articles.map((a, idx) => (
          <a
            key={idx}
            href={a.link || "#"}
            target="_blank"
            rel="noreferrer"
            className="group w-72 shrink-0 snap-start overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow hover:shadow-lg"
          >
            <div className="relative aspect-[16/10] w-full bg-neutral-200">
              {a.thumbnail ? (
                <img src={a.thumbnail} alt={a.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full place-items-center text-neutral-500"><FileText className="h-7 w-7" /></div>
              )}
            </div>
            <div className="space-y-1 p-4 text-center">
              <h4 className="line-clamp-2 text-sm font-semibold group-hover:underline">{a.title}</h4>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ArticlesPlaceholder() {
  const items = new Array(6).fill(0);
  return (
    <div className="mt-1 flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((_, i) => (
        <div key={i} className="w-72 shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900">
          <div className="aspect-[16/10] w-full animate-pulse bg-neutral-200" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-5/6 animate-pulse rounded bg-neutral-200" />
            <div className="h-3 w-2/4 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}
