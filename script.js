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

/*
 * 360-Grad-Ansicht: 27 Einzelbilder, die man mit Finger, Maus oder Pfeiltasten
 * dreht. Von selbst dreht sie langsam, bis jemand anfasst, und nach einer
 * Pause wieder. Die Bilder werden erst geladen, wenn der Abschnitt in die Nähe
 * des Bildschirms kommt.
 */
document.querySelectorAll(".rundum-viewer").forEach((viewer) => {
  const bild = viewer.querySelector("img");
  const anzahl = Number(viewer.dataset.frames);
  const bilder = [];
  let geladen = 0;
  let index = 0; // gezeigtes Bild
  let position = 0; // Drehlage in Bildern, mit Bruchteilen
  let aktiv = false; // Finger oder Maus unten
  let letzteX = 0;
  let letzteZeit = 0;
  let schwung = 0; // Bilder pro 16 ms, Nachlauf nach dem Loslassen
  let pauseBis = 0; // bis dahin kein automatisches Drehen
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function laden() {
    for (let i = 0; i < anzahl; i++) {
      const im = new Image();
      im.decoding = "async";
      im.addEventListener("load", () => { geladen++; });
      im.src = viewer.dataset.src.replace("{i}", String(i).padStart(2, "0"));
      bilder.push(im);
    }
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((eintraege) => {
      if (eintraege.some((e) => e.isIntersecting)) { laden(); io.disconnect(); }
    }, { rootMargin: "400px" });
    io.observe(viewer);
  } else {
    laden();
  }

  function zeige(p) {
    position = ((p % anzahl) + anzahl) % anzahl;
    const i = Math.round(position) % anzahl;
    const im = bilder[i];
    if (i !== index && im && im.complete && im.naturalWidth) {
      index = i;
      bild.src = im.src;
    }
  }

  // Eine ganze Umdrehung entspricht etwa 1,3 Breiten des Betrachters
  const proBild = () => (viewer.clientWidth * 1.3) / anzahl;

  function anfassen() {
    viewer.classList.add("beruehrt");
    pauseBis = performance.now() + 4000;
  }

  viewer.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    aktiv = true;
    letzteX = e.clientX;
    letzteZeit = performance.now();
    schwung = 0;
    viewer.classList.add("greift");
    anfassen();
    viewer.setPointerCapture(e.pointerId);
  });
  viewer.addEventListener("pointermove", (e) => {
    if (!aktiv) return;
    const jetzt = performance.now();
    const dBild = (e.clientX - letzteX) / proBild();
    zeige(position + dBild);
    const dt = Math.max(1, jetzt - letzteZeit);
    schwung = 0.6 * schwung + 0.4 * ((dBild / dt) * 16);
    letzteX = e.clientX;
    letzteZeit = jetzt;
  });
  const loslassen = () => {
    if (!aktiv) return;
    aktiv = false;
    viewer.classList.remove("greift");
    pauseBis = performance.now() + 4000;
  };
  viewer.addEventListener("pointerup", loslassen);
  viewer.addEventListener("pointercancel", loslassen);
  viewer.addEventListener("lostpointercapture", loslassen);

  viewer.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    anfassen();
    zeige(position + (e.key === "ArrowRight" ? 1 : -1));
  });

  let letzter = 0;
  function schritt(t) {
    const dt = letzter ? Math.min(50, t - letzter) : 16;
    letzter = t;
    if (!aktiv) {
      if (Math.abs(schwung) > 0.003) {
        zeige(position + (schwung * dt) / 16);
        schwung *= Math.pow(0.94, dt / 16);
      } else if (!ruhig && t > pauseBis && geladen === anzahl) {
        zeige(position + dt / 160); // von selbst: ein Bild alle 160 ms
      }
    }
    requestAnimationFrame(schritt);
  }
  requestAnimationFrame(schritt);
});
