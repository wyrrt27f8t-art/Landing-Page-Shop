/**
 * Zugangsschutz für die gesamte Website.
 *
 * Ohne gültigen Code bekommt jede Anfrage die Code-Eingabeseite (401) –
 * auch Bilder, Videos und die API. Der Code steht in der Umgebungsvariable
 * MAFO_ZUGANGSCODE; im Code selbst ist er bewusst nirgends hinterlegt.
 *
 * Zwei Wege hinein:
 *   1. Code auf der Eingabeseite eintippen
 *   2. Link mit ?code=... öffnen (zum Weitergeben)
 * Beides setzt ein Cookie, das 90 Tage gilt. ?abmelden=1 löscht es wieder.
 */

const COOKIE = "mafo_zugang";
const GUELTIG_TAGE = 90;

// Ohne Code erreichbar, damit die Eingabeseite ein Logo hat und der Browser
// ein Favicon zeigt. Verrät nichts, was die Domain nicht ohnehin verrät.
const OFFEN = new Set([
  "/logo.png",
  "/favicon.ico",
  "/favicon-32.png",
  "/apple-touch-icon.png",
  "/icon-512.png",
  "/robots.txt",
]);

export default async function middleware(request) {
  const url = new URL(request.url);
  const pfad = url.pathname;

  if (pfad.startsWith("/_vercel") || OFFEN.has(pfad)) return;

  const sprache = spracheWaehlen(url, request);
  const code = (process.env.MAFO_ZUGANGSCODE || "").trim();

  if (url.searchParams.has("abmelden")) return abmelden(url);

  // Zugang noch nicht eingerichtet: konsequent zu bleiben ist sicherer,
  // als versehentlich alles offen zu lassen.
  if (!code) return eingabeseite(sprache, { eingerichtet: false });

  const erwartet = await zeichen(code);

  const eingabe = url.searchParams.get("code");
  if (eingabe !== null) {
    if (gleich(await zeichen(eingabe), erwartet)) return einlassen(url, erwartet);
    await warte(400); // bremst automatisiertes Durchprobieren
    return eingabeseite(sprache, { falsch: true });
  }

  if (gleich(ausKeks(request.headers.get("cookie")), erwartet)) return;

  return eingabeseite(sprache, {});
}

/* ---------- Code prüfen ---------- */

// Gross-/Kleinschreibung, Leerzeichen und Bindestriche sollen keine Rolle
// spielen – der Code wird mündlich oder per Nachricht weitergegeben.
function vereinheitlichen(text) {
  return String(text).toLowerCase().replace(/[\s-]/g, "");
}

