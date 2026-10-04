/*
 * Warenkorb und Kasse.
 *
 * Der Warenkorb liegt im Browser (localStorage), damit er beim nächsten Besuch
 * noch da ist. Auf den Produktseiten legt die Kaufbox Artikel hinein und öffnet
 * das Warenkorb-Fenster; die Kasse (kasse.html) führt in vier Schritten durch
 * Warenkorb, Adresse, Zahlungsart und Prüfung. Preise stehen hier nur für die
 * Anzeige, der Server rechnet bei jeder Bestellung selbst nach.
 */
const ARTIKEL = {
  car: { preis: 7990, name: "order.optCar", feld: "anzahlCar" },
  walk: { preis: 3990, name: "order.optWalk", feld: "anzahlWalk" },
};
const MAX_PRO_ARTIKEL = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Meldung in der aktuell gewählten Sprache, mit Deutsch als Rückfall.
function sagt(schluessel) {
  const sprache = document.documentElement.lang || "de";
  const woerter = (window.MAFO_TEXTE || {})[sprache] || (window.MAFO_TEXTE || {}).de || {};
  return woerter[schluessel] || "";
}

function chf(rappen) {
  return `CHF ${(rappen / 100).toFixed(2)}`;
}

// Gleiche Rundung wie auf dem Server: auf 5 Rappen
function mitRabatt(rappen, prozent) {
  return Math.round((rappen * (100 - prozent)) / 100 / 5) * 5;
}

function speicher(schluessel, wert) {
  try {
    if (wert === null) localStorage.removeItem(schluessel);
    else localStorage.setItem(schluessel, wert);
  } catch (e) {
    /* Privatmodus oder gesperrter Speicher: der Warenkorb lebt dann nur bis zum Neuladen */
  }
}

function gespeichert(schluessel) {
  try {
    return localStorage.getItem(schluessel);
  } catch (e) {
    return null;
  }
}

const Warenkorb = {
  _inhalt: null,

  lesen() {
    if (!this._inhalt) {
      let roh = {};
      try { roh = JSON.parse(gespeichert("mafo-warenkorb") || "{}") || {}; } catch (e) { roh = {}; }
      this._inhalt = {};
      for (const art of Object.keys(ARTIKEL)) {
        const n = Number.parseInt(roh[art], 10);
        this._inhalt[art] = Number.isInteger(n) ? Math.min(MAX_PRO_ARTIKEL, Math.max(0, n)) : 0;
      }
    }
    return this._inhalt;
  },

  setze(art, n) {
    const inhalt = this.lesen();
    inhalt[art] = Math.min(MAX_PRO_ARTIKEL, Math.max(0, n));
    speicher("mafo-warenkorb", JSON.stringify(inhalt));
    document.dispatchEvent(new CustomEvent("mafo:warenkorb"));
  },

  leeren() {
    for (const art of Object.keys(ARTIKEL)) this.lesen()[art] = 0;
    speicher("mafo-warenkorb", null);
    document.dispatchEvent(new CustomEvent("mafo:warenkorb"));
  },

  anzahl() {
    return Object.values(this.lesen()).reduce((s, n) => s + n, 0);
  },

  zwischensumme() {
    const inhalt = this.lesen();
    return Object.keys(ARTIKEL).reduce((s, art) => s + inhalt[art] * ARTIKEL[art].preis, 0);
  },
};

function element(tag, klasse, text) {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (text !== undefined) el.textContent = text;
  return el;
}

// Text, der bei einem Sprachwechsel von i18n.js neu gesetzt wird
function uebersetzt(tag, klasse, schluessel) {
  const el = element(tag, klasse, sagt(schluessel));
  el.dataset.i18n = schluessel;
  return el;
}

function beschriftet(el, schluessel) {
  el.dataset.i18nLabel = schluessel;
  el.setAttribute("aria-label", sagt(schluessel));
  return el;
}

// Mengenwähler: − n +
function mengenwaehler(wert, aufAenderung) {
  const box = element("div", "wk-menge");
  box.setAttribute("role", "group");
  beschriftet(box, "order.qty");
  const minus = beschriftet(element("button", "wk-minus", "−"), "cart.less");
  const plus = beschriftet(element("button", "wk-plus", "+"), "cart.more");
  minus.type = plus.type = "button";
  const zahl = element("span", "wk-n", String(wert));
  zahl.setAttribute("aria-live", "polite");
  box.append(minus, zahl, plus);
  const setze = (n) => {
    n = Math.min(MAX_PRO_ARTIKEL, Math.max(0, n));
    zahl.textContent = String(n);
    minus.disabled = n <= (box.dataset.min === "1" ? 1 : 0);
    plus.disabled = n >= MAX_PRO_ARTIKEL;
    return n;
  };
  minus.addEventListener("click", () => aufAenderung(setze(Number(zahl.textContent) - 1)));
  plus.addEventListener("click", () => aufAenderung(setze(Number(zahl.textContent) + 1)));
  box.setze = setze;
  setze(wert);
  return box;
}

