import { EMAIL_RE, absenderAdresse, einzeilig, escapeHtml, sendeMail, text } from "./_bestellung.js";
import { willkommensCode } from "./_rabatt.js";

// Willkommensrabatt: Wer seine E-Mail-Adresse angibt, bekommt den Code per Mail.
// Da der Code an die eingegebene Adresse geht, ist die Adresse damit bestätigt.

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const body = request.body || {};
  if (body.mafo_falle) return response.status(200).json({ ok: true });

  const angebot = willkommensCode();
  if (!angebot) return response.status(503).json({ error: "Der Willkommensrabatt ist gerade nicht verfügbar." });

  const email = text(body.email, 200);
  if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Bitte gib eine gültige E-Mail-Adresse an.", feld: "email" });
  if (body.einwilligung !== true) return response.status(400).json({ error: "Bitte bestätige die Einwilligung.", feld: "einwilligung" });
  const sprache = ["de", "fr", "it", "en"].includes(body.sprache) ? body.sprache : "de";

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }
  const from = `MAFO <${absenderAdresse()}>`;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  const zeit = new Date().toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "long", timeStyle: "short" });
  try {
    const mail = await sendeMail(apiKey, {
      from,
      to: [email],
      reply_to: toEmail,
      subject: einzeilig(`Dein Willkommensrabatt: ${angebot.prozent} % bei MAFO`),
      html: `<p>Hallo und willkommen bei MAFO 🐾</p>
<p>Hier ist dein Code für <strong>${angebot.prozent} % Rabatt</strong> auf deine Bestellung:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:2px;padding:12px 18px;border:2px dashed #c8945f;display:inline-block">${escapeHtml(angebot.code)}</p>
<p>Gib ihn auf <a href="https://mafo-pet.ch">mafo-pet.ch</a> im Warenkorb ein.</p>
<p>Ab und zu schicken wir dir Neuigkeiten von MAFO. Möchtest du keine Mails mehr, antworte einfach mit «Abmelden».</p>
<p>Liebe Grüsse<br>MAFO · mafo-pet.ch</p>`,
    });
    if (!mail.ok) {
      console.error("Resend error (Willkommen):", mail.status, mail.text);
      return response.status(502).json({ error: "Die E-Mail konnte nicht gesendet werden. Bitte versuch es später nochmals." });
    }
    // Für unsere Liste: Adresse und Einwilligung festhalten
    const intern = await sendeMail(apiKey, {
      from,
      to: [toEmail],
      reply_to: email,
      subject: einzeilig(`Neue Anmeldung Willkommensrabatt: ${email}`),
      html: `<p>Neue Anmeldung für den Willkommensrabatt und Neuigkeiten.</p><p>E-Mail: ${escapeHtml(email)}<br>Sprache: ${sprache}<br>Einwilligung: ja (Kästchen angekreuzt)<br>Zeitpunkt: ${escapeHtml(zeit)}<br>Code verschickt: ${escapeHtml(angebot.code)}</p>`,
    });
    if (!intern.ok) console.error("Resend error (Willkommen intern):", intern.status, intern.text);
    return response.status(200).json({ ok: true });
  } catch (fehler) {
    console.error("Unerwarteter Fehler beim Willkommensrabatt:", fehler);
    return response.status(500).json({ error: "Unerwarteter Fehler." });
  }
}
