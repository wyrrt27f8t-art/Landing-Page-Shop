const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, nachricht, seite, sprache, company } = request.body || {};

  // Honeypot: echte Menschen füllen dieses Feld nie aus.
  if (company) {
    return response.status(200).json({ ok: true });
  }

  if (typeof nachricht !== "string" || nachricht.trim().length < 2) {
    return response.status(400).json({ error: "Nachricht fehlt." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return response.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }

  const sauber = {
    name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : "ohne Namen",
    email: email.trim().slice(0, 200),
    nachricht: nachricht.trim().slice(0, 4000),
    seite: typeof seite === "string" ? seite.slice(0, 200) : "unbekannt",
    sprache: ["de", "fr", "it", "en"].includes(sprache) ? sprache : "de",
  };

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  const fromEmail = `MAFO <${absenderAdresse()}>`;

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        // Antwort geht direkt an die Person, du kannst im Postfach einfach antworten.
        reply_to: sauber.email,
        subject: `💬 Chat-Nachricht von ${sauber.name}`,
        html: `
          <h2>Neue Nachricht über den Chat</h2>
          <p style="white-space:pre-wrap;border-left:3px solid #c8945f;padding-left:12px;margin:16px 0;">${escapeHtml(sauber.nachricht)}</p>
          <table cellpadding="6" cellspacing="0">
            <tr><td><strong>Name</strong></td><td>${escapeHtml(sauber.name)}</td></tr>
            <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(sauber.email)}</td></tr>
            <tr><td><strong>Seite</strong></td><td>${escapeHtml(sauber.seite)}</td></tr>
            <tr><td><strong>Sprache</strong></td><td>${escapeHtml(sauber.sprache)}</td></tr>
            <tr><td><strong>Zeitpunkt</strong></td><td>${new Date().toISOString()}</td></tr>
          </table>
          <p style="color:#666;font-size:13px;">Antworte einfach auf diese E-Mail – sie geht direkt an ${escapeHtml(sauber.email)}.</p>
        `.trim(),
      }),
    });

    if (!res.ok) {
      console.error("Resend error (Chat):", res.status, await res.text());
      return response.status(502).json({ error: "Nachricht konnte nicht gesendet werden." });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Unerwarteter Fehler beim Chat-Versand:", error);
    return response.status(500).json({ error: "Unerwarteter Fehler." });
  }
}

// Akzeptiert "Name <adresse>" ebenso wie eine blosse Adresse.
function absenderAdresse() {
  const roh = (process.env.MAFO_FROM_EMAIL || "noreply@mafo-pet.ch").trim();
  const inKlammern = roh.match(/<([^>]+)>/);
  return (inKlammern ? inKlammern[1] : roh).trim();
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
