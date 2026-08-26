/*
 * Nachrichten-Fenster.
 *
 * Baut den Knopf und das Fenster selbst auf, damit kein fremdes Skript geladen
 * werden muss. Abgeschickte Nachrichten gehen über /api/chat als E-Mail an uns.
 * Die Texte kommen aus i18n.js und wechseln mit der Seitensprache.
 */

(function () {
  const sagt = (schluessel) => {
    const sprache = document.documentElement.lang || "de";
    const woerter = (window.MAFO_TEXTE || {})[sprache] || (window.MAFO_TEXTE || {}).de || {};
    return woerter[schluessel] || "";
  };

  const el = (tag, klasse, text) => {
    const n = document.createElement(tag);
    if (klasse) n.className = klasse;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  // --- Aufbau ---------------------------------------------------------------

  const knopf = el("button", "chat-knopf");
  knopf.type = "button";
  knopf.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';

  const fenster = el("div", "chat-fenster");
  fenster.hidden = true;

  const kopf = el("div", "chat-kopf");
  const titel = el("strong", null, "");
  const schliessen = el("button", "chat-schliessen", "×");
  schliessen.type = "button";
  kopf.append(titel, schliessen);

  const einleitung = el("p", "chat-intro", "");

  const formular = el("form", "chat-form");
  const felder = {};
  for (const [name, typ] of [["name", "text"], ["email", "email"]]) {
    const feld = el("label", "chat-feld");
    const beschriftung = el("span", null, "");
    const eingabe = document.createElement("input");
    eingabe.type = typ;
    eingabe.name = name;
    eingabe.autocomplete = name === "email" ? "email" : "name";
    if (name === "email") eingabe.required = true;
    feld.append(beschriftung, eingabe);
    formular.append(feld);
    felder[name] = { beschriftung, eingabe };
  }

  const nachrichtFeld = el("label", "chat-feld");
  const nachrichtLabel = el("span", null, "");
  const nachrichtEingabe = document.createElement("textarea");
  nachrichtEingabe.name = "nachricht";
  nachrichtEingabe.rows = 4;
  nachrichtEingabe.required = true;
  nachrichtFeld.append(nachrichtLabel, nachrichtEingabe);
  formular.append(nachrichtFeld);

  // Honeypot
  const falle = el("div", "chat-falle");
  falle.setAttribute("aria-hidden", "true");
  const falleEingabe = document.createElement("input");
  falleEingabe.type = "text";
  falleEingabe.name = "company";
  falleEingabe.tabIndex = -1;
  falleEingabe.autocomplete = "off";
  falle.append(falleEingabe);
  formular.append(falle);

  const senden = el("button", "btn btn-primary chat-senden", "");
  senden.type = "submit";
  formular.append(senden);

  const hinweis = el("p", "chat-hinweis", "");
  const meldung = el("p", "chat-meldung", "");
  meldung.setAttribute("role", "status");
  meldung.setAttribute("aria-live", "polite");
  formular.append(hinweis, meldung);

  fenster.append(kopf, einleitung, formular);
  document.body.append(knopf, fenster);

  // --- Beschriftungen -------------------------------------------------------

  function beschrifte() {
    knopf.setAttribute("aria-label", sagt("chat.button"));
    titel.textContent = sagt("chat.title");
    schliessen.setAttribute("aria-label", sagt("chat.close"));
    einleitung.textContent = sagt("chat.intro");
    felder.name.beschriftung.textContent = sagt("chat.name");
    felder.email.beschriftung.textContent = sagt("chat.email");
    nachrichtLabel.textContent = sagt("chat.message");
    senden.textContent = sagt("chat.send");
    hinweis.textContent = sagt("chat.note");
  }

  // --- Verhalten ------------------------------------------------------------

  const oeffnen = () => {
    beschrifte();
    fenster.hidden = false;
    knopf.classList.add("offen");
    nachrichtEingabe.focus();
  };

  const zu = () => {
    fenster.hidden = true;
    knopf.classList.remove("offen");
    knopf.focus();
  };

  knopf.addEventListener("click", () => (fenster.hidden ? oeffnen() : zu()));
  schliessen.addEventListener("click", zu);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !fenster.hidden) zu();
  });

  formular.addEventListener("submit", async (e) => {
    e.preventDefault();
    const beschriftung = senden.textContent;

    const daten = {
      name: felder.name.eingabe.value.trim(),
      email: felder.email.eingabe.value.trim(),
      nachricht: nachrichtEingabe.value.trim(),
      company: falleEingabe.value,
      seite: location.pathname,
      sprache: document.documentElement.lang || "de",
    };

    meldung.textContent = "";
    meldung.removeAttribute("data-state");

    if (!daten.email || !daten.nachricht) {
      meldung.textContent = sagt("chat.missing");
      meldung.setAttribute("data-state", "error");
      return;
    }

    senden.disabled = true;
    senden.textContent = sagt("chat.sending");

    try {
      const antwort = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(daten),
      });
      if (!antwort.ok) throw new Error("Senden fehlgeschlagen");

      formular.reset();
      meldung.textContent = sagt("chat.success");
      meldung.setAttribute("data-state", "success");
    } catch (fehler) {
      meldung.textContent = sagt("chat.error");
      meldung.setAttribute("data-state", "error");
    } finally {
      senden.disabled = false;
      senden.textContent = beschriftung;
    }
  });

  // Sprache kann sich nach dem Laden ändern – Beschriftungen dann mitziehen.
  document.addEventListener("DOMContentLoaded", beschrifte);
  document.querySelectorAll(".lang-switch button").forEach((b) =>
    b.addEventListener("click", () => setTimeout(beschrifte, 0))
  );
  beschrifte();
})();