// Artikelzeilen des Warenkorbs in einen Container zeichnen
function zeichneZeilen(container) {
  container.replaceChildren();
  const inhalt = Warenkorb.lesen();
  for (const art of Object.keys(ARTIKEL)) {
    if (!inhalt[art]) continue;
    const zeile = element("div", "wk-zeile");
    zeile.dataset.art = art;
    const name = element("div", "wk-name");
    name.append(uebersetzt("span", "", ARTIKEL[art].name), element("small", "", chf(ARTIKEL[art].preis)));
    const preis = element("div", "wk-preis", chf(inhalt[art] * ARTIKEL[art].preis));
    const entfernen = beschriftet(element("button", "wk-entfernen"), "cart.remove");
    entfernen.type = "button";
    entfernen.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    entfernen.addEventListener("click", () => Warenkorb.setze(art, 0));
    const menge = mengenwaehler(inhalt[art], (n) => Warenkorb.setze(art, n));
    zeile.append(name, menge, preis, entfernen);
    container.append(zeile);
  }
}

/* ---------- Kopfzeile: Knopf mit Anzahl ---------- */
function zeichneZaehler() {
  document.querySelectorAll("[data-warenkorb-zahl]").forEach((el) => {
    const n = Warenkorb.anzahl();
    el.textContent = String(n);
    el.hidden = n === 0;
  });
}

/* ---------- Warenkorb-Fenster (auf allen Seiten ausser der Kasse) ---------- */
let fenster = null;

function baueWarenkorbFenster() {
  const hintergrund = element("div", "warenkorb-hintergrund");
  hintergrund.hidden = true;
  const box = element("aside", "warenkorb");
  box.id = "warenkorb";
  box.hidden = true;
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-labelledby", "warenkorb-titel");

  const kopf = element("div", "warenkorb-kopf");
  const titel = uebersetzt("h2", "", "cart.title");
  titel.id = "warenkorb-titel";
  const zu = beschriftet(element("button", "warenkorb-zu"), "cart.close");
  zu.type = "button";
  zu.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  kopf.append(titel, zu);

  const inhalt = element("div", "warenkorb-inhalt");
  const zeilen = element("div", "wk-liste");
  const leer = uebersetzt("p", "warenkorb-leer", "cart.empty");
  inhalt.append(zeilen, leer);

  const fuss = element("div", "warenkorb-fuss");
  const summe = element("p", "warenkorb-summe");
  const summeWert = element("strong");
  summe.append(uebersetzt("span", "", "cart.subtotal"), summeWert);
  const hinweis = uebersetzt("small", "", "order.totalNote");
  const kasse = uebersetzt("a", "btn btn-primary warenkorb-kasse", "cart.checkout");
  kasse.href = "kasse.html";
  const weiter = uebersetzt("button", "btn btn-secondary warenkorb-weiter", "cart.continue");
  weiter.type = "button";
  fuss.append(summe, hinweis, kasse, weiter);

  box.append(kopf, inhalt, fuss);
  document.body.append(hintergrund, box);

  const schliessen = () => {
    box.classList.remove("offen");
    hintergrund.classList.remove("offen");
    document.body.classList.remove("warenkorb-offen");
    document.querySelectorAll(".topbar-warenkorb").forEach((k) => k.setAttribute("aria-expanded", "false"));
    setTimeout(() => { if (!box.classList.contains("offen")) { box.hidden = true; hintergrund.hidden = true; } }, 250);
  };
  const oeffnen = () => {
    box.hidden = false;
    hintergrund.hidden = false;
    requestAnimationFrame(() => {
      box.classList.add("offen");
      hintergrund.classList.add("offen");
    });
    document.body.classList.add("warenkorb-offen");
    document.querySelectorAll(".topbar-warenkorb").forEach((k) => k.setAttribute("aria-expanded", "true"));
    zu.focus();
  };
  zu.addEventListener("click", schliessen);
  weiter.addEventListener("click", schliessen);
  hintergrund.addEventListener("click", schliessen);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && box.classList.contains("offen")) schliessen(); });

  const zeichnen = () => {
    zeichneZeilen(zeilen);
    const n = Warenkorb.anzahl();
    leer.hidden = n > 0;
    fuss.hidden = n === 0;
    summeWert.textContent = chf(Warenkorb.zwischensumme());
  };
  zeichnen();
  document.addEventListener("mafo:warenkorb", zeichnen);
  return { oeffnen, schliessen };
}

