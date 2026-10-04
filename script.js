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
 * Pause wieder. Zoom mit zwei Fingern, Doppeltippen, Ctrl + Mausrad oder den
 * Knöpfen; gezoomt verschiebt ein Finger das Bild, die Pfeile drehen weiter.
 * Die kleinen Bilder laden, wenn der Abschnitt in die Nähe kommt, die grossen
 * erst beim Zoomen und nur für das gezeigte Bild.
 */
document.querySelectorAll(".rundum-viewer").forEach((viewer) => {
  const bild = viewer.querySelector("img");
  const anzahl = Number(viewer.dataset.frames);
  const ZOOM_MAX = 2.5;
  const quelle = (i, gross) =>
    (gross ? viewer.dataset.srcGross : viewer.dataset.src).replace("{i}", String(i).padStart(2, "0"));
  const klein = [];
  const gross = [];
  let geladen = 0;
  let index = 0; // gezeigtes Bild
  let position = 0; // Drehlage in Bildern, mit Bruchteilen
  let schwung = 0; // Bilder pro 16 ms, Nachlauf nach dem Loslassen
  let pauseBis = 0; // bis dahin kein automatisches Drehen
  let zoom = 1;
  let tx = 0; // Verschiebung des gezoomten Bilds in Pixeln
  let ty = 0;
  const finger = new Map(); // aktive Finger oder Maus: id -> {x, y}
  let geste = null; // laufende Geste: drehen, schieben oder kneifen
  let letztesTippen = 0;
  const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const knopf = (name) => viewer.querySelector(".rundum-" + name);

  const fertig = (im) => im && im.complete && im.naturalWidth > 0;

  function laden() {
    for (let i = 0; i < anzahl; i++) {
      const im = new Image();
      im.decoding = "async";
      im.addEventListener("load", () => { geladen++; });
      im.src = quelle(i, false);
      klein.push(im);
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

  // Grosse Fassung eines Bilds holen; sie erscheint, sobald sie da ist
  function grossLaden(i) {
    if (!gross[i]) {
      const im = new Image();
      im.decoding = "async";
      im.addEventListener("load", () => { if (zoom > 1 && index === i) bild.src = im.src; });
      im.src = quelle(i, true);
      gross[i] = im;
    }
    return gross[i];
  }

  function zeigeBild(i) {
    index = i;
    const g = zoom > 1 ? grossLaden(i) : null;
    const im = fertig(g) ? g : klein[i];
    if (fertig(im)) bild.src = im.src;
  }

  function zeige(p) {
    position = ((p % anzahl) + anzahl) % anzahl;
    const i = Math.round(position) % anzahl;
    if (i !== index) zeigeBild(i);
  }

  // Zoom und Verschiebung anwenden; das Bild bleibt immer rahmenfüllend
  function wende() {
    const mx = (viewer.clientWidth * (zoom - 1)) / 2;
    const my = (viewer.clientHeight * (zoom - 1)) / 2;
    tx = Math.max(-mx, Math.min(mx, tx));
    ty = Math.max(-my, Math.min(my, ty));
    bild.style.transform = zoom === 1 ? "" : `translate(${tx}px, ${ty}px) scale(${zoom})`;
    viewer.classList.toggle("gezoomt", zoom > 1);
    knopf("zoom.plus").disabled = zoom >= ZOOM_MAX - 0.01;
    knopf("zoom.minus").disabled = zoom <= 1;
  }

  // Auf 'neu' zoomen, so dass der Punkt (px, py) relativ zur Mitte stehen bleibt
  function zoomeAuf(neu, px, py, sanft) {
    neu = Math.max(1, Math.min(ZOOM_MAX, neu));
    if (neu < 1.15) neu = 1; // knapp über 1 rastet auf 1 ein
    const f = neu / zoom;
    tx = px - (px - tx) * f;
    ty = py - (py - ty) * f;
    zoom = neu;
    if (zoom === 1) { tx = 0; ty = 0; }
    bild.classList.toggle("sanft", !!sanft);
    wende();
    if (zoom > 1) {
      const g = grossLaden(index);
      if (fertig(g)) bild.src = g.src;
    }
  }

  // Punkt relativ zur Mitte des Betrachters
  function relativ(x, y) {
    const r = viewer.getBoundingClientRect();
    return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
  }
  const abstand = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const mitte = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  // Eine ganze Umdrehung entspricht etwa 1,3 Breiten des Betrachters
  const proBild = () => (viewer.clientWidth * 1.3) / anzahl;

  function anfassen() {
    viewer.classList.add("beruehrt");
    pauseBis = performance.now() + 4000;
  }

  function einFingerGeste(x, y) {
    return { art: zoom > 1 ? "schieben" : "drehen", x, y, x0: x, y0: y, tx0: tx, ty0: ty, zeit: performance.now() };
  }

  viewer.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    viewer.setPointerCapture(e.pointerId);
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    anfassen();
    viewer.classList.add("greift");
    bild.classList.remove("sanft");
    schwung = 0;
    if (finger.size >= 2) {
      const [a, b] = [...finger.values()];
      geste = { art: "kneifen", abstand: abstand(a, b), mitte: relativ(mitte(a, b).x, mitte(a, b).y), zoom0: zoom, tx0: tx, ty0: ty };
    } else {
      geste = einFingerGeste(e.clientX, e.clientY);
    }
  });

  viewer.addEventListener("pointermove", (e) => {
    if (!finger.has(e.pointerId) || !geste) return;
    finger.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (geste.art === "kneifen") {
      if (finger.size < 2) return;
      const [a, b] = [...finger.values()];
      const neu = Math.max(1, Math.min(ZOOM_MAX, (geste.zoom0 * abstand(a, b)) / geste.abstand));
      const m = mitte(a, b);
      const p1 = relativ(m.x, m.y);
      const f = neu / geste.zoom0;
      // Der Punkt, der zu Beginn unter der Fingermitte lag, folgt der Fingermitte
      tx = p1.x - (geste.mitte.x - geste.tx0) * f;
      ty = p1.y - (geste.mitte.y - geste.ty0) * f;
      zoom = neu;
      wende();
      if (zoom > 1) grossLaden(index);
    } else if (geste.art === "drehen") {
      const jetzt = performance.now();
      const dBild = (e.clientX - geste.x) / proBild();
      zeige(position + dBild);
      const dt = Math.max(1, jetzt - geste.zeit);
      schwung = 0.6 * schwung + 0.4 * ((dBild / dt) * 16);
      geste.x = e.clientX;
      geste.zeit = jetzt;
    } else {
      tx = geste.tx0 + (e.clientX - geste.x0);
      ty = geste.ty0 + (e.clientY - geste.y0);
      wende();
    }
  });

  function loslassen(e, abgebrochen) {
    if (!finger.has(e.pointerId)) return;
    finger.delete(e.pointerId);
    if (geste && geste.art === "kneifen") {
      // Bleibt ein Finger, geht es mit ihm weiter; die Zoomstufe bleibt
      const rest = [...finger.values()][0];
      geste = rest ? einFingerGeste(rest.x, rest.y) : null;
      if (zoom > 1) zeigeBild(index);
    } else if (geste) {
      // Doppeltippen: zwei kurze Tipps ohne Bewegung kurz nacheinander
      const kurz = performance.now() - geste.zeit < 300;
      const still = Math.hypot(e.clientX - geste.x0, e.clientY - geste.y0) < 8;
      if (!abgebrochen && kurz && still) {
        const jetzt = performance.now();
        if (jetzt - letztesTippen < 350) {
          const p = relativ(e.clientX, e.clientY);
          zoomeAuf(zoom > 1 ? 1 : 2, p.x, p.y, true);
          letztesTippen = 0;
        } else {
          letztesTippen = jetzt;
        }
      }
      geste = null;
    }
    if (finger.size === 0) {
      viewer.classList.remove("greift");
      pauseBis = performance.now() + 4000;
    }
  }
  viewer.addEventListener("pointerup", (e) => loslassen(e, false));
  viewer.addEventListener("pointercancel", (e) => loslassen(e, true));
  viewer.addEventListener("lostpointercapture", (e) => loslassen(e, true));

  // Ctrl + Mausrad (oder Trackpad-Kneifen) zoomt; gezoomt reicht das Rad allein
  viewer.addEventListener("wheel", (e) => {
    if (zoom === 1 && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    anfassen();
    const p = relativ(e.clientX, e.clientY);
    zoomeAuf(zoom * Math.exp(-e.deltaY * 0.0025), p.x, p.y, false);
  }, { passive: false });

  viewer.addEventListener("keydown", (e) => {
    const taste = e.key;
    if (taste === "ArrowLeft" || taste === "ArrowRight") {
      anfassen();
      zeige(position + (taste === "ArrowRight" ? 1 : -1));
    } else if (taste === "+" || taste === "=") {
      anfassen();
      zoomeAuf(zoom * 1.5, 0, 0, true);
    } else if (taste === "-") {
      anfassen();
      zoomeAuf(zoom / 1.5, 0, 0, true);
    } else if (taste === "0" || taste === "Escape") {
      zoomeAuf(1, 0, 0, true);
    } else {
      return;
    }
    e.preventDefault();
  });

  knopf("dreh.links").addEventListener("click", () => { anfassen(); zeige(position - 1); });
  knopf("dreh.rechts").addEventListener("click", () => { anfassen(); zeige(position + 1); });
  knopf("zoom.plus").addEventListener("click", () => { anfassen(); zoomeAuf(zoom * 1.5, 0, 0, true); });
  knopf("zoom.minus").addEventListener("click", () => { anfassen(); zoomeAuf(zoom / 1.5, 0, 0, true); });

  let letzter = 0;
  function schritt(t) {
    const dt = letzter ? Math.min(50, t - letzter) : 16;
    letzter = t;
    if (!geste) {
      if (Math.abs(schwung) > 0.003) {
        zeige(position + (schwung * dt) / 16);
        schwung *= Math.pow(0.94, dt / 16);
      } else if (!ruhig && zoom === 1 && t > pauseBis && geladen === anzahl) {
        zeige(position + dt / 160); // von selbst: ein Bild alle 160 ms
      }
    }
    requestAnimationFrame(schritt);
  }
  requestAnimationFrame(schritt);
});
