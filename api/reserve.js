import { randomInt } from "node:crypto";
import { bonusProzent, mitRabatt, normalerCode } from "./_rabatt.js";
import { ZAHLUNGSARTEN, zahlungsangaben, vollstaendig } from "./_zahlung.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Lieferländer, ihre Postleitzahlen und Versandkosten in Rappen (pauschal pro Bestellung)
const LAENDER = { CH: "Schweiz", DE: "Deutschland", AT: "Österreich" };
const VERSAND = { CH: 0, DE: 1200, AT: 1200 };
const PLZ_RE = { CH: /^\d{4}$/, AT: /^\d{4}$/, DE: /^\d{5}$/ };

// Preise in Rappen, inkl. Versand in die Schweiz; nach DE und AT kommt VERSAND
// dazu. Müssen mit der Website übereinstimmen; der Betrag in den Mails wird
// hier berechnet, nie aus dem Browser übernommen.
const ARTIKEL = [
  { feld: "anzahlCar", name: "MAFO", preis: 5900 },
  { feld: "anzahlWalk", name: "MAFO WALK", preis: 3990 },
];
const MAX_PRO_ARTIKEL = 10;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const body = request.body || {};

  // Honeypot: real users never fill this in.
  if (body.company) {
    return response.status(200).json({ ok: true });
  }

  const name = text(body.name, 200);
  const email = text(body.email, 200);
  const strasse = text(body.street, 200);
  const plz = text(body.zip, 10);
  const ort = text(body.city, 100);
  const land = (text(body.country, 2) || "CH").toUpperCase();

  if (!name) return response.status(400).json({ error: "Name fehlt." });
  if (!email || !EMAIL_RE.test(email)) {
    return response.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }
  if (!strasse) return response.status(400).json({ error: "Strasse fehlt." });
  if (!LAENDER[land]) return response.status(400).json({ error: "Ungültiges Land.", feld: "country" });
  if (!PLZ_RE[land].test(plz)) return response.status(400).json({ error: "Ungültige Postleitzahl." });
  if (!ort) return response.status(400).json({ error: "Ort fehlt." });

  const zahlungsart = text(body.zahlung, 20);
  if (!ZAHLUNGSARTEN[zahlungsart]) {
    return response.status(400).json({ error: "Ungültige Zahlungsart.", feld: "zahlung" });
  }
  if (zahlungsart === "twint" && land !== "CH") {
    return response.status(400).json({ error: "TWINT ist nur bei Lieferung in die Schweiz möglich.", feld: "zahlung" });
  }

  const positionen = [];
  for (const artikel of ARTIKEL) {
    const menge = leseMenge(body[artikel.feld]);
    if (menge === null) {
      return response.status(400).json({ error: "Ungültige Anzahl." });
    }
    if (menge > 0) positionen.push({ ...artikel, menge, summe: menge * artikel.preis });
  }
  if (positionen.length === 0) {
    return response.status(400).json({ error: "Kein Artikel gewählt." });
  }

  const zwischensumme = positionen.reduce((summe, p) => summe + p.summe, 0);

  // Bonuscode: ein falscher Code bricht ab, statt still den vollen Preis zu
  // verlangen, den die Kundschaft so nicht erwartet.
  const code = normalerCode(body.bonuscode);
  const prozent = code ? bonusProzent(code) : 0;
  if (code && !prozent) {
    return response.status(400).json({ error: "Ungültiger Bonuscode.", feld: "bonuscode" });
  }
  // Der Rabatt gilt für die Ware, nicht für den Versand
  const ware = prozent ? mitRabatt(zwischensumme, prozent) : zwischensumme;
  const rabatt = prozent ? { code, prozent, betrag: zwischensumme - ware } : null;
  const versand = VERSAND[land];
  const total = ware + versand;

  const nummer = bestellnummer();

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  // Aus der Variablen zählt nur die Adresse. Der angezeigte Absendername gehört
  // zur Marke und soll für beide Produkte gleich sein, deshalb steht er hier.
  const fromEmail = `MAFO <${absenderAdresse()}>`;

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  const zahlung = zahlungsangaben(zahlungsart);
  const bestellung = { nummer, name, email, strasse, plz, ort, land, positionen, zwischensumme, rabatt, versand, total, zahlung };
  const submittedAt = new Date().toISOString();
  const kurz = positionen.map((p) => `${p.menge}× ${p.name}`).join(", ");

  try {
    // 1. Benachrichtigung an uns. Schlägt sie fehl, ist die Bestellung verloren –
    //    deshalb entscheidet nur sie über den Statuscode.
    const intern = await sendeMail(apiKey, {
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `Neue Bestellung ${nummer}: ${kurz} – ${einzeilig(name)} (${ZAHLUNGSARTEN[zahlungsart]})`,
      html: internerText(bestellung, submittedAt),
    });

    if (!intern.ok) {
      console.error("Resend error (intern):", intern.status, intern.text);
      return response.status(502).json({ error: "E-Mail konnte nicht gesendet werden." });
    }

    // 2. Bestätigung an die Kundschaft. Nur ein Zusatz: Scheitert sie, ist die
    //    Bestellung trotzdem angekommen, also kein Fehler nach aussen.
    const bestaetigung = await sendeMail(apiKey, {
      from: fromEmail,
      to: [email],
      reply_to: toEmail,
      subject: `Deine Bestellung ${nummer} ist eingegangen, ${einzeilig(vorname(name))}`,
      html: bestaetigungsText(bestellung),
    });

    if (!bestaetigung.ok) {
      console.error("Resend error (Bestätigung):", bestaetigung.status, bestaetigung.text);
    }

    return response.status(200).json({ ok: true, nummer, total, zahlung });
  } catch (error) {
    console.error("Unerwarteter Fehler beim Senden:", error);
    return response.status(500).json({ error: "Unerwarteter Fehler." });
  }
}

