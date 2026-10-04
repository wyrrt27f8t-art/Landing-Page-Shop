import { bonusProzent, normalerCode } from "./_rabatt.js";

// Prüft einen Bonuscode, damit die Website den reduzierten Preis vor dem
// Bestellen zeigen kann. Bei der Bestellung rechnet reserve.js selbst nach.
export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const code = normalerCode((request.body || {}).code);
  const prozent = bonusProzent(code);

  if (!prozent) {
    // Kurz warten macht massenhaftes Durchprobieren mühsamer.
    await new Promise((fertig) => setTimeout(fertig, 400));
    return response.status(404).json({ ok: false });
  }

  return response.status(200).json({ ok: true, code, prozent });
}
