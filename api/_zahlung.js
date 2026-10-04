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
};

function wert(name) {
  return (process.env[name] || "").trim();
}

// IBAN in Vierergruppen, so steht sie auch auf Bankbelegen
export function ibanFormat(iban) {
  return iban.replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

export function zahlungsangaben(art) {
  if (art === "twint") {
    return { art, twint: wert("MAFO_TWINT_NUMMER"), qr: wert("MAFO_TWINT_QR") };
  }
  const iban = wert("MAFO_IBAN");
  return { art, iban: iban ? ibanFormat(iban) : "", inhaber: wert("MAFO_KONTOINHABER") };
}

// true, wenn die Kundschaft mit diesen Angaben bezahlen kann
export function vollstaendig(z) {
  return z.art === "twint" ? !!(z.twint || z.qr) : !!z.iban;
}