// Aus dem Code wird ein Kennzeichen abgeleitet, das im Cookie steht. So liegt
// der Code selbst nie im Browser – und ändert ihn jemand, gelten alle
// bisherigen Cookies sofort nicht mehr.
async function zeichen(code) {
  const schluessel = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(vereinheitlichen(code)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatur = await crypto.subtle.sign(
    "HMAC",
    schluessel,
    new TextEncoder().encode("mafo-zugang-v1"),
  );
  return [...new Uint8Array(signatur)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vergleicht ohne Zeitunterschied, damit sich der Code nicht Zeichen für
// Zeichen erraten lässt.
function gleich(a, b) {
  if (typeof a !== "string" || a.length !== b.length) return false;
  let abweichung = 0;
  for (let i = 0; i < a.length; i++) abweichung |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return abweichung === 0;
}

function ausKeks(kopfzeile) {
  if (!kopfzeile) return null;
  for (const teil of kopfzeile.split(";")) {
    const [name, ...rest] = teil.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

const warte = (ms) => new Promise((fertig) => setTimeout(fertig, ms));

/* ---------- Antworten ---------- */

function einlassen(url, kennzeichen) {
  const ziel = new URL(url);
  ziel.searchParams.delete("code");
  return new Response(null, {
    status: 303,
    headers: {
      Location: ziel.pathname + ziel.search,
      "Set-Cookie": `${COOKIE}=${kennzeichen}; Path=/; Max-Age=${GUELTIG_TAGE * 86400}; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

function abmelden(url) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: url.pathname,
      "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    },
  });
}

/* ---------- Eingabeseite ---------- */

const SPRACHEN = ["de", "fr", "it", "en"];

function spracheWaehlen(url, request) {
  const gewuenscht = url.searchParams.get("lang");
  if (SPRACHEN.includes(gewuenscht)) return gewuenscht;
  const kopfzeile = request.headers.get("accept-language") || "";
  for (const eintrag of kopfzeile.split(",")) {
    const kuerzel = eintrag.trim().slice(0, 2).toLowerCase();
    if (SPRACHEN.includes(kuerzel)) return kuerzel;
  }
  return "de";
}

const TEXTE = {
  de: {
    titel: "Zugang",
    lead: "Diese Seite ist noch nicht öffentlich. Gib den Code ein, den du von uns bekommen hast.",
    feld: "Code",
    knopf: "Weiter",
    falsch: "Dieser Code stimmt nicht. Bitte prüf ihn nochmal.",
    offen: "Der Zugang ist noch nicht eingerichtet.",
    kontakt: "Keinen Code? Schreib uns:",
  },
  fr: {
    titel: "Accès",
    lead: "Cette page n'est pas encore publique. Saisis le code que tu as reçu de notre part.",
    feld: "Code",
    knopf: "Continuer",
    falsch: "Ce code n'est pas correct. Vérifie-le encore une fois.",
    offen: "L'accès n'est pas encore configuré.",
    kontakt: "Pas de code ? Écris-nous :",
  },
  it: {
    titel: "Accesso",
    lead: "Questa pagina non è ancora pubblica. Inserisci il codice che hai ricevuto da noi.",
    feld: "Codice",
    knopf: "Continua",
    falsch: "Questo codice non è corretto. Controllalo ancora una volta.",
    offen: "L'accesso non è ancora configurato.",
    kontakt: "Non hai un codice? Scrivici:",
  },
  en: {
    titel: "Access",
    lead: "This page isn't public yet. Enter the code you received from us.",
    feld: "Code",
    knopf: "Continue",
    falsch: "That code isn't right. Please check it again.",
    offen: "Access hasn't been set up yet.",
    kontakt: "No code? Write to us:",
  },
};

function eingabeseite(sprache, { falsch = false, eingerichtet = true }) {
  const t = TEXTE[sprache];
  const hinweis = !eingerichtet
    ? `<p class="hinweis" role="alert">${t.offen}</p>`
    : falsch
      ? `<p class="hinweis" role="alert">${t.falsch}</p>`
      : "";

  const html = `<!DOCTYPE html>
<html lang="${sprache}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>MAFO — ${t.titel}</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#17140f">
<style>
  :root {
    --bg: #17140f; --surface: #221c14; --border: #362c1e;
    --text: #f3ede1; --text-muted: #ab9f8c; --accent: #c8945f; --accent-dark: #a9754a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; padding: 2rem 1.25rem;
    display: flex; align-items: center; justify-content: center;
    background: var(--bg); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.6; -webkit-font-smoothing: antialiased;
  }
  .karte { width: 100%; max-width: 26rem; text-align: center; }
  .logo { width: 150px; height: auto; margin: 0 auto 2rem; display: block; }
  h1 { font-size: 1.35rem; font-weight: 600; letter-spacing: 0.01em; margin: 0 0 0.75rem; }
  p { color: var(--text-muted); font-size: 0.95rem; margin: 0 0 1.75rem; }
  form { display: flex; flex-direction: column; gap: 0.75rem; }
  label { text-align: left; font-size: 0.8rem; letter-spacing: 0.08em;
          text-transform: uppercase; color: var(--text-muted); }
  input {
    width: 100%; padding: 0.85rem 1rem; font-size: 1rem; font-family: inherit;
    color: var(--text); background: var(--surface);
    border: 1px solid var(--border); border-radius: 0.6rem;
    text-align: center; letter-spacing: 0.12em;
  }
  input:focus { outline: 2px solid var(--accent); outline-offset: 2px; border-color: var(--accent); }
  button {
    padding: 0.85rem 1rem; font-size: 1rem; font-family: inherit; font-weight: 600;
    color: #17140f; background: var(--accent); border: 0; border-radius: 0.6rem; cursor: pointer;
  }
  button:hover { background: var(--accent-dark); color: var(--text); }
  .hinweis {
    margin: 0 0 1.25rem; padding: 0.75rem 1rem; font-size: 0.9rem;
    color: var(--text); background: var(--surface);
    border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 0.4rem;
    text-align: left;
  }
  .fuss { margin: 2rem 0 0; font-size: 0.85rem; }
  .fuss a { color: var(--accent); }
</style>
</head>
<body>
  <main class="karte">
    <img class="logo" src="/logo.png" alt="MAFO" width="440" height="314">
    <h1>${t.titel}</h1>
    <p>${t.lead}</p>
    ${hinweis}
    <form method="get" action="">
      <input type="hidden" name="lang" value="${sprache}">
      <label for="code">${t.feld}</label>
      <input id="code" name="code" type="text" autocomplete="off" autocapitalize="off"
             autocorrect="off" spellcheck="false" enterkeyhint="go" required autofocus>
      <button type="submit">${t.knopf}</button>
    </form>
    <p class="fuss">${t.kontakt} <a href="mailto:info@mafo-pet.ch">info@mafo-pet.ch</a></p>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: 401,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
