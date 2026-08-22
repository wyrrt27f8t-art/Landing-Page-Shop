const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PRODUKTE = ["MAFO CAR", "MAFO WALK", "Beide"];

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, produkt, company } = request.body || {};

  // Honeypot: real users never fill this in.
  if (company) {
    return response.status(200).json({ ok: true });
  }

  if (typeof name !== "string" || !name.trim()) {
    return response.status(400).json({ error: "Name fehlt." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return response.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }

  const cleanName = name.trim().slice(0, 200);
  const cleanEmail = email.trim().slice(0, 200);
  const cleanProdukt = PRODUKTE.includes(produkt) ? produkt : "nicht angegeben";

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  // Aus der Variablen zählt nur die Adresse. Der angezeigte Absendername gehört
  // zur Marke und soll für beide Produkte gleich sein, deshalb steht er hier.
  const fromEmail = `MAFO <${absenderAdresse()}>`;

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  const submittedAt = new Date().toISOString();

  try {
    // 1. Benachrichtigung an uns. Schlägt sie fehl, ist die Vorbestellung verloren –
    //    deshalb entscheidet nur sie über den Statuscode.
    const intern = await sendeMail(apiKey, {
      from: fromEmail,
      to: [toEmail],
      reply_to: cleanEmail,
      subject: `Neue Vorbestellung (${cleanProdukt}): ${cleanName}`,
      html: internerText({ cleanName, cleanEmail, cleanProdukt, submittedAt }),
    });

    if (!intern.ok) {
      console.error("Resend error (intern):", intern.status, intern.text);
      return response.status(502).json({ error: "E-Mail konnte nicht gesendet werden." });
    }

    // 2. Bestätigung an die interessierte Person. Nur ein Zusatz: Scheitert sie,
    //    ist die Vorbestellung trotzdem angekommen, also kein Fehler nach aussen.
    const bestaetigung = await sendeMail(apiKey, {
      from: fromEmail,
      to: [cleanEmail],
      reply_to: toEmail,
      subject: `Deine Reservierung ist da, ${vorname(cleanName)}`,
      html: bestaetigungsText({ cleanName, cleanProdukt }),
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

// Akzeptiert "Name <adresse>" ebenso wie eine blosse Adresse.
function absenderAdresse() {
  const roh = (process.env.MAFO_FROM_EMAIL || "noreply@mafo-pet.ch").trim();
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

function internerText({ cleanName, cleanEmail, cleanProdukt, submittedAt }) {
  return `
    <h2>Neue MAFO Vorbestellung</h2>
    <table cellpadding="6" cellspacing="0">
      <tr><td><strong>Produkt</strong></td><td>${escapeHtml(cleanProdukt)}</td></tr>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(cleanName)}</td></tr>
      <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(cleanEmail)}</td></tr>
      <tr><td><strong>Zeitpunkt</strong></td><td>${submittedAt}</td></tr>
    </table>
  `.trim();
}

function bestaetigungsText({ cleanName, cleanProdukt }) {
  const produktSatz =
    cleanProdukt === "Beide"
      ? "MAFO CAR und MAFO WALK"
      : cleanProdukt === "nicht angegeben"
        ? "MAFO"
        : cleanProdukt;

  return `
<div style="margin:0;padding:24px;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#17140f;border-radius:14px;overflow:hidden;">
    <div style="padding:28px 28px 0;">
      <p style="margin:0;font-size:15px;letter-spacing:0.18em;color:#c8945f;font-weight:600;">MAFO</p>
    </div>
    <div style="padding:20px 28px 32px;color:#f3ede1;">
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;font-weight:600;">
        Schön, bist du dabei.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d5cbba;">
        Hallo ${escapeHtml(vorname(cleanName))}, deine Reservierung für
        <strong style="color:#f3ede1;">${escapeHtml(produktSatz)}</strong> ist bei uns
        eingegangen. Wir haben deinen Platz in der ersten Serie notiert.
      </p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d5cbba;">
        Verfügbar ist ${escapeHtml(produktSatz)} ab <strong style="color:#f3ede1;">Herbst 2026</strong>.
        Wir melden uns rechtzeitig vorher bei dir – dann kannst du verbindlich bestellen.
        Bis dahin musst du nichts tun.
      </p>
      <div style="margin:24px 0;padding:14px 16px;background:#221c14;border-radius:8px;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:#ab9f8c;">
          Deine Reservierung ist <strong style="color:#f3ede1;">unverbindlich</strong>:
          keine Zahlung, keine Kaufpflicht. Du kannst sie jederzeit zurückziehen –
          eine kurze Antwort auf diese E-Mail genügt.
        </p>
      </div>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#d5cbba;">
        Herzlich<br>Dein MAFO Team
      </p>
    </div>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#8a8272;text-align:center;">
    MAFO Pet · Ausserdorfstrasse 22 · 8918 Unterlunkhofen · Schweiz<br>
    Du erhältst diese E-Mail, weil du dich auf mafo-pet.ch für eine Vorbestellung eingetragen hast.
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
