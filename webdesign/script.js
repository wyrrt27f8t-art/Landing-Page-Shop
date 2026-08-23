/* Mobiles Menü ------------------------------------------------------------
   Die Rechtstexte binden dieselbe Datei ein, haben aber kein Formular –
   deshalb wird jeder Block einzeln geprüft, bevor er sich anmeldet. */

const navToggle = document.getElementById("nav-toggle");
const nav = document.getElementById("nav");

if (navToggle && nav) {
  const menuSchliessen = () => {
    nav.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Menü öffnen");
  };

  navToggle.addEventListener("click", () => {
    const offen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(offen));
    navToggle.setAttribute("aria-label", offen ? "Menü schliessen" : "Menü öffnen");
  });

  // Nach einem Klick auf einen Anker soll das Menü nicht offen stehen bleiben.
  nav.addEventListener("click", (event) => {
    if (event.target.tagName === "A") {
      menuSchliessen();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      menuSchliessen();
    }
  });
}

/* Kontaktformular -------------------------------------------------------- */

const form = document.getElementById("kontakt-form");
const status = document.getElementById("form-status");

if (form && status) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitButton = form.querySelector("button[type='submit']");
    const data = {
      name: form.name.value.trim(),
      firma: form.firma.value.trim(),
      email: form.email.value.trim(),
      telefon: form.telefon.value.trim(),
      paket: form.paket.value,
      nachricht: form.nachricht.value.trim(),
      website: form.website.value, // honeypot
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
      const response = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Senden fehlgeschlagen.");
      }

      form.reset();
      status.textContent = "Danke, Ihre Anfrage ist angekommen. Ich melde mich innert eines Arbeitstages bei Ihnen.";
      status.setAttribute("data-state", "success");
    } catch (error) {
      status.textContent = "Da ist etwas schiefgelaufen. Bitte versuchen Sie es später nochmal oder schreiben Sie direkt an hallo@seitenwerk.ch.";
      status.setAttribute("data-state", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Anfrage senden";
    }
  });
}

/* Einblenden beim Scrollen ------------------------------------------------
   Die Blöcke starten laut CSS unsichtbar – aber nur, wenn oben im <head>
   die Klasse "js" gesetzt wurde. Fällt der Observer aus, werden hier alle
   Blöcke sofort sichtbar geschaltet. */

const bloecke = document.querySelectorAll("[data-reveal]");

if (bloecke.length) {
  const sofortZeigen = () => bloecke.forEach((el) => el.classList.add("is-visible"));

  if (!("IntersectionObserver" in window)) {
    sofortZeigen();
  } else {
    const beobachter = new IntersectionObserver((eintraege, obs) => {
      eintraege.forEach((eintrag) => {
        if (eintrag.isIntersecting) {
          eintrag.target.classList.add("is-visible");
          obs.unobserve(eintrag.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    bloecke.forEach((el) => beobachter.observe(el));

    // Sicherheitsnetz: Sollte etwas hängen bleiben, ist nach zwei Sekunden
    // trotzdem alles sichtbar. Eine unsichtbare Seite gibt es nicht.
    setTimeout(sofortZeigen, 2000);
  }
}