/* ---------- Kaufbox auf den Produktseiten ---------- */
function baueKaufboxen() {
  document.querySelectorAll(".kaufbox").forEach((box) => {
    const art = box.dataset.art;
    const knopf = box.querySelector(".kaufbox-knopf");
    const platz = box.querySelector(".kaufbox-menge");
    let gewuenscht = 1;
    const menge = mengenwaehler(1, (n) => { gewuenscht = n; });
    menge.dataset.min = "1";
    menge.setze(1);
    platz.replaceWith(menge);

    knopf.addEventListener("click", () => {
      Warenkorb.setze(art, Warenkorb.lesen()[art] + gewuenscht);
      const vorher = knopf.textContent;
      knopf.textContent = `✓ ${sagt("cart.added")}`;
      knopf.classList.add("ist-drin");
      setTimeout(() => {
        knopf.textContent = sagt("cart.add") || vorher;
        knopf.classList.remove("ist-drin");
      }, 1800);
      if (fenster) fenster.oeffnen();
    });
  });
}

/* ---------- Kasse ---------- */
function baueKasse(form) {
  const SCHRITTE = ["warenkorb", "adresse", "zahlung", "pruefen", "danke"];
  const status = document.getElementById("form-status");
  const zeilen = document.getElementById("kasse-zeilen");
  const leer = form.querySelector(".kasse-leer");
  const summenBox = document.getElementById("kasse-summen");
  const pruefArtikel = document.getElementById("pruef-artikel");
  const pruefSummen = document.getElementById("pruef-summen");
  const codeFeld = form.elements.bonuscode;
  const codeKnopf = form.querySelector(".bonus-btn");
  const codeStatus = document.getElementById("bonus-status");
  let bonus = null; // vom Server bestätigt: { eingabe, code, prozent }
  let bestellt = null; // Antwort des Servers nach erfolgreicher Bestellung

  function codeMeldung(schluessel, zustand) {
    codeStatus.textContent = schluessel ? sagt(schluessel).replace("{p}", bonus ? bonus.prozent : "") : "";
    if (zustand) codeStatus.setAttribute("data-state", zustand);
    else codeStatus.removeAttribute("data-state");
  }

  // Prüft den Code beim Server. true, wenn keiner eingegeben ist oder er gilt.
  async function einloesen() {
    const eingabe = codeFeld.value.trim();
    if (!eingabe) {
      bonus = null;
      speicher("mafo-bonus", null);
      codeMeldung("", "");
      zeichneSummen();
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
        speicher("mafo-bonus", eingabe);
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
      zeichneSummen();
    }
  }
  codeKnopf.addEventListener("click", einloesen);
  codeFeld.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); einloesen(); } });
  codeFeld.addEventListener("input", () => {
    if (bonus && codeFeld.value.trim() !== bonus.eingabe) {
      bonus = null;
      codeMeldung("", "");
      zeichneSummen();
    }
  });
  const gemerkt = gespeichert("mafo-bonus");
  if (gemerkt) {
    codeFeld.value = gemerkt;
    einloesen();
  }

  // Zwischensumme, Rabatt und Total in einen Container zeichnen
  function summenZeilen(container) {
    container.replaceChildren();
    const zwischen = Warenkorb.zwischensumme();
    const total = bonus ? mitRabatt(zwischen, bonus.prozent) : zwischen;
    const zeile = (schluessel, wert, klasse) => {
      const z = element("div", "summen-zeile" + (klasse ? " " + klasse : ""));
      z.append(uebersetzt("span", "", schluessel), element("strong", "", wert));
      container.append(z);
    };
    if (bonus) {
      zeile("cart.subtotal", chf(zwischen));
      zeile("kasse.discount", `${bonus.code} (−${bonus.prozent} %): −${chf(zwischen - total)}`);
    }
    zeile("order.total", chf(total), "summen-total");
    container.append(uebersetzt("small", "", "order.totalNote"));
    return total;
  }
  function zeichneSummen() {
    summenZeilen(summenBox);
    if (!form.querySelector('[data-schritt="pruefen"]').hidden) zeichnePruefung();
  }

  function zeichneWarenkorb() {
    zeichneZeilen(zeilen);
    const n = Warenkorb.anzahl();
    leer.hidden = n > 0;
    form.querySelector(".kasse-nur-mit-artikeln").hidden = n === 0;
    zeichneSummen();
  }
  document.addEventListener("mafo:warenkorb", () => {
    zeichneWarenkorb();
    if (Warenkorb.anzahl() === 0 && aktuellerSchritt !== "danke") zeigeSchritt("warenkorb");
  });

  function adresse() {
    return {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      street: form.elements.street.value.trim(),
      zip: form.elements.zip.value.trim(),
      city: form.elements.city.value.trim(),
    };
  }
  function adresseFehler() {
    const a = adresse();
    if (!a.name || !a.email || !a.street || !a.zip || !a.city) return "order.missing";
    if (!EMAIL_RE.test(a.email)) return "order.badEmail";
    if (!/^\d{4}$/.test(a.zip)) return "order.badZip";
    return "";
  }
  function zahlungsart() {
    const gewaehlt = form.querySelector('input[name="zahlung"]:checked');
    return gewaehlt ? gewaehlt.value : "";
  }

  function zeichnePruefung() {
    pruefArtikel.replaceChildren();
    const inhalt = Warenkorb.lesen();
    for (const art of Object.keys(ARTIKEL)) {
      if (!inhalt[art]) continue;
      const z = element("div", "pruef-zeile");
      const name = element("span");
      name.append(`${inhalt[art]} × `, uebersetzt("span", "", ARTIKEL[art].name));
      z.append(name, element("strong", "", chf(inhalt[art] * ARTIKEL[art].preis)));
      pruefArtikel.append(z);
    }
    summenZeilen(pruefSummen);
    const a = adresse();
    document.getElementById("pruef-adresse").textContent = `${a.name}\n${a.street}\n${a.zip} ${a.city}\n${a.email}`;
    const z = zahlungsart();
    const zahlungEl = document.getElementById("pruef-zahlung");
    zahlungEl.replaceChildren(z ? uebersetzt("span", "", z === "twint" ? "pay.twint" : "pay.vorauskasse") : "");
  }

  function meldung(schluessel, zustand) {
    status.textContent = schluessel ? sagt(schluessel) : "";
    if (zustand) status.setAttribute("data-state", zustand);
    else status.removeAttribute("data-state");
  }

  // Bis zu welchem Schritt die Angaben reichen
  function erlaubtBis() {
    if (Warenkorb.anzahl() === 0) return "warenkorb";
    if (adresseFehler()) return "adresse";
    if (!zahlungsart()) return "zahlung";
    return "pruefen";
  }

  let aktuellerSchritt = "";
  function zeigeSchritt(name) {
    if (!SCHRITTE.includes(name)) name = "warenkorb";
    if (name === "danke" && !bestellt) name = "warenkorb";
    if (name !== "danke" && SCHRITTE.indexOf(name) > SCHRITTE.indexOf(erlaubtBis())) name = erlaubtBis();
    aktuellerSchritt = name;
    form.querySelectorAll(".schritt").forEach((s) => { s.hidden = s.dataset.schritt !== name; });
    const stufe = SCHRITTE.indexOf(name);
    document.querySelectorAll(".schritte li").forEach((li) => {
      const i = SCHRITTE.indexOf(li.dataset.schritt);
      li.classList.toggle("aktiv", i === stufe);
      li.classList.toggle("erledigt", i < stufe);
      if (i === stufe) li.setAttribute("aria-current", "step");
      else li.removeAttribute("aria-current");
    });
    if (name === "pruefen") zeichnePruefung();
    meldung("", "");
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    const kopf = form.querySelector(`.schritt[data-schritt="${name}"] h2`);
    if (kopf && aktuellerSchrittGezeigt) kopf.scrollIntoView({ block: "start", behavior: "smooth" });
    aktuellerSchrittGezeigt = true;
  }
  let aktuellerSchrittGezeigt = false;

  // Weiter-Knöpfe prüfen den Schritt, bevor es weitergeht
  form.querySelectorAll("[data-weiter]").forEach((knopf) => {
    knopf.addEventListener("click", async () => {
      const ziel = knopf.dataset.weiter;
      if (ziel === "adresse" && Warenkorb.anzahl() === 0) return;
      if (ziel === "adresse" && aktuellerSchritt === "warenkorb") {
        knopf.disabled = true;
        const ok = await einloesen();
        knopf.disabled = false;
        if (!ok) return meldung("order.codeInvalid", "error");
      }
      if (SCHRITTE.indexOf(ziel) > SCHRITTE.indexOf("adresse")) {
        const f = adresseFehler();
        if (f) return meldung(f, "error");
      }
      if (SCHRITTE.indexOf(ziel) > SCHRITTE.indexOf("zahlung") && !zahlungsart()) {
        return meldung("kasse.noPay", "error");
      }
      location.hash = ziel;
    });
  });
  window.addEventListener("hashchange", () => zeigeSchritt(location.hash.slice(1)));

  // Kopfzeilen-Knopf führt auf der Kasse zum ersten Schritt
  document.querySelectorAll(".topbar-warenkorb").forEach((k) => {
    k.addEventListener("click", () => { location.hash = "warenkorb"; });
  });

  function zahlhinweis(ergebnis) {
    const box = document.getElementById("danke-zahlung");
    box.replaceChildren();
    const z = ergebnis.zahlung || {};
    box.append(uebersetzt("h3", "", "kasse.payNow"));
    const dl = element("dl");
    const reihe = (schluessel, wert) => {
      if (!wert) return;
      dl.append(uebersetzt("dt", "", schluessel), element("dd", "", wert));
    };
    reihe("kasse.payment", sagt(z.art === "twint" ? "pay.twint" : "pay.vorauskasse"));
    reihe("kasse.payAmount", chf(ergebnis.total));
    if (z.art === "twint") {
      reihe("kasse.payTwintNumber", z.twint);
      reihe("kasse.payMessage", ergebnis.nummer);
    } else {
      reihe("kasse.payIban", z.iban);
      reihe("kasse.payHolder", z.inhaber);
      reihe("kasse.payRef", ergebnis.nummer);
    }
    box.append(dl);
    if (z.art === "twint" && z.qr) {
      const bild = element("img");
      bild.src = z.qr;
      bild.alt = sagt("kasse.payTwintQr");
      bild.width = 200;
      box.append(uebersetzt("p", "", "kasse.payTwintQr"), bild);
    }
    const angaben = z.art === "twint" ? z.twint || z.qr : z.iban;
    if (!angaben) box.append(uebersetzt("p", "", "kasse.payPending"));
    box.append(uebersetzt("p", "", "pay.after"));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const knopf = form.querySelector('button[type="submit"]');
    const beschriftung = knopf.textContent;
    const f = adresseFehler();
    if (Warenkorb.anzahl() === 0) return zeigeSchritt("warenkorb");
    if (f) { zeigeSchritt("adresse"); return meldung(f, "error"); }
    if (!zahlungsart()) { zeigeSchritt("zahlung"); return meldung("kasse.noPay", "error"); }

    knopf.disabled = true;
    const codeOk = await einloesen();
    if (!codeOk) {
      knopf.disabled = false;
      zeigeSchritt("warenkorb");
      return meldung("order.codeInvalid", "error");
    }
    const inhalt = Warenkorb.lesen();
    const daten = {
      ...adresse(),
      anzahlCar: inhalt.car,
      anzahlWalk: inhalt.walk,
      bonuscode: bonus ? bonus.code : "",
      zahlung: zahlungsart(),
      company: form.elements.company.value, // Honeypot
    };
    knopf.textContent = sagt("order.sending");
    try {
      const antwort = await fetch("/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(daten),
      });
      const ergebnis = await antwort.json().catch(() => ({}));
      if (!antwort.ok) {
        if (ergebnis.feld === "bonuscode") {
          bonus = null;
          speicher("mafo-bonus", null);
          codeMeldung("order.codeInvalid", "error");
          zeigeSchritt("warenkorb");
          return meldung("order.codeInvalid", "error");
        }
        throw new Error(ergebnis.error || "Senden fehlgeschlagen.");
      }
      bestellt = ergebnis;
      document.getElementById("danke-nummer").textContent = ergebnis.nummer || "";
      zahlhinweis(ergebnis);
      bonus = null;
      speicher("mafo-bonus", null);
      codeFeld.value = "";
      codeMeldung("", "");
      form.elements.name.value = form.elements.email.value = form.elements.street.value = "";
      form.elements.zip.value = form.elements.city.value = "";
      Warenkorb.leeren();
      zeigeSchritt("danke");
    } catch (error) {
      meldung("order.error", "error");
    } finally {
      knopf.disabled = false;
      knopf.textContent = beschriftung;
    }
  });

  zeichneWarenkorb();
  zeigeSchritt(location.hash.slice(1) || "warenkorb");
}

document.addEventListener("DOMContentLoaded", () => {
  zeichneZaehler();
  document.addEventListener("mafo:warenkorb", zeichneZaehler);
  const kasseForm = document.getElementById("kasse-form");
  if (kasseForm) {
    baueKasse(kasseForm);
  } else {
    fenster = baueWarenkorbFenster();
    document.querySelectorAll(".topbar-warenkorb").forEach((k) => k.addEventListener("click", fenster.oeffnen));
    baueKaufboxen();
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
