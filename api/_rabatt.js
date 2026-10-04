// Bonuscodes. Sie stehen nur in der Vercel-Variable MAFO_BONUSCODES, nie im
// Code: das Repository ist öffentlich. Format: "CODE" (30 %) oder "CODE:20",
// mehrere durch Komma getrennt. Ohne Variable ist kein Code gültig.
// Dateien mit "_" vorne macht Vercel nicht zu eigenen Endpunkten.

const STANDARD_PROZENT = 30;

export function normalerCode(wert) {
  return typeof wert === "string" ? wert.replace(/\s+/g, "").toUpperCase().slice(0, 40) : "";
}

// Rabatt in Prozent für einen Code, 0 wenn er nicht gilt.
export function bonusProzent(code) {
  const eingabe = normalerCode(code);
  if (!eingabe) return 0;
  for (const eintrag of (process.env.MAFO_BONUSCODES || "").split(",")) {
    const [roh, prozent] = eintrag.split(":");
    if (normalerCode(roh) !== eingabe) continue;
    const n = prozent === undefined ? STANDARD_PROZENT : Number(prozent.trim());
    return Number.isInteger(n) && n > 0 && n < 100 ? n : 0;
  }
  return 0;
}

// Preis nach Rabatt, auf 5 Rappen gerundet wie an der Kasse.
export function mitRabatt(rappen, prozent) {
  return Math.round((rappen * (100 - prozent)) / 100 / 5) * 5;
}
