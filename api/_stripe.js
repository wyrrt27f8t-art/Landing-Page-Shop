// Liest die Stripe-Variablen aus Vercel. Beim Einfügen rutschen leicht
// Anführungszeichen, Leerzeichen oder der Variablenname mit hinein.
function bereinigt(wert) {
  return String(wert || "")
    .trim()
    .replace(/^[A-Z_]+\s*=\s*/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, "");
}

export const stripeSchluessel = () => bereinigt(process.env.STRIPE_SECRET_KEY);
export const webhookGeheimnis = () => bereinigt(process.env.STRIPE_WEBHOOK_SECRET);

// Nur die Art des Schlüssels, nie der Inhalt
export function schluesselArt(wert) {
  if (!wert) return "fehlt";
  const art = (wert.match(/^(rk|sk|pk)_(test|live)_/) || [])[0];
  if (/^whsec_/.test(wert)) return "whsec_ (falsch: das ist das Webhook-Geheimnis)";
  if (!art) return "unbekannt (muss mit rk_test_ oder sk_test_ beginnen)";
  if (art.startsWith("pk_")) return `${art} (falsch: öffentlicher Schlüssel)`;
  return art;
}
