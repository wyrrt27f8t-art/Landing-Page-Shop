const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const { name, email, company } = request.body || {};

  // Honeypot: real users never fill this in.
  if (company) {
    return response.status(200).json({ ok: true });
  }

  if (typeof name !== "string" || !name.trim()) {
    return response.status(400).json({ error: "Name fehlt." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return response.status(400).json({ error: "Ungültige E-Mail-Adresse." });
  }

  const cleanName = name.trim().slice(0, 200);
  const cleanEmail = email.trim().slice(0, 200);

  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.MAFO_TO_EMAIL || "info@mafo-pet.ch";
  const fromEmail = process.env.MAFO_FROM_EMAIL || "MAFO CAR <onboarding@resend.dev>";

  if (!apiKey) {
    console.error("RESEND_API_KEY ist nicht gesetzt.");
    return response.status(500).json({ error: "Server ist nicht korrekt konfiguriert." });
  }

  const submittedAt = new Date().toISOString();

  const emailBody = `
    <h2>Neue MAFO CAR Vorbestellung</h2>
    <table cellpadding="6" cellspacing="0">
      <tr><td><strong>Name</strong></td><td>${escapeHtml(cleanName)}</td></tr>
      <tr><td><strong>E-Mail</strong></td><td>${escapeHtml(cleanEmail)}</td></tr>
      <tr><td><strong>Zeitpunkt</strong></td><td>${submittedAt}</td></tr>
    </table>
  `.trim();

  try {
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: cleanEmail,
        subject: `Neue Vorbestellung: ${cleanName}`,
        html: emailBody,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend error:", resendResponse.status, errorText);
      return response.status(502).json({ error: "E-Mail konnte nicht gesendet werden." });
    }

    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error("Unerwarteter Fehler beim Senden:", error);
    return response.status(500).json({ error: "Unerwarteter Fehler." });
  }
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
