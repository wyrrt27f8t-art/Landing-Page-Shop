// Sagt der Kasse, ob die Kartenzahlung eingerichtet ist. Ohne Stripe-Schlüssel
// in Vercel bleibt die Option unsichtbar und der Shop läuft wie bisher.
export default function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  response.setHeader("Cache-Control", "no-store");
  const bereit = !!(process.env.STRIPE_SECRET_KEY || "").trim() && !!(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  return response.status(200).json({ karte: bereit });
}
