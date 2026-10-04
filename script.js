const form = document.getElementById("preorder-form");
const status = document.getElementById("form-status");
const totalAnzeige = document.getElementById("order-total");
const altAnzeige = document.getElementById("order-total-alt");
const codeFeld = form.elements.bonuscode;
const codeKnopf = form.querySelector(".bonus-btn");
const codeStatus = document.getElementById("bonus-status");

// Preise in Rappen. Der Server rechnet unabhängig davon noch einmal nach.
const PREIS_CAR = 7990;
const PREIS_WALK = 3990;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Meldung in der aktuell gewählten Sprache, mit Deutsch als Rückfall.
function sagt(schluessel) {
  const sprache = document.documentElement.lang || "de";
  const woerter = (window.MAFO_TEXTE || {})[sprache] || (window.MAFO_TEXTE || {}).de || {};
  return woerter[schluessel] || "";
}

function anzahl(feld) {
  const n = Number.parseInt(feld.value, 10);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function chf(rappen) {
  return `CHF ${(rappen / 100).toFixed(2)}`;
}

// Gültiger Bonuscode, wie ihn der Server bestätigt hat: { eingabe, code, prozent }
let bonus = null;

function zeigeTotal() {
  const rappen =
    anzahl(form.elements.anzahlCar) * PREIS_CAR + anzahl(form.elements.anzahlWalk) * PREIS_WALK;
  if (bonus && rappen > 0) {
    // Gleiche Rundung wie auf dem Server: auf 5 Rappen
    const reduziert = Math.round((rappen * (100 - bonus.prozent)) / 100 / 5) * 5;
    altAnzeige.textContent = chf(rappen);
    altAnzeige.hidden = false;
    totalAnzeige.textContent = chf(reduziert);
  } else {
    altAnzeige.hidden = true;
    totalAnzeige.textContent = chf(rappen);
  }
}

function codeMeldung(schluessel, zustand) {
  codeStatus.textContent = schluessel ? sagt(schluessel).replace("{p}", bonus ? bonus.prozent : "") : "";
  if (zustand) codeStatus.setAttribute("data-state", zustand);
  else codeStatus.removeAttribute("data-state");
}

// Prüft den eingegebenen Code beim Server. true, wenn kein Code eingegeben
// ist oder der Code gilt.
async function einloesen() {
  const eingabe = codeFeld.value.trim();
  if (!eingabe) {
    bonus = null;
    codeMeldung("", "");
    zeigeTotal();
    return true;
  }
  if (bonus && bonus.eingabe === eingabe) return true;

  codeKnopf.disabled = true;
  codeMeldung("order.codeChecking", "");
  try {
    const antwort = await fetch("/api/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: eingabe }),
    });
    const ergebnis = await antwort.json().catch(() => ({}));
    if (antwort.ok && ergebnis.ok) {
      bonus = { eingabe, code: ergebnis.code, prozent: ergebnis.prozent };
      codeMeldung("order.codeOk", "success");
      return true;
    }
    bonus = null;
    codeMeldung(antwort.status === 404 ? "order.codeInvalid" : "order.codeError", "error");
    return false;
  } catch (error) {
    bonus = null;
    codeMeldung("order.codeError", "error");
    return false;
  } finally {
    codeKnopf.disabled = false;
    zeigeTotal();
  }
}

codeKnopf.addEventListener("click", einloesen);
codeFeld.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    einloesen();
  }
});
codeFeld.addEventListener("input", () => {
  // Wer den Code ändert, muss ihn neu einlösen.
  if (bonus && codeFeld.value.trim() !== bonus.eingabe) {
    bonus = null;
    codeMeldung("", "");
    zeigeTotal();
  }
});

form.elements.anzahlCar.addEventListener("change", zeigeTotal);
form.elements.anzahlWalk.addEventListener("change", zeigeTotal);
zeigeTotal();

function fehler(schluessel) {
  status.textContent = sagt(schluessel);
  status.setAttribute("data-state", "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = form.querySelector("button[type='submit']");
  const beschriftung = submitButton.textContent;
  const data = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    street: form.elements.street.value.trim(),
    zip: form.elements.zip.value.trim(),
    city: form.elements.city.value.trim(),
    anzahlCar: anzahl(form.elements.anzahlCar),
    anzahlWalk: anzahl(form.elements.anzahlWalk),
    company: form.elements.company.value, // honeypot
  };

  status.textContent = "";
  status.removeAttribute("data-state");

  if (!data.name || !data.email || !data.street || !data.zip || !data.city) {
    return fehler("order.missing");
  }
  if (!EMAIL_RE.test(data.email)) {
    return fehler("order.badEmail");
  }
  if (!/^\d{4}$/.test(data.zip)) {
    return fehler("order.badZip");
  }
  if (data.anzahlCar + data.anzahlWalk === 0) {
    return fehler("order.noItems");
  }
  // Eingetippt, aber nicht eingelöst: jetzt prüfen statt still ohne Rabatt bestellen.
  submitButton.disabled = true;
  const codeOk = await einloesen();
  submitButton.disabled = false;
  if (!codeOk) {
    status.textContent = codeStatus.textContent;
    status.setAttribute("data-state", "error");
    return;
  }
  data.bonuscode = bonus ? bonus.code : "";

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
      if (result.feld === "bonuscode") {
        bonus = null;
        codeMeldung("order.codeInvalid", "error");
        zeigeTotal();
        return fehler("order.codeInvalid");
      }
      throw new Error(result.error || "Senden fehlgeschlagen.");
    }

    form.reset();
    bonus = null;
    codeMeldung("", "");
    zeigeTotal();
    status.textContent = sagt("order.success");
    if (result.nummer) {
      // Die Bestellnummer soll nie mitten im Wort umbrechen.
      const nummer = document.createElement("span");
      nummer.style.whiteSpace = "nowrap";
      nummer.textContent = result.nummer;
      status.append(` ${sagt("order.number")}: `, nummer);
    }
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
