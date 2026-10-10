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

// Das Webhook-Geheimnis auch finden, wenn der Variablenname leicht abweicht
// (Gross-/Kleinschreibung, Tippfehler): zuerst der richtige Name, dann jede
// Variable mit "webhook" im Namen, dann jede, deren Wert mit whsec_ beginnt.
export function webhookGeheimnis() {
  const richtig = bereinigt(process.env.STRIPE_WEBHOOK_SECRET);
  if (richtig) return richtig;
  const werte = Object.entries(process.env).map(([name, wert]) => [name, bereinigt(wert)]);
  const treffer =
    werte.find(([name, wert]) => /webhook/i.test(name) && /^whsec_/.test(wert)) ||
    werte.find(([, wert]) => /^whsec_/.test(wert));
  return treffer ? treffer[1] : "";
}

// Namen (nie Werte) der Variablen, die nach Stripe aussehen, für die Prüfseite
export const stripeVariablen = () =>
  Object.keys(process.env).filter((name) => /stripe|webhook|whsec/i.test(name)).sort();

// Nur die Art des Schlüssels, nie der Inhalt
export function schluesselArt(wert) {
  if (!wert) return "fehlt";
  const art = (wert.match(/^(rk|sk|pk)_(test|live)_/) || [])[0];
  if (/^whsec_/.test(wert)) return "whsec_ (falsch: das ist das Webhook-Geheimnis)";
  if (!art) return "unbekannt (muss mit rk_test_ oder sk_test_ beginnen)";
  if (art.startsWith("pk_")) return `${art} (falsch: öffentlicher Schlüssel)`;
  return art;
}
