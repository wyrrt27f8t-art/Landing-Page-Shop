import Stripe from "stripe";
import { LAENDER, bestellnummer, pruefeBestellung } from "./_bestellung.js";
import { schluesselArt, stripeSchluessel, webhookGeheimnis } from "./_stripe.js";

// Kartenzahlung über Stripe Checkout (gehostete Bezahlseite). Die Beträge
// rechnet der Server aus den Mengen, nie der Browser. Die Bestellmails gehen
// erst raus, wenn Stripe die Zahlung per Webhook bestätigt (api/stripe-webhook.js).
//
//   STRIPE_SECRET_KEY      eingeschränkter Schlüssel (rk_test_… / rk_live_…); nur in Vercel
//   STRIPE_WEBHOOK_SECRET  Signiergeheimnis (whsec_…) des Webhooks; nur in Vercel
//   MAFO_SITE_URL          optional, Adresse der Seite; Standard https://mafo-pet.ch

const WAEHRUNG = "chf";
// Etikett, mit dem sich diese Kasse im Stripe-Dashboard wiederfindet
const INTEGRATION = "mafo-shop-checkout-qwhzmbtv";

function seitenAdresse() {
  const fest = (process.env.MAFO_SITE_URL || "").trim().replace(/\/+$/, "");
  if (fest) return fest;
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://mafo-pet.ch";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const body = request.body || {};

  // Honeypot: real users never fill this in.
  if (body.mafo_falle) return response.status(200).json({ ok: true });

  const schluessel = stripeSchluessel();
  if (!schluessel || !webhookGeheimnis()) {
    return response.status(503).json({ error: "Kartenzahlung ist noch nicht eingerichtet.", feld: "zahlung" });
  }

  // Öffentlicher Schlüssel oder Webhook-Geheimnis statt Geheimschlüssel: gar nicht erst zu Stripe
  if (!/^(sk|rk)_(test|live)_/.test(schluessel)) {
    return response.status(503).json({ error: "Kartenzahlung ist falsch eingerichtet.", grund: `Schlüssel ${schluesselArt(schluessel)}` });
  }

  // Gewählt auf der Website: "twint" oder "karte". Bezahlt wird beides auf der
  // Bezahlseite von Stripe, die alle im Dashboard aktivierten Zahlungsarten zeigt.
  const wahl = body.zahlung === "twint" ? "twint" : "karte";
  const ergebnis = pruefeBestellung({ ...body, zahlung: "karte" }, ["karte"]);
  if (ergebnis.fehler) return response.status(ergebnis.fehler.status).json(ergebnis.fehler.body);
  const d = ergebnis.daten;
  if (wahl === "twint" && d.land !== "CH") {
    return response.status(400).json({ error: "TWINT ist nur bei Lieferung in die Schweiz möglich.", feld: "zahlung" });
  }
  const nummer = bestellnummer();

  // Mit Rabatt eine Sammelzeile, damit der Betrag in Stripe auf den Rappen
  // dem Total entspricht; sonst eine Zeile pro Artikel.
  const position = (name, betrag, menge = 1, beschreibung) => ({
    quantity: menge,
    price_data: {
      currency: WAEHRUNG,
      unit_amount: betrag,
      product_data: { name, ...(beschreibung ? { description: beschreibung } : {}) },
    },
  });
  const zeilen = d.rabatt
    ? [
        position(
          `MAFO Bestellung ${nummer}`,
          d.ware,
          1,
          `${d.positionen.map((p) => `${p.menge}× ${p.name}`).join(", ")} · Bonuscode −${d.rabatt.prozent} %`,
        ),
      ]
    : d.positionen.map((p) => position(p.name, p.preis, p.menge));
  if (d.versand) zeilen.push(position(`Versand nach ${LAENDER[d.land]}`, d.versand));

  const mengen = Object.fromEntries(d.positionen.map((p) => [p.feld, p.menge]));
  const basis = seitenAdresse();

  try {
    const stripe = new Stripe(schluessel);
    const angaben = {
      mode: "payment",
      line_items: zeilen,
      customer_email: d.email,
      client_reference_id: nummer,
      locale: "auto",
      integration_identifier: INTEGRATION,
      // Alles, was der Webhook für die Bestellmails braucht (jeder Wert höchstens 500 Zeichen)
      metadata: {
        nummer,
        name: d.name,
        strasse: d.strasse,
        plz: d.plz,
        ort: d.ort,
        land: d.land,
        car: String(mengen.anzahlCar || 0),
        walk: String(mengen.anzahlWalk || 0),
        code: d.rabatt ? d.rabatt.code : "",
        wahl,
      },
      payment_intent_data: {
        description: `MAFO Bestellung ${nummer}`,
        metadata: { nummer },
        shipping: {
          name: d.name,
          address: { line1: d.strasse, postal_code: d.plz, city: d.ort, country: d.land },
        },
      },
      success_url: `${basis}/kasse.html?karte=ok&nr=${nummer}`,
      cancel_url: `${basis}/kasse.html?karte=abbruch#pruefen`,
    };
    let sitzung;
    try {
      sitzung = await stripe.checkout.sessions.create(angaben);
    } catch (ersterFehler) {
      // Kennt das Konto das Etikett nicht, ohne es nochmals versuchen
      if (!(ersterFehler && ersterFehler.param === "integration_identifier")) throw ersterFehler;
      delete angaben.integration_identifier;
      sitzung = await stripe.checkout.sessions.create(angaben);
    }
    return response.status(200).json({ ok: true, url: sitzung.url });
  } catch (fehler) {
    // Nur Art und Meldung loggen, nie den Schlüssel oder die ganze Anfrage
    const meldung = String((fehler && fehler.message) || "").replace(/[sr]k_(test|live)_\w+/g, "[Schlüssel]");
    console.error("Stripe-Fehler beim Anlegen der Bezahlseite:", fehler && fehler.type, meldung);
    // Grund ohne geheime Daten an die Kasse zurückgeben, damit man den Fehler sieht
    const grund = [
      fehler && fehler.type,
      fehler && fehler.code,
      fehler && fehler.param && `Feld ${fehler.param}`,
      // Bei fehlender Berechtigung nennt Stripe, welche; die Meldung ist ohne Schlüssel
      fehler && fehler.type === "StripePermissionError" && meldung.slice(0, 300),
    ].filter(Boolean).join(" / ");
    return response.status(502).json({ error: "Die Bezahlseite konnte nicht geöffnet werden.", grund: grund || "unbekannt" });
  }
}
