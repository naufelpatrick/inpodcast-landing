import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/contact.js';
function response() {
  const output = { code: 0, body: {} as unknown, headers: {} as Record<string, string> };
  const res = { setHeader: (key: string, value: string) => { output.headers[key] = value; }, status: (code: number) => { output.code = code; return res; }, json: (body: unknown) => { output.body = body; } };
  return { res, output };
}
test('contact rejects invalid submissions, methods and traps bots without sending mail', async () => {
  let result = response(); await handler({ method: 'GET' }, result.res); assert.equal(result.output.code, 405);
  result = response(); await handler({ method: 'POST', body: {} }, result.res); assert.equal(result.output.code, 400);
  result = response(); await handler({ method: 'POST', body: { company: 'bot' } }, result.res); assert.equal(result.output.code, 200);
});
test('valid contact safely builds the existing email payload (mock transport, no real email)', async () => {
  const fetchOriginal = globalThis.fetch, key = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'mock-key';
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.to, ['inpodcast@inpodcast.com.br']);
    assert.equal(body.reply_to, 'test@example.com');
    assert.ok(body.html.includes('&lt;teste&gt;')); assert.ok(!body.html.includes('<teste>'));
    return Response.json({ id: 'mock' });
  };
  try {
    const result = response();
    await handler({ method: 'POST', body: { name: '<teste>', email: 'test@example.com', whatsapp: '47999999999', message: 'Teste local' } }, result.res);
    assert.equal(result.output.code, 200);
  } finally { globalThis.fetch = fetchOriginal; if (key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = key; }
});
