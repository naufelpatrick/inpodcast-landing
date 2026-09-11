import sharp from 'sharp';
for (const name of ['patrick-naufel', 'giovani-letti']) {
  const result = await sharp(`public/${name}.png`).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(`public/${name}.webp`);
  console.log(`${name}.webp: ${result.width} × ${result.height}, ${Math.round(result.size / 1024)} KB`);
}
