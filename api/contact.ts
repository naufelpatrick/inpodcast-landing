const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactRequest = {
  method?: string;
  body?: Record<string, unknown>;
};

type ContactResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ContactResponse;
  json: (body: unknown) => void;
};

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req: ContactRequest, res: ContactResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const name = clean(req.body?.name, 100);
  const email = clean(req.body?.email, 160);
  const whatsapp = clean(req.body?.whatsapp, 40);
  const message = clean(req.body?.message, 4000);
  const company = clean(req.body?.company, 100);

  // Honeypot: bots recebem sucesso sem disparar e-mail.
  if (company) return res.status(200).json({ ok: true });

  if (!name || !EMAIL_PATTERN.test(email) || !whatsapp || !message) {
    return res.status(400).json({ error: "Preencha todos os campos corretamente" });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: "Serviço de e-mail não configurado" });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM_EMAIL || "InPodcast <contato@inpodcast.com.br>",
      to: ["inpodcast@inpodcast.com.br"],
      reply_to: email,
      subject: `Contato pelo site — ${name}`,
      html: `
        <h2>Novo contato pelo site do InPodcast</h2>
        <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <p><strong>WhatsApp:</strong> ${escapeHtml(whatsapp)}</p>
        <p><strong>Mensagem:</strong></p>
        <p>${escapeHtml(message).replaceAll("\n", "<br>")}</p>
      `,
    }),
  });

  if (!response.ok) {
    return res.status(502).json({ error: "Falha ao enviar mensagem" });
  }

  return res.status(200).json({ ok: true });
}
