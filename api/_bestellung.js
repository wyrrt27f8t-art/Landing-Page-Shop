import { randomInt } from "node:crypto";
import { bonusProzent, mitRabatt, normalerCode } from "./_rabatt.js";
import { ZAHLUNGSARTEN } from "./_zahlung.js";
import { zahlungsangaben, vollstaendig } from "./_zahlung.js";

// Gemeinsame Bestelllogik für Vorkasse/TWINT (api/reserve.js) und Karte
// (api/checkout.js + api/stripe-webhook.js). Dateien mit "_" vorne macht
// Vercel nicht zu eigenen Endpunkten.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Lieferländer, ihre Postleitzahlen und Versandkosten in Rappen (pauschal pro Bestellung)
export const LAENDER = { CH: "Schweiz", DE: "Deutschland", AT: "Österreich" };
export const VERSAND = { CH: 0, DE: 1200, AT: 1200 };
export const PLZ_RE = { CH: /^\d{4}$/, AT: /^\d{4}$/, DE: /^\d{5}$/ };

// Preise in Rappen, inkl. Versand in die Schweiz; nach DE und AT kommt VERSAND
// dazu. Müssen mit der Website übereinstimmen; der Betrag in den Mails wird
// hier berechnet, nie aus dem Browser übernommen.
export const ARTIKEL = [
  { feld: "anzahlCar", name: "MAFO", preis: 5900 },
  { feld: "anzahlWalk", name: "MAFO WALK", preis: 3990 },
];
const MAX_PRO_ARTIKEL = 10;

/**
 * Prüft die Eingaben und rechnet die Beträge aus. Gibt entweder
 * { fehler: { status, body } } oder { daten } zurück. Die Reihenfolge der
 * Prüfungen ist Teil des Verhaltens und bleibt deshalb so.
 */
export function pruefeBestellung(body, erlaubteZahlungen) {
  const fehler = (error, feld) => ({ fehler: { status: 400, body: feld ? { error, feld } : { error } } });

  const name = text(body.name, 200);
  const email = text(body.email, 200);
  const strasse = text(body.street, 200);
  const plz = text(body.zip, 10);
  const ort = text(body.city, 100);
  const land = (text(body.country, 2) || "CH").toUpperCase();

  if (!name) return fehler("Name fehlt.");
  if (!email || !EMAIL_RE.test(email)) return fehler("Ungültige E-Mail-Adresse.");
  if (!strasse) return fehler("Strasse fehlt.");
  if (!LAENDER[land]) return fehler("Ungültiges Land.", "country");
  if (!PLZ_RE[land].test(plz)) return fehler("Ungültige Postleitzahl.");
  if (!ort) return fehler("Ort fehlt.");

  const zahlungsart = text(body.zahlung, 20);
  if (!erlaubteZahlungen.includes(zahlungsart)) return fehler("Ungültige Zahlungsart.", "zahlung");
  if (zahlungsart === "twint" && land !== "CH") {
    return fehler("TWINT ist nur bei Lieferung in die Schweiz möglich.", "zahlung");
  }

  const mengen = {};
  for (const artikel of ARTIKEL) {
    const menge = leseMenge(body[artikel.feld]);
    if (menge === null) return fehler("Ungültige Anzahl.");
    mengen[artikel.feld] = menge;
  }
  const rechnung = berechne(mengen, land, body.bonuscode);
  if (rechnung.fehler) return fehler(rechnung.fehler, rechnung.feld);

  return { daten: { name, email, strasse, plz, ort, land, zahlungsart, ...rechnung } };
}

/**
 * Positionen, Rabatt, Versand und Total aus Mengen, Land und Bonuscode.
 * Wird auch vom Webhook benutzt, um die Bestellung aus den Angaben in
 * Stripe neu aufzubauen.
 */
