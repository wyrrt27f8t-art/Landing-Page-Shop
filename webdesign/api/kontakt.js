const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PAKETE = [
  "Noch unklar – bitte beraten",
  "Start (CHF 1'200)",
  "Standard (CHF 2'200)",
  "Plus (CHF 3'500)",
  "Nur Betreuung einer bestehenden Seite",
];

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const { name, firma, email, telefon, paket, nachricht, website } = request.body || {};

  // Honeypot: echte Besucher füllen das Feld nie aus. Bots bekommen ein "ok"
  // und merken deshalb nicht, dass ihre Anfrage im Nichts gelandet ist.
  if (website) {
    return response.status(200).json({ ok: true });
  }

  if (typeof name !== "string" || !name.trim()) {
    return response.status(400).json({ error: "Name fehlt." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return response.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }

  const anfrage = {
    name: kurz(name, 200),
    firma: kurz(firma, 200) || "–",
    email: kurz(email, 200),
    telefon: kurz(telefon, 60) || "–",
    paket: PAKETE.includes(paket) ? paket : "nicht angegeben",
    nachricht: kurz(nachricht, 4000) || "–",
  };

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.KONTAKT_TO_EMAIL || "hallo@seitenwerk.ch";
  const fromEmail = `Seitenwerk <${absenderAdresse()}>`;

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  const eingegangen = new Date().toISOString();

  try {
    // 1. Benachrichtigung an mich. Schlägt sie fehl, ist die Anfrage verloren –
    //    deshalb entscheidet nur sie über den Statuscode.
    const intern = await sendeMail(apiKey, {
      from: fromEmail,
      to: [toEmail],
      reply_to: anfrage.email,
      subject: `Neue Anfrage (${anfrage.paket}): ${anfrage.name}`,
      html: internerText(anfrage, eingegangen),
    });

    if (!intern.ok) {
      console.error("Resend error (intern):", intern.status, intern.text);
      return response.status(502).json({ error: "E-Mail konnte nicht gesendet werden." });
    }

    // 2. Bestätigung an die anfragende Person. Nur ein Zusatz: Scheitert sie,
    //    ist die Anfrage trotzdem angekommen, also kein Fehler nach aussen.
    const bestaetigung = await sendeMail(apiKey, {
      from: fromEmail,
      to: [anfrage.email],
      reply_to: toEmail,
      subject: "Ihre Anfrage ist angekommen",
      html: bestaetigungsText(anfrage, toEmail),
    });

    if (!bestaetigung.ok) {
      console.error("Resend error (Bestätigung):", bestaetigung.status, bestaetigung.text);
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Unerwarteter Fehler beim Senden:", error);
    return response.status(500).json({ error: "Unerwarteter Fehler." });
  }
}

function kurz(wert, max) {
  return typeof wert === "string" ? wert.trim().slice(0, max) : "";
}

// Akzeptiert "Name <adresse>" ebenso wie eine blosse Adresse.
function absenderAdresse() {
  const roh = (process.env.KONTAKT_FROM_EMAIL || "noreply@seitenwerk.ch").trim();
  const inKlammern = roh.match(/<([^>]+)>/);
  return (inKlammern ? inKlammern[1] : roh).trim();
}

async function sendeMail(apiKey, payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, text: res.ok ? "" : await res.text() };
}

function internerText(a, eingegangen) {
  return `
    <h2>Neue Anfrage über seitenwerk.ch</h2>
    <table cellpadding="6" cellspacing="0">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(a.name)}</td></tr>
      <tr><td><strong>Betrieb</strong></td><td>${escapeHtml(a.firma)}</td></tr>
      <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(a.email)}</td></tr>
      <tr><td><strong>Telefon</strong></td><td>${escapeHtml(a.telefon)}</td></tr>
      <tr><td><strong>Interesse</strong></td><td>${escapeHtml(a.paket)}</td></tr>
      <tr><td><strong>Zeitpunkt</strong></td><td>${eingegangen}</td></tr>
    </table>
    <h3>Nachricht</h3>
    <p>${escapeHtml(a.nachricht).replace(/\n/g, "<br>")}</p>
  `.trim();
}

function bestaetigungsText(a, toEmail) {
  return `
<div style="margin:0;padding:24px;background:#f7f7f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e3dd;border-radius:14px;overflow:hidden;">
    <div style="padding:28px 28px 0;">
      <p style="margin:0;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#1e3fd8;font-weight:600;">Seitenwerk</p>
    </div>
    <div style="padding:16px 28px 32px;color:#0d0f12;">
      <h1 style="margin:0 0 18px;font-size:23px;line-height:1.25;font-weight:600;letter-spacing:-0.02em;">
        Ihre Anfrage ist angekommen.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#454d57;">
        Guten Tag ${escapeHtml(vorname(a.name))}, danke für Ihre Nachricht.
        Ich schaue sie mir an und melde mich <strong style="color:#0d0f12;">innert eines
        Arbeitstages</strong> bei Ihnen – per E-Mail oder Telefon, ganz wie es Ihnen passt.
      </p>
      <div style="margin:24px 0;padding:14px 16px;background:#f7f7f4;border-radius:8px;">
        <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#737b85;">Ihre Angaben:</p>
        <p style="margin:0;font-size:14px;line-height:1.7;color:#454d57;">
          <strong style="color:#0d0f12;">Interesse:</strong> ${escapeHtml(a.paket)}<br>
          <strong style="color:#0d0f12;">Betrieb:</strong> ${escapeHtml(a.firma)}
        </p>
      </div>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#454d57;">
        Freundliche Grüsse<br>Seitenwerk
      </p>
    </div>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#737b85;text-align:center;">
    Sie erhalten diese E-Mail, weil Sie das Kontaktformular auf seitenwerk.ch ausgefüllt haben.<br>
    Antworten geht direkt an ${escapeHtml(toEmail)}.
  </p>
</div>
  `.trim();
}

function vorname(name) {
  return name.split(/\s+/)[0];
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
