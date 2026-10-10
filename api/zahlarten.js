import { schluesselArt, stripeSchluessel, webhookGeheimnis } from "./_stripe.js";

// Sagt der Kasse, ob die Kartenzahlung eingerichtet ist. Ohne Stripe-Schlüssel
// in Vercel bleibt die Option unsichtbar und der Shop läuft wie bisher.
export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  response.setHeader("Cache-Control", "no-store");
  // Nur ob die Variablen da sind und welche Art Schlüssel, nie ihr Inhalt
  const wert = stripeSchluessel();
  const schluessel = !!wert;
  const webhook = !!webhookGeheimnis();
  const umgebung = process.env.VERCEL_ENV || "";
  const modus = /^(sk|rk)_live_/.test(wert) ? "live" : /^(sk|rk)_test_/.test(wert) ? "test" : "";
  // Mit Testschlüssel auf der echten Seite sähen Kunden nur die Stripe-Testseite,
  // auf der echte Karten abgelehnt werden. Dann nur mit ?test=1 (kasse.html?kartentest) anbieten.
  const testErlaubt = umgebung !== "production" || (request.query && request.query.test === "1");
  return response.status(200).json({
    // Nur mit echtem Geheimschlüssel anbieten, sonst sähen Kunden bloss eine Fehlermeldung
    karte: webhook && (modus === "live" || (modus === "test" && testErlaubt)),
    modus,
    schluessel,
    webhook,
    umgebung,
    schluesselArt: schluesselArt(wert),
    schluesselLaenge: wert.length,
    webhookArt: webhook ? (/^whsec_/.test(webhookGeheimnis()) ? "whsec_" : "unbekannt (muss mit whsec_ beginnen)") : "fehlt",
  });
}