export function berechne(mengen, land, bonuscode) {
  const positionen = [];
  for (const artikel of ARTIKEL) {
    const menge = mengen[artikel.feld] || 0;
    if (menge > 0) positionen.push({ ...artikel, menge, summe: menge * artikel.preis });
  }
  if (positionen.length === 0) return { fehler: "Kein Artikel gewählt." };

  const zwischensumme = positionen.reduce((summe, p) => summe + p.summe, 0);

  // Bonuscode: ein falscher Code bricht ab, statt still den vollen Preis zu
  // verlangen, den die Kundschaft so nicht erwartet.
  const code = normalerCode(bonuscode);
  const prozent = code ? bonusProzent(code) : 0;
  if (code && !prozent) return { fehler: "Ungültiger Bonuscode.", feld: "bonuscode" };
  // Der Rabatt gilt für die Ware, nicht für den Versand
  const ware = prozent ? mitRabatt(zwischensumme, prozent) : zwischensumme;
  const rabatt = prozent ? { code, prozent, betrag: zwischensumme - ware } : null;
  const versand = VERSAND[land];
  return { positionen, zwischensumme, rabatt, ware, versand, total: ware + versand };
}

/**
 * Schickt die interne Benachrichtigung und die Bestätigung an die Kundschaft.
 * Gibt { status, body } zurück, den Statuscode bestimmt allein die interne Mail.
 */
export async function sendeBestellmails(bestellung, submittedAt, zusatz = "") {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  // Aus der Variablen zählt nur die Adresse. Der angezeigte Absendername gehört
  // zur Marke und soll für beide Produkte gleich sein, deshalb steht er hier.
  const fromEmail = `MAFO <${absenderAdresse()}>`;
  const { nummer, name, email, positionen, zahlung } = bestellung;
  const kurz = positionen.map((p) => `${p.menge}× ${p.name}`).join(", ");

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return { status: 500, body: { error: "Server ist nicht korrekt konfiguriert." } };
  }
  try {
    // 1. Benachrichtigung an uns. Schlägt sie fehl, ist die Bestellung verloren –
    //    deshalb entscheidet nur sie über den Statuscode.
    const intern = await sendeMail(apiKey, {
      from: fromEmail,
      to: [toEmail],
      reply_to: email,
      subject: `Neue Bestellung ${nummer}: ${kurz} – ${einzeilig(name)} (${ZAHLUNGSARTEN[zahlung.art]})`,
      html: internerText(bestellung, submittedAt, zusatz),
    });
    if (!intern.ok) {
      console.error("Resend error (intern):", intern.status, intern.text);
      return { status: 502, body: { error: "E-Mail konnte nicht gesendet werden." } };
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
    return { status: 200, body: { ok: true } };
  } catch (error) {
    console.error("Unerwarteter Fehler beim Senden:", error);
    return { status: 500, body: { error: "Unerwarteter Fehler." } };
  }
}

/* ---------- Eingaben ---------- */

// Nur Text, zugeschnitten und gekürzt. Alles andere gilt als leer.
export function text(wert, maxLaenge) {
  return typeof wert === "string" ? wert.trim().slice(0, maxLaenge) : "";
}

// Ganze Zahl von 0 bis MAX_PRO_ARTIKEL. Fehlt das Feld, gilt 0; alles
// Unlesbare ergibt null und damit eine Ablehnung.
export function leseMenge(wert) {
  if (wert === undefined || wert === null || wert === "") return 0;
  const n = typeof wert === "number" ? wert : typeof wert === "string" ? Number(wert) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= MAX_PRO_ARTIKEL ? n : null;
}

// Ohne leicht verwechselbare Zeichen (0/O, 1/I), damit man sie am Telefon
// diktieren kann.
export function bestellnummer() {
  const zeichen = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let rest = "";
  for (let i = 0; i < 6; i++) rest += zeichen[randomInt(zeichen.length)];
  return `MAFO-${rest}`;
}