/* ---------- Eingaben ---------- */

// Nur Text, zugeschnitten und gekürzt. Alles andere gilt als leer.
function text(wert, maxLaenge) {
  return typeof wert === "string" ? wert.trim().slice(0, maxLaenge) : "";
}

// Ganze Zahl von 0 bis MAX_PRO_ARTIKEL. Fehlt das Feld, gilt 0; alles
// Unlesbare ergibt null und damit eine Ablehnung.
function leseMenge(wert) {
  if (wert === undefined || wert === null || wert === "") return 0;
  const n = typeof wert === "number" ? wert : typeof wert === "string" ? Number(wert) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= MAX_PRO_ARTIKEL ? n : null;
}

// Ohne leicht verwechselbare Zeichen (0/O, 1/I), damit man sie am Telefon
// diktieren kann.
function bestellnummer() {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rest = "";
  for (let i = 0; i < 6; i++) rest += zeichen[randomInt(zeichen.length)];
  return `MAFO-${rest}`;
}

// Zeilenumbrüche haben in einem Betreff nichts verloren.
function einzeilig(wert) {
  return wert.replace(/[\r\n]+/g, " ");
}

/* ---------- Versand ---------- */

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

/* ---------- Mails ---------- */

function chf(rappen) {
  return `CHF ${(rappen / 100).toFixed(2)}`;
}

