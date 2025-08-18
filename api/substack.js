// api/substack.js — Vercel Serverless Function (retorna JSON)
export default async function handler(req, res) {
  // CORS / preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  const url = req.query?.url;
  const max = Math.min(parseInt(req.query?.max || "12", 10) || 12, 50);

  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: "Parâmetro ?url inválido" });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
      },
      // evite cache agressivo do upstream
      cache: "no-store",
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    }

    const xml = await upstream.text();

    // Helpers
    const norm = (u) => (u && u.startsWith("//") ? "https:" + u : u || "");
    const stripCdata = (s = "") => s.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "");
    const extractFirstImgSrc = (html = "") => {
      const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      let src = m?.[1] || "";
      if (src && src.startsWith("//")) src = "https:" + src;
      return src;
    };

    const items = [];

    // 1) RSS <item>…</item>
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
    for (const block of itemBlocks) {
      const title = stripCdata(block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
      const link =
        (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim() ||
        (block.match(/<guid>([\s\S]*?)<\/guid>/i)?.[1] || "").trim() ||
        "#";
      const content =
        block.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
        block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ||
        "";
      const enclosure = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] || "";
      const media =
        block.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ||
        block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] ||
        "";
      const thumb = norm(enclosure || media || extractFirstImgSrc(content));
      if (title) items.push({ title, link, thumbnail: thumb });
      if (items.length >= max) break;
    }

    // 2) Atom <entry>…</entry> (se não achou itens RSS)
    if (items.length === 0) {
      const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
      for (const block of entryBlocks) {
        const title = stripCdata(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
        const link = (block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "").trim() || "#";
        const content =
          block.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
          block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
          "";
        const thumb = norm(extractFirstImgSrc(content));
        if (title) items.push({ title, link, thumbnail: thumb });
        if (items.length >= max) break;
      }
    }

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: "Falha ao buscar/parsear feed" });
  }
}
