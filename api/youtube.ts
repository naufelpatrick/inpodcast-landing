type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

export default async function handler(_req: unknown, res: ApiResponse) {
  const channelId = "UCG6eDm81-Tk9WcD4P8Dkr1Q";

  try {
    const feed = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    );

    const xml = await feed.text();

    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .slice(0, 3)
      .map((entry) => {
        const block = entry[1];

        const title = block.match(/<title>(.*?)<\/title>/)?.[1] ?? "";
        const videoId = block.match(/<yt:videoId>(.*?)<\/yt:videoId>/)?.[1] ?? "";

        return {
          title,
          videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        };
      });

    res.status(200).json(entries);
  } catch {
    res.status(500).json({ error: "Erro ao buscar vídeos" });
  }
}
