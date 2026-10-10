// Zahlungsarten und die Angaben, die die Kundschaft zum Bezahlen braucht.
// Die Bankverbindung und die TWINT-Angaben stehen nur in Vercel-Variablen,
// nie im Code: das Repository ist öffentlich. Fehlen sie, bekommt die
// Kundschaft den Hinweis, dass die Angaben separat per E-Mail folgen.
//
//   MAFO_IBAN           IBAN für die Vorauskasse, z. B. CH93 0076 2011 6238 5295 7
//   MAFO_KONTOINHABER   Name auf dem Konto
//   MAFO_TWINT_NUMMER   Handynummer, an die per TWINT bezahlt wird
//   MAFO_TWINT_QR       Adresse (https://…) eines Bilds mit dem TWINT-QR-Code, optional

export const ZAHLUNGSARTEN = {
  vorauskasse: "Vorauskasse (Banküberweisung)",
  twint: "TWINT",
  karte: "Online-Zahlung (Stripe)",
};

function wert(name) {
  return (process.env[name] || "").trim();
}

// IBAN in Vierergruppen, so steht sie auch auf Bankbelegen
export function ibanFormat(iban) {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

// Schweizer Handynummer lesbar: +41 79 123 45 67; andere Nummern bleiben, wie sie sind
export function telefonFormat(nummer) {
  const ziffern = nummer.replace(/[^\d+]/g, "");
  const m = ziffern.match(/^(?:\+41|0041|0)(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+41 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : nummer;
}

export function zahlungsangaben(art) {
  if (art === "karte") return { art };
  if (art === "twint") {
    const nummer = wert("MAFO_TWINT_NUMMER");
    return { art, twint: nummer ? telefonFormat(nummer) : "", qr: wert("MAFO_TWINT_QR") };
  }
  const iban = wert("MAFO_IBAN");
  return { art, iban: iban ? ibanFormat(iban) : "", inhaber: wert("MAFO_KONTOINHABER") };
}

// true, wenn die Kundschaft mit diesen Angaben bezahlen kann
export function vollstaendig(z) {
  if (z.art === "karte") return true;
  return z.art === "twint" ? !!(z.twint || z.qr) : !!z.iban;
}