function internerText({ nummer, name, email, strasse, plz, ort, land, positionen, zwischensumme, rabatt, versand, total, zahlung }, submittedAt) {
  const artikel = positionen
    .map((p) => `${p.menge}× ${escapeHtml(p.name)} – ${chf(p.summe)}`)
    .join("<br>");

  return `
    <h2>Neue MAFO Bestellung ${escapeHtml(nummer)}</h2>
    <table cellpadding="6" cellspacing="0">
      <tr><td><strong>Bestellnummer</strong></td><td>${escapeHtml(nummer)}</td></tr>
      <tr><td valign="top"><strong>Artikel</strong></td><td>${artikel}</td></tr>
      ${
        rabatt
          ? `<tr><td><strong>Zwischensumme</strong></td><td>${chf(zwischensumme)}</td></tr>
      <tr><td><strong>Bonuscode</strong></td><td>${escapeHtml(rabatt.code)} (−${rabatt.prozent} %): −${chf(rabatt.betrag)}</td></tr>`
          : ""
      }
      <tr><td><strong>Versand</strong></td><td>${versand ? chf(versand) + " (" + escapeHtml(LAENDER[land]) + ", pauschal)" : "inklusive (Schweiz)"}</td></tr>
      <tr><td><strong>Total</strong></td><td>${chf(total)}</td></tr>
      <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(email)}</td></tr>
      <tr><td valign="top"><strong>Lieferadresse</strong></td><td>${escapeHtml(strasse)}<br>${escapeHtml(plz)} ${escapeHtml(ort)}<br>${escapeHtml(LAENDER[land])}</td></tr>
      <tr><td><strong>Zahlungsart</strong></td><td>${escapeHtml(ZAHLUNGSARTEN[zahlung.art])} – Zahlung ausstehend</td></tr>
      <tr><td><strong>Zeitpunkt</strong></td><td>${submittedAt}</td></tr>
    </table>
    ${
      vollstaendig(zahlung)
        ? "<p>Die Kundschaft hat die Zahlungsangaben mit der Bestätigung erhalten. Noch offen: Zahlungseingang prüfen, dann versenden und den Liefertermin nennen.</p>"
        : "<p><strong>Achtung:</strong> Für diese Zahlungsart sind in Vercel keine Zahlungsangaben hinterlegt (MAFO_IBAN bzw. MAFO_TWINT_NUMMER). Die Kundschaft wartet auf eine separate E-Mail mit den Angaben.</p>"
    }
  `.trim();
}