// Zeilenumbrüche haben in einem Betreff nichts verloren.
export function einzeilig(wert) {
  return wert.replace(/[\r\n]+/g, " ");
}

/* ---------- Versand ---------- */

// Akzeptiert "Name <adresse>" ebenso wie eine blosse Adresse.
export function absenderAdresse() {
  const roh = (process.env.MAFO_FROM_EMAIL || "noreply@mafo-pet.ch").trim();
  const inKlammern = roh.match(/<([^>]+)>/);
  return (inKlammern ? inKlammern[1] : roh).trim();
}

export async function sendeMail(apiKey, payload) {
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

export function chf(rappen) {
  return `CHF ${(rappen / 100).toFixed(2)}`;
}

export function internerText({ nummer, name, email, strasse, plz, ort, land, positionen, zwischensumme, rabatt, versand, total, zahlung }, submittedAt, zusatz = "") {
  const bezahlt = zahlung.art === "karte";
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
      <tr><td><strong>Zahlungsart</strong></td><td>${escapeHtml(ZAHLUNGSARTEN[zahlung.art])} – ${bezahlt ? "bezahlt" : "Zahlung ausstehend"}</td></tr>${bezahlt && zahlung.referenz ? `
      <tr><td><strong>Stripe</strong></td><td>${escapeHtml(zahlung.referenz)}</td></tr>` : ""}
      <tr><td><strong>Zeitpunkt</strong></td><td>${submittedAt}</td></tr>
    </table>
    ${zusatz}
    ${
      bezahlt
        ? "<p>Die Zahlung ist bei Stripe eingegangen. Noch offen: versenden und der Kundschaft den Liefertermin nennen.</p>"
        : vollstaendig(zahlung)
        ? "<p>Die Kundschaft hat die Zahlungsangaben mit der Bestätigung erhalten. Noch offen: Zahlungseingang prüfen, dann versenden und den Liefertermin nennen.</p>"
        : "<p><strong>Achtung:</strong> Für diese Zahlungsart sind in Vercel keine Zahlungsangaben hinterlegt (MAFO_IBAN bzw. MAFO_TWINT_NUMMER). Die Kundschaft wartet auf eine separate E-Mail mit den Angaben.</p>"
    }
  `.trim();
}

export function bestaetigungsText({ nummer, name, strasse, plz, ort, land, positionen, rabatt, versand, total, zahlung }) {
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
      ${
        versand
          ? `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#ab9f8c;">Hinweis für Lieferungen nach ${escapeHtml(LAENDER[land])}: Einfuhrumsatzsteuer und allfällige Zollgebühren werden vom Paketdienst bei der Zustellung erhoben und sind nicht im Betrag enthalten.</p>`
          : ""
      }
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#d5cbba;">
        ${zahlung.art === "karte" ? "Deine Zahlung ist eingegangen. Wir versenden bald und nennen dir den" : "Wir versenden, sobald die Zahlung eingegangen ist, und nennen dir dann den"}
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
  if (zahlung.art === "karte") {
    return `
      <div style="margin:0 0 20px;padding:14px 16px;background:#221c14;border:1px solid #c8945f;border-radius:8px;">
        <p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#f3ede1;">Bezahlt</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#d5cbba;">${chf(total)} per Karte bezahlt. Den Beleg von Stripe hast du gegebenenfalls separat erhalten.</p>
      </div>`;
  }
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

export function vorname(name) {
  return name.split(/\s+/)[0];
}

export function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Kurze Meldung nur an uns, zum Beispiel wenn eine Kartenzahlung nicht zugeordnet werden kann. */
export async function sendeInternHinweis(betreff, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await sendeMail(apiKey, {
    from: `MAFO <${absenderAdresse()}>`,
    to: [process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch"],
    subject: einzeilig(betreff),
    html,
  });
  if (!res.ok) console.error("Resend error (Hinweis):", res.status, res.text);
  return res.ok;
}
