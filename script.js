const form = document.getElementById("preorder-form");
const status = document.getElementById("form-status");

// Meldung in der aktuell gewählten Sprache, mit Deutsch als Rückfall.
function sagt(schluessel) {
  const sprache = document.documentElement.lang || "de";
  const woerter = (window.MAFO_TEXTE || {})[sprache] || (window.MAFO_TEXTE || {}).de || {};
  return woerter[schluessel] || "";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const beschriftung = submitButton.textContent;
  const data = {
    name: form.name.value.trim(),
    email: form.email.value.trim(),
    produkt: form.produkt.value,
    company: form.company.value, // honeypot
  };

  status.textContent = "";
  status.removeAttribute("data-state");

  if (!data.name || !data.email) {
    status.textContent = sagt("order.missing");
    status.setAttribute("data-state", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = sagt("order.sending");

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
    status.textContent = sagt("order.success");
    status.setAttribute("data-state", "success");
  } catch (error) {
    status.textContent = sagt("order.error");
    status.setAttribute("data-state", "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = beschriftung;
  }
});

/*
 * Hintergrundvideo: iOS spielt im Stromsparmodus nichts ab und blendet dann
 * eine Wiedergabetaste ein. In dem Fall blenden wir das Video aus – das
 * Standbild darunter sieht ohnehin gleich aus, nur ohne Bedienelement.
 */
document.querySelectorAll(".hero-bg").forEach((video) => {
  const aufStandbild = () => {
    video.style.display = "none";
    const bild = video.getAttribute("poster");
    const abschnitt = video.closest(".hero-video");
    if (bild && abschnitt) {
      abschnitt.style.backgroundImage = `url("${bild}")`;
      abschnitt.style.backgroundSize = "cover";
      abschnitt.style.backgroundPosition = "center";
    }
  };

  const versuch = video.play();
  if (versuch && typeof versuch.catch === "function") {
    // Kurz abwarten: Manche Browser lehnen den ersten Versuch ab und starten
    // gleich darauf doch. Nur wenn es dann immer noch steht, ist es blockiert.
    versuch.catch(() => {
      setTimeout(() => {
        if (video.paused) aufStandbild();
      }, 900);
    });
  }
  video.addEventListener("error", aufStandbild);
});
