import Stripe from "stripe";
import { berechne, chf, escapeHtml, sendeBestellmails, sendeInternHinweis } from "./_bestellung.js";

// Stripe meldet hierher, wenn eine Kartenzahlung durch ist. Erst jetzt gehen
// die Bestellmails raus. Jede Anfrage wird mit dem Signiergeheimnis geprüft.

// Für die Signaturprüfung braucht Stripe den unveränderten Text der Anfrage
export const config = { api: { bodyParser: false } };

async function rohText(request) {
  const teile = [];
  for await (const teil of request) teile.push(typeof teil === "string" ? Buffer.from(teil) : teil);
  return Buffer.concat(teile);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const schluessel = (process.env.STRIPE_SECRET_KEY || "").trim();
  const geheimnis = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!schluessel || !geheimnis) {
    console.error("STRIPE_SECRET_KEY oder STRIPE_WEBHOOK_SECRET ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  const stripe = new Stripe(schluessel);
  let ereignis;
  try {
    ereignis = stripe.webhooks.constructEvent(await rohText(request), request.headers["stripe-signature"], geheimnis);
  } catch (fehler) {
    console.error("Ungültige Webhook-Signatur:", fehler && fehler.message);
    return response.status(400).json({ error: "Ungültige Signatur." });
  }

  /** @type {import("stripe").Stripe.Checkout.Session} */
  // @ts-ignore: alle drei hier behandelten Ereignisse enthalten eine Checkout-Sitzung
  const sitzung = ereignis.data.object;

  if (ereignis.type === "checkout.session.async_payment_failed") {
    await sendeInternHinweis(
      `Kartenzahlung fehlgeschlagen: ${sitzung.client_reference_id || sitzung.id}`,
      `<p>Die Zahlung zur Bestellung ${escapeHtml(String(sitzung.client_reference_id || ""))} ist fehlgeschlagen. Nicht versenden.</p>`,
    );
    return response.status(200).json({ ok: true });
  }

  if (ereignis.type !== "checkout.session.completed" && ereignis.type !== "checkout.session.async_payment_succeeded") {
    return response.status(200).json({ ignoriert: ereignis.type });
  }

  // Bei verzögerten Zahlarten kommt "completed" noch unbezahlt; dann zählt erst "async_payment_succeeded"
  if (sitzung.payment_status === "unpaid") return response.status(200).json({ wartet: true });

  const m = sitzung.metadata || {};
  const nummer = m.nummer || sitzung.client_reference_id || sitzung.id;
  const email = sitzung.customer_email || (sitzung.customer_details && sitzung.customer_details.email) || "";
  const rechnung = berechne({ anzahlCar: Number(m.car) || 0, anzahlWalk: Number(m.walk) || 0 }, m.land, m.code);

  if (rechnung.fehler || !email) {
    // Neu aufbauen geht nicht (zum Beispiel Code inzwischen ungültig). Ein erneuter
    // Versuch von Stripe würde daran nichts ändern, deshalb nur Meldung an uns.
    await sendeInternHinweis(
      `Kartenzahlung bezahlt, Bestellung ${nummer} prüfen`,
      `<p>Die Zahlung ist bei Stripe eingegangen (${escapeHtml(chf(sitzung.amount_total || 0))}), die Bestellung liess sich aber nicht automatisch aufbauen: ${escapeHtml(rechnung.fehler || "E-Mail fehlt")}.</p>
       <p>Name: ${escapeHtml(m.name || "")}<br>Adresse: ${escapeHtml(m.strasse || "")}, ${escapeHtml(m.plz || "")} ${escapeHtml(m.ort || "")} (${escapeHtml(m.land || "")})<br>E-Mail: ${escapeHtml(email)}<br>Anzahl MAFO: ${escapeHtml(String(m.car || 0))}, MAFO WALK: ${escapeHtml(String(m.walk || 0))}<br>Code: ${escapeHtml(m.code || "")}</p>`,
    );
    return response.status(200).json({ ok: true, manuell: true });
  }

  const abweichung =
    sitzung.amount_total !== rechnung.total
      ? `<p><strong>Achtung:</strong> Bei Stripe bezahlt wurden ${escapeHtml(chf(sitzung.amount_total || 0))}, nach unserer Rechnung wären es ${escapeHtml(chf(rechnung.total))}. Bitte prüfen.</p>`
      : "";
  const referenz = typeof sitzung.payment_intent === "string" ? sitzung.payment_intent : sitzung.id;
  const bestellung = {
    nummer,
    name: m.name || "",
    email,
    strasse: m.strasse || "",
    plz: m.plz || "",
    ort: m.ort || "",
    land: m.land,
    ...rechnung,
    zahlung: { art: "karte", referenz },
  };

  // Scheitert die interne Mail, soll Stripe es später nochmals versuchen
  const versendet = await sendeBestellmails(bestellung, new Date().toISOString(), abweichung);
  if (versendet.status !== 200) return response.status(500).json(versendet.body);
  return response.status(200).json({ ok: true });
}