function bestaetigungsText({ nummer, name, strasse, plz, ort, land, positionen, rabatt, versand, total, zahlung }) {
  const zeilen = positionen
    .map(
      (p) => `
        <tr>
          <td style="padding:6px 0;font-size:15px;color:#f3ede1;">${p.menge}× ${escapeHtml(p.name)}</td>
          <td style="padding:6px 0;font-size:15px;color:#f3ede1;text-align:right;white-space:nowrap;">${chf(p.summe)}</td>
        </tr>`,
    )
    .join("");

  const rabattZeile = rabatt
    ? `
          <tr>
            <td style="padding:6px 0;font-size:15px;color:#c8945f;">Bonuscode ${escapeHtml(rabatt.code)} (−${rabatt.prozent} %)</td>
            <td style="padding:6px 0;font-size:15px;color:#c8945f;text-align:right;white-space:nowrap;">−${chf(rabatt.betrag)}</td>
          </tr>`
    : "";

  const versandZeile = versand
    ? `
          <tr>
            <td style="padding:6px 0;font-size:15px;color:#f3ede1;">Versand nach ${escapeHtml(LAENDER[land])}</td>
            <td style="padding:6px 0;font-size:15px;color:#f3ede1;text-align:right;white-space:nowrap;">${chf(versand)}</td>
          </tr>`
    : "";

  return `
<div style="margin:0;padding:24px;background:#f4f1ea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#17140f;border-radius:14px;overflow:hidden;">
    <div style="padding:28px 28px 0;">
      <p style="margin:0;font-size:15px;letter-spacing:0.18em;color:#c8945f;font-weight:600;">MAFO</p>
    </div>
    <div style="padding:20px 28px 32px;color:#f3ede1;">
      <h1 style="margin:0 0 18px;font-size:24px;line-height:1.25;font-weight:600;">
        Danke für deine Bestellung.
      </h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d5cbba;">
        Hallo ${escapeHtml(vorname(name))}, deine Bestellung
        <strong style="color:#f3ede1;">${escapeHtml(nummer)}</strong> ist bei uns eingegangen.
        Diese E-Mail bestätigt den Eingang.
      </p>
      <div style="margin:20px 0;padding:14px 16px;background:#221c14;border-radius:8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${zeilen}${rabattZeile}${versandZeile}
          <tr>
            <td style="padding:10px 0 0;border-top:1px solid #362c1e;font-size:15px;font-weight:600;color:#f3ede1;">Total</td>
            <td style="padding:10px 0 0;border-top:1px solid #362c1e;font-size:15px;font-weight:600;color:#f3ede1;text-align:right;white-space:nowrap;">${chf(total)}</td>
          </tr>
        </table>
        <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:#ab9f8c;">${versand ? "inkl. Versand (pauschal)" : "inkl. Versand in die Schweiz"}</p>
      </div>
      <p style="margin:0 0 6px;font-size:13px;color:#ab9f8c;">Lieferadresse</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#f3ede1;">
        ${escapeHtml(name)}<br>
        ${escapeHtml(strasse)}<br>
        ${escapeHtml(plz)} ${escapeHtml(ort)}<br>
        ${escapeHtml(LAENDER[land])}
      </p>
      ${zahlungsText(zahlung, nummer, total)}
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d5cbba;">
        Wir versenden, sobald die Zahlung eingegangen ist, und nennen dir dann den
        <strong style="color:#f3ede1;">Liefertermin</strong>. Stimmt etwas nicht, zum
        Beispiel die Adresse, antworte einfach auf diese E-Mail.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#d5cbba;">
        Herzlich<br>Dein MAFO Team
      </p>
    </div>
  </div>
  <p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#8a8272;text-align:center;">
    Mafo Pet · Ausserdorfstrasse 22 · 8918 Unterlunkhofen · Schweiz<br>
    Du erhältst diese E-Mail, weil du auf mafo-pet.ch eine Bestellung aufgegeben hast.
  </p>
</div>
  `.trim();
}

// Block "So bezahlst du" in der Bestätigung
function zahlungsText(zahlung, nummer, total) {
  const zeile = (label, wert) =>
    wert
      ? `<tr>
          <td style="padding:5px 12px 5px 0;font-size:14px;color:#ab9f8c;white-space:nowrap;vertical-align:top;">${label}</td>
          <td style="padding:5px 0;font-size:15px;color:#f3ede1;font-variant-numeric:tabular-nums;white-space:nowrap;">${escapeHtml(wert)}</td>
        </tr>`
      : "";
  let zeilen = zeile("Zahlungsart", ZAHLUNGSARTEN[zahlung.art]) + zeile("Betrag", chf(total));
  if (zahlung.art === "twint") {
    zeilen += zeile("TWINT-Nummer", zahlung.twint) + zeile("Mitteilung", nummer);
  } else {
    zeilen += zeile("IBAN", zahlung.iban) + zeile("Kontoinhaber", zahlung.inhaber) + zeile("Zahlungszweck", nummer);
  }
  const qr =
    zahlung.art === "twint" && zahlung.qr
      ? `<p style="margin:12px 0 0;font-size:14px;color:#d5cbba;">Oder scanne diesen QR-Code in der TWINT-App:</p>
         <img src="${escapeHtml(zahlung.qr)}" alt="TWINT QR-Code" width="180" style="display:block;margin:8px 0 0;background:#fff;padding:8px;border-radius:8px;">`
      : "";
  const hinweis = vollstaendig(zahlung)
    ? ""
    : `<p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#d5cbba;">Die Zahlungsangaben senden wir dir in einer separaten E-Mail.</p>`;
  return `
      <div style="margin:0 0 20px;padding:14px 16px;background:#221c14;border:1px solid #c8945f;border-radius:8px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#f3ede1;">So bezahlst du</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${zeilen}</table>
        ${qr}${hinweis}
      </div>`;
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
