import { ZAHLUNGSARTEN, zahlungsangaben } from "./_zahlung.js";
import { bestellnummer, pruefeBestellung, sendeBestellmails } from "./_bestellung.js";

// Vorkasse und TWINT: Bestellung prüfen, Beträge rechnen, Mails schicken.
// Die Kartenzahlung läuft über api/checkout.js und api/stripe-webhook.js.
const BEZAHLARTEN = ["vorauskasse", "twint"];

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const body = request.body || {};

  // Honeypot: echte Menschen füllen dieses Feld nie aus. (Früher hiess es
  // "company"; das füllt der Browser per Autofill aus, darum ein neutraler Name.)
  if (body.mafo_falle) {
    return response.status(200).json({ ok: true });
  }

  const ergebnis = pruefeBestellung(body, BEZAHLARTEN.filter((a) => ZAHLUNGSARTEN[a]));
  if (ergebnis.fehler) return response.status(ergebnis.fehler.status).json(ergebnis.fehler.body);

  const nummer = bestellnummer();
  const zahlung = zahlungsangaben(ergebnis.daten.zahlungsart);
  const bestellung = { nummer, ...ergebnis.daten, zahlung };

  const versendet = await sendeBestellmails(bestellung, new Date().toISOString());
  if (versendet.status !== 200) return response.status(versendet.status).json(versendet.body);
  return response.status(200).json({ ok: true, nummer, total: bestellung.total, zahlung });
}
