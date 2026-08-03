const SHOW_ID = "3RbSarPxUhlBXUKSnFpYrc";

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type SpotifyEpisode = {
  id: string;
  name: string;
  release_date: string;
  external_urls: { spotify: string };
  images: Array<{ url: string; width: number | null; height: number | null }>;
};

export default async function handler(_req: unknown, res: ApiResponse) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(503).json({
      error: "Spotify não configurado",
      episodes: [],
    });
  }

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) throw new Error("Falha na autenticação do Spotify");

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    const episodesResponse = await fetch(
      `https://api.spotify.com/v1/shows/${SHOW_ID}/episodes?market=BR&limit=3`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    if (!episodesResponse.ok) throw new Error("Falha ao buscar episódios");

    const data = (await episodesResponse.json()) as { items: SpotifyEpisode[] };
    const episodes = data.items.filter(Boolean).map((episode) => ({
      id: episode.id,
      title: episode.name,
      url: episode.external_urls.spotify,
      thumbnail: episode.images[0]?.url ?? "",
      releaseDate: episode.release_date,
    }));

    res.setHeader("Cache-Control", "s-maxage=900, stale-while-revalidate=3600");
    return res.status(200).json({ episodes });
  } catch {
    return res.status(502).json({
      error: "Não foi possível buscar os episódios do Spotify",
      episodes: [],
    });
  }
}
