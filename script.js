const form = document.getElementById("preorder-form");
const status = document.getElementById("form-status");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    produkt: form.produkt.value,
    company: form.company.value, // honeypot
  };

  status.textContent = "";
  status.removeAttribute("data-state");

  if (!data.name || !data.email) {
    status.textContent = "Bitte Name und E-Mail-Adresse ausfüllen.";
    status.setAttribute("data-state", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Wird gesendet...";

  try {
    const response = await fetch("/api/reserve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Senden fehlgeschlagen.");
    }

    form.reset();
    status.textContent = "Schön, bist du dabei! Dein Exemplar ist reserviert – wir melden uns bei dir, sobald MAFO CAR bereit für die erste Fahrt ist.";
    status.setAttribute("data-state", "success");
  } catch (error) {
    status.textContent = "Da ist etwas schiefgelaufen. Bitte versuch es später nochmal oder schreib uns direkt an info@mafo-pet.ch.";
    status.setAttribute("data-state", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Reserviere dir dein Exemplar";
  }
});
