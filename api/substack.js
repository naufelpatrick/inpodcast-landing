// api/substack.js — Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  const url = req.query?.url;
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Parâmetro ?url inválido' });
  }
  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      },
    });
    if (!upstream.ok) return res.status(upstream.status).json({ error: `Upstream ${upstream.status}` });
    const xml = await upstream.text();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(xml);
  } catch {
    return res.status(500).json({ error: 'Falha ao buscar o feed no upstream' });
  }
}
