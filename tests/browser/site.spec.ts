import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Catalog } from '../../src/episodes';
const catalog: Catalog = JSON.parse(await readFile('dist/catalog.json', 'utf8'));
const chosen = catalog.episodes.find(e => e.slug === 'o-futuro-disotimista')!;

test('raw HTTP responses: SEO pages, assets, sitemap and true 404', async ({ request }) => {
  const routes: [string, number][] = [['/', 200], ['/episodios', 200], [`/episodios/${chosen.slug}`, 200], ['/episodios/episodio-inexistente', 404], ['/pagina-inexistente', 404], ['/robots.txt', 200], ['/sitemap.xml', 200], ['/og/inpodcast.jpg', 200]];
  for (const [path, status] of routes) { const response = await request.get(path); expect(response.status(), path).toBe(status); }
  const response = await request.get(`/episodios/${chosen.slug}`);
  const html = await response.text();
  expect(html).toContain('PodcastEpisode'); expect(html).toContain('rel="canonical"'); expect(html).toContain('O Futuro');
  const redirect = await request.get('/episodios/', { maxRedirects: 0 }); expect(redirect.status()).toBe(308);
});

test('no JavaScript: homepage content, all episodes, player and navigation remain present', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('InPodcast: conversas que não cabem em 50 minutos de aula');
  await expect(page.getByText('O InPodcast nasceu de uma inquietação', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Ver todos os episódios' }).click();
  await expect(page.locator('article')).toHaveCount(catalog.episodes.length);
  await page.getByRole('heading', { name: chosen.title, exact: true }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(chosen.title);
  await expect(page.locator('iframe.spotify-player')).toHaveAttribute('src', new RegExp(chosen.id));
  await context.close();
});

for (const width of [390, 768, 1440]) {
  test(`hydration, layout and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /hydrat|Minified React/.test(message.text())) errors.push(message.text()); });
    await page.route('**/api/spotify', route => route.fulfill({ json: { ...catalog, episodes: catalog.episodes } }));
    await page.goto('/');
    await expect(page.locator('iframe.spotify-player')).toHaveAttribute('src', new RegExp(catalog.episodes[0].id));
    await page.getByRole('link', { name: 'Sobre', exact: true }).click();
    await expect(page.locator('#sobre')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('link', { name: 'Apresentadores', exact: true }).click();
    await expect(page.locator('#hosts')).toBeVisible();
    await expect(page.locator('#hosts img').first()).toHaveAttribute('src', '/patrick-naufel.webp');
    await page.getByRole('link', { name: 'Episódios', exact: true }).click();
    await expect(page.locator('article')).toHaveCount(catalog.episodes.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('heading', { name: chosen.title, exact: true }).getByRole('link').click();
    await expect(page).toHaveTitle(`${chosen.title} | InPodcast`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({ path: `test-results/episode-${width}.png`, fullPage: true });
  });
}

test('form validates, submits the right fields and shows success/error without sending real mail', async ({ page }) => {
  await page.route('**/api/spotify', route => route.fulfill({ json: catalog }));
  await page.goto('/#contato');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  expect(await page.locator('input[name="name"]').evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  await page.getByLabel('Nome', { exact: true }).fill('Teste local');
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com');
  await page.getByLabel('WhatsApp', { exact: true }).fill('47999999999');
  await page.getByLabel('Mensagem', { exact: true }).fill('Teste sem envio real.');
  await page.route('**/api/contact', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toMatchObject({ name: 'Teste local', email: 'teste@example.com', company: '' });
    await route.fulfill({ status: 200, json: { ok: true } });
  });
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByRole('status')).toContainText('Mensagem enviada');
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('');
  await page.unroute('**/api/contact');
  await page.route('**/api/contact', route => route.fulfill({ status: 502, json: { error: 'Teste de falha' } }));
  await page.getByLabel('Nome', { exact: true }).fill('Teste local');
  await page.getByLabel('E-mail', { exact: true }).fill('teste@example.com');
  await page.getByLabel('WhatsApp', { exact: true }).fill('47999999999');
  await page.getByLabel('Mensagem', { exact: true }).fill('Teste de falha.');
  await page.getByRole('button', { name: 'Enviar mensagem' }).click();
  await expect(page.getByRole('status')).toContainText('Não foi possível enviar');
});

test('reduced motion leaves content visible and removes parallax', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/spotify', route => route.fulfill({ json: catalog }));
  await page.goto('/');
  await page.mouse.move(100, 100);
  await page.locator('#hosts').scrollIntoViewIfNeeded();
  await expect(page.locator('#hosts')).toBeVisible();
  const hero = await page.locator('.hero-content').evaluate(element => getComputedStyle(element).transform);
  expect(['none', 'matrix(1, 0, 0, 1, 0, 0)']).toContain(hero);
  await expect(page.locator('a[href="https://www.youtube.com/@inpodcastoficial"]').first()).toHaveAttribute('target', '_blank');
  await expect(page.locator('a[href="https://www.instagram.com/inpodcastoficial"]').first()).toHaveAttribute('target', '_blank');
});

test('new live episodes do not create broken internal links and feed failures retain static content', async ({ page }) => {
  const fresh = { ...catalog.episodes[0], id: 'new-episode-test', title: 'Episódio futuro de teste', slug: 'nao-publicado', spotifyUrl: 'https://open.spotify.com/episode/new-episode-test' };
  await page.route('**/api/spotify', route => route.fulfill({ json: { episodes: [fresh, ...catalog.episodes] } }));
  await page.goto('/');
  await expect(page.locator('.episode-card h3').first()).toContainText(fresh.title);
  await expect(page.locator('a[href="/episodios/nao-publicado"]')).toHaveCount(0);
  await page.unroute('**/api/spotify');
  await page.route('**/api/spotify', route => route.fulfill({ status: 502, json: { episodes: [] } }));
  await page.reload();
  await expect(page.locator('.episode-card h3').first()).toContainText(catalog.episodes[0].title);
});
