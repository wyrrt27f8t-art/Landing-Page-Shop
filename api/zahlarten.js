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
  return response.status(200).json({
    // Nur mit echtem Geheimschlüssel anbieten, sonst sähen Kunden bloss eine Fehlermeldung
    karte: /^(sk|rk)_(test|live)_/.test(wert) && webhook,
    schluessel,
    webhook,
    umgebung: process.env.VERCEL_ENV || "",
    schluesselArt: schluesselArt(wert),
    schluesselLaenge: wert.length,
    webhookArt: webhook ? (/^whsec_/.test(webhookGeheimnis()) ? "whsec_" : "unbekannt (muss mit whsec_ beginnen)") : "fehlt",
  });
}
