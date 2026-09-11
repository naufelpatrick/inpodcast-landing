# InPodcast

Landing page e catálogo indexável do InPodcast, com Giovani Letti e Patrick Naufel.
React + TypeScript + Vite, publicado na Vercel. As APIs continuam em `api/`.

## Desenvolvimento e validação

Node 22.13+ (Vercel: Node 22), npm e Chromium para os testes de navegador.

```sh
npm ci
npm run dev
npm run build
npm run preview
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
```

`dev` usa SSR via Vite e recarregamento; `preview` serve somente o build e as APIs locais,
com URLs limpas e 404 real. Porta padrão: 5173 em desenvolvimento, 4173 em preview.
Ambos aceitam `--port` (por exemplo, `npm run preview -- --port 4180`).
Os testes do formulário usam transporte simulado: não enviam e-mail de verdade.

## HTML e rotas

`npm run build` verifica os tipos do frontend, APIs e scripts; atualiza o catálogo;
gera os bundles Vite de cliente e servidor; renderiza os mesmos componentes React para:

- `/` → `dist/index.html`
- `/episodios` → `dist/episodios.html`
- `/episodios/{slug}` → `dist/episodios/{slug}.html`
- `dist/404.html` para erros reais, com `noindex`

O HTML já contém conteúdo, imagens, links, metadados e JSON-LD. `hydrateRoot` adiciona
interações ao conteúdo existente. Os dados de hidratação são específicos da página,
serializados com escape seguro. A ausência de JavaScript não esconde as seções.
Animações de entrada são preparadas apenas após hidratação e respeitam reduced motion.
A página inicial mantém os três episódios recentes; `/episodios` contém o catálogo completo.

`server/seo.ts` centraliza canonical, titles, descriptions, Open Graph, Twitter Cards,
`PodcastSeries` e `PodcastEpisode`. `index.html` também tem os metadados base completos.
O build substitui esse bloco pelos metadados próprios de cada rota.

## Catálogo e atualização

1. Havendo `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` no backend, consulta a API Spotify
   com `limit=50`, seguindo todas as páginas de `next` (mercado BR).
2. Sem credenciais ou com falha da API, consulta o RSS oficial
   `https://anchor.fm/s/fae1e4e8/podcast/rss` e a página pública oficial
   `https://creators.spotify.com/pod/profile/inpodcastoficial`.
   A associação usa o identificador do episódio no link RSS e o `spotifyUrl` publicado
   pelo próprio Spotify. Nenhum ID de player é inferido pelo título.
3. `data/catalog.json` guarda um snapshot completo de segurança. Não é uma lista manual
   de episódios. Ele foi importado das fontes públicas (53 episódios na implementação).

`/api/spotify` retorna o catálogo completo com `id`, `slug`, `title`, `description`,
`releaseDate`, `durationMs` quando disponível, `thumbnail`, `spotifyUrl` e o antigo alias `url`.
Cache em memória e na CDN da Vercel por 15 minutos, com stale-while-revalidate de uma hora.
Erros de origem usam o último catálogo disponível, indicam `stale: true` e tentam novamente
em um minuto. Requisições simultâneas compartilham uma atualização por instância.
Credenciais são usadas somente em módulos de servidor, nunca em variáveis `VITE_*`.

**Cada build atualiza HTML, páginas e sitemap automaticamente.** A revalidação da API
não cria arquivos HTML em um deploy já publicado: novos episódios entram no catálogo
indexável no próximo build/deploy. A homepage pode exibir um episódio recém-chegado via
API, mas só adiciona link interno quando sua página existe naquele build.

Para atualizar o snapshot versionado sem criar páginas manualmente:

```sh
npm run catalog:sync
```

O script preserva slugs por ID, resolve colisões e mantém páginas anteriormente publicadas.
Durante builds online, `catalog.json` do último deploy também preserva slugs de episódios
adicionados após o snapshot. Não renomeie slugs manualmente sem criar redirecionamentos.
Para retirar deliberadamente um episódio publicado, será necessário ajustar o catálogo
persistido e definir o comportamento desejado para sua URL.

`CATALOG_OFFLINE=1 npm run build` usa o snapshot, para desenvolvimento sem rede.
`CATALOG_REQUIRE_FRESH=1 npm run build` exige fontes atualizadas. Na Vercel esse modo
é obrigatório por padrão, para impedir publicação acidental de um catálogo antigo
quando todas as fontes falharem. Localmente, falhas de rede produzem um aviso e usam o snapshot.
Não há automação de publicação habilitada por este código: a frequência dos builds deve
seguir o fluxo de publicação autorizado do projeto.

## Sitemap, robots e deploy

`public/robots.txt` permite crawling e aponta para `https://www.inpodcast.com.br/sitemap.xml`.
O sitemap é gerado do mesmo catálogo usado nas páginas, incluindo homepage, índice e
todos os episódios (55 URLs no snapshot inicial). Datas de modificação não são inventadas.

`vercel.json` mantém Vite, `npm run build`, saída `dist`, `cleanUrls: true` e
`trailingSlash: false`. Não existe rewrite curinga para a homepage: rotas desconhecidas
continuam retornando HTTP 404. As APIs serverless são preservadas.
Após um deploy autorizado, repetir os testes HTTP também no domínio de produção.

## Vídeo e imagens

`data/videos.json` é um mapa opcional de ID Spotify → dados de vídeo confirmados.
Sem entrada não há player YouTube nem `VideoObject` no episódio. A estrutura é:

```ts
type EpisodeVideo = {
  youtubeId: string;   // ID real de 11 caracteres, confirmado editorialmente
  title: string;       // título real do vídeo
  description: string;
  thumbnail: string;   // URL HTTPS real
  uploadDate: string;  // data/hora ISO real
};
```

O build valida as entradas antes de gerar o player e `VideoObject`. Não há associação
automática por similaridade de títulos. Os links gerais do canal YouTube são mantidos.

`public/og/inpodcast.jpg` é a capa oficial existente no RSS, sem alterações de arte.
Veja `public/og/README.md` para origem e orientação sobre a arte de compartilhamento.

As fotos originais dos hosts foram preservadas. `npm run images:optimize` gera versões
WebP de 800 px (qualidade 82) usadas com dimensões explícitas, lazy loading e decoding async.
Patrick: 2,6 MB → cerca de 59 KB; Giovani: 2,0 MB → cerca de 64 KB.

## Variáveis de ambiente

Veja `.env.example`. Os scripts locais carregam os arquivos `.env.*.local` usando Vite,
e a Vercel fornece as variáveis de ambiente do projeto. Nunca versione segredos.
Sem credenciais Spotify o catálogo funciona pelas fontes públicas oficiais.
O envio real do formulário continua dependendo de `RESEND_API_KEY` e do remetente válido;
os testes não precisam dessas credenciais.
