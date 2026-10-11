import { EMAIL_RE, absenderAdresse, einzeilig, escapeHtml, sendeMail, text } from "./_bestellung.js";

// "Vertrag widerrufen" bzw. Rückgabe anmelden (rueckgabe.html / widerruf.html).
// Für Kundschaft in Deutschland und Österreich verlangt das EU-Recht eine solche
// Widerrufsfunktion samt Eingangsbestätigung auf einem dauerhaften Datenträger
// (E-Mail). Für die Schweiz gilt dieselbe freiwillige Rückgabe innert 14 Tagen.

const NUMMER_RE = /^MAFO-[A-HJ-NP-Z2-9]{6}$/;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const body = request.body || {};
  // Falle für Bots; bewusst kein Name, den der Browser automatisch ausfüllt
  if (body.mafo_falle) return response.status(200).json({ ok: true });

  const name = text(body.name, 120);
  const email = text(body.email, 200);
  const nummer = text(body.nummer, 20).toUpperCase().replace(/\s+/g, "");
  const artikel = text(body.artikel, 500);
  const erhalten = text(body.erhalten, 40);
  const nachricht = text(body.nachricht, 2000);

  if (name.length < 2) return response.status(400).json({ error: "Bitte gib deinen Namen an.", feld: "name" });
  if (!EMAIL_RE.test(email)) return response.status(400).json({ error: "Bitte gib eine gültige E-Mail-Adresse an.", feld: "email" });
  if (!NUMMER_RE.test(nummer)) return response.status(400).json({ error: "Bitte gib deine Bestellnummer an (MAFO-…).", feld: "nummer" });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }
  const zeitpunkt = new Date();
  const zeit = zeitpunkt.toLocaleString("de-CH", { timeZone: "Europe/Zurich", dateStyle: "long", timeStyle: "short" });
  const zeile = (k, v) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#666">${k}</td><td style="padding:4px 0">${escapeHtml(v)}</td></tr>` : "");
  const tabelle = `<table style="border-collapse:collapse;font-size:15px">${zeile("Bestellnummer", nummer)}${zeile("Name", name)}${zeile("E-Mail", email)}${zeile("Artikel", artikel || "alle Artikel der Bestellung")}${zeile("Erhalten am", erhalten)}${zeile("Nachricht", nachricht)}${zeile("Eingegangen", zeit)}</table>`;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  const from = `MAFO <${absenderAdresse()}>`;

  try {
    // 1. An uns: entscheidet über Erfolg
    const intern = await sendeMail(apiKey, {
      from,
      to: [toEmail],
      reply_to: email,
      subject: einzeilig(`Widerruf / Rückgabe ${nummer} – ${name}`),
      html: `<p><strong>Widerruf bzw. Rückgabe angemeldet</strong></p>${tabelle}<p>Bitte der Kundschaft die Rücksendung bestätigen und den Betrag nach Eingang der Ware innert 14 Tagen erstatten.</p>`,
    });
    if (!intern.ok) {
      console.error("Resend error (Widerruf intern):", intern.status, intern.text);
      return response.status(502).json({ error: "Die Meldung konnte nicht gesendet werden. Bitte schreib uns an info@mafo-pet.ch." });
    }
    // 2. Eingangsbestätigung an die Kundschaft
    const bestaetigung = await sendeMail(apiKey, {
      from,
      to: [email],
      reply_to: toEmail,
      subject: einzeilig(`Eingangsbestätigung: Widerruf / Rückgabe ${nummer}`),
      html: `<p>Hallo ${escapeHtml(name.split(/\s+/)[0])}</p>
<p>wir haben deinen Widerruf bzw. deine Rückgabe am <strong>${escapeHtml(zeit)}</strong> erhalten. Das sind deine Angaben:</p>${tabelle}
<p><strong>So geht es weiter:</strong> Schick die Ware bitte innert 14 Tagen an<br>Mafo Pet, Ausserdorfstrasse 22, 8918 Unterlunkhofen, Schweiz.<br>
Die Kosten für die Rücksendung trägst du (ausser bei einem Defekt oder einer falschen Lieferung). Sobald die Ware bei uns ist, erstatten wir dir den bezahlten Betrag inklusive der ursprünglichen Versandkosten über die gleiche Zahlungsart, spätestens 14 Tage nach dieser Meldung. Bei Vorauskasse schick uns bitte deine IBAN.</p>
<p>Fragen? Antworte einfach auf diese E-Mail.</p><p>Liebe Grüsse<br>MAFO · mafo-pet.ch</p>`,
    });
    if (!bestaetigung.ok) console.error("Resend error (Widerruf Bestätigung):", bestaetigung.status, bestaetigung.text);
    return response.status(200).json({ ok: true, zeit, bestaetigt: bestaetigung.ok });
  } catch (fehler) {
    console.error("Unerwarteter Fehler beim Widerruf:", fehler);
    return response.status(500).json({ error: "Unerwarteter Fehler. Bitte schreib uns an info@mafo-pet.ch." });
  }
}
