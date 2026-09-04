# MAFO CAR — Landingpage

Landingpage für **MAFO CAR**, den praktischen Dog Travel Organizer fürs Auto (Marke MAFO, Schweiz).

## Struktur

- `index.html` – Hero, Feature-Sektion, Vorbestell-Formular
- `style.css` – Design (dunkle/erdige Töne)
- `script.js` – sendet das Formular per `fetch` an `/api/reserve`
- `api/reserve.js` – Vercel Serverless Function: validiert die Eingaben und
  verschickt eine strukturierte E-Mail an `info@mafo-pet.ch` über [Resend](https://resend.com)
- `middleware.js` – Zugangsschutz: ohne gültigen Code bekommt jede Anfrage die
  Code-Eingabeseite (siehe unten)

Statisches Projekt, kein Frontend-Build nötig. Einzige Abhängigkeit ist die
Serverless Function für den Formularversand.

## Lokal entwickeln

Für die statischen Seiten reicht `index.html` im Browser. Um das Formular
inkl. `/api/reserve` lokal zu testen, wird die Vercel CLI benötigt:

```bash
npm i -g vercel
vercel dev
```

Vorher `.env.example` nach `.env.local` kopieren und `RESEND_API_KEY` eintragen.

## E-Mail-Versand (Resend)

Der Versand läuft über Resend, die Domain `mafo-pet.ch` ist dort verifiziert
(Region EU/Irland). Gesendet wird von `noreply@mafo-pet.ch`, Empfänger ist
`info@mafo-pet.ch`.

Environment Variables in Vercel (Settings → Environments → Production):

| Variable | Wert |
| --- | --- |
| `RESEND_API_KEY` | API-Key aus dem Resend-Dashboard |
| `MAFO_FROM_EMAIL` | `MAFO CAR <noreply@mafo-pet.ch>` |
| `MAFO_TO_EMAIL` | `info@mafo-pet.ch` |
| `MAFO_ZUGANGSCODE` | Zugangscode für die Website (siehe unten) |

Änderungen an diesen Variablen greifen erst nach einem Redeploy.

### DNS-Setup

Die DNS-Zone von `mafo-pet.ch` liegt bei **Infomaniak** (`ns11/ns12.infomaniak.ch`),
nicht bei Vercel. Für die Resend-Verifizierung sind dort drei Einträge angelegt:

| Typ | Name | Wert |
| --- | --- | --- |
| TXT | `resend._domainkey` | DKIM-Public-Key (`p=MIGf…`) |
| CNAME | `rsend` | `rsend.forge.rmta.net` |
| CNAME | `send` | `send.forge.rmta.net` |

Der Mail-Empfang läuft weiterhin über Infomaniak. Der MX-Eintrag
`mta-gw.infomaniak.ch` und der SPF-Eintrag `v=spf1 include:spf.infomaniak.ch -all`
dürfen deshalb nicht verändert oder überschrieben werden — sonst kommen bei
`info@mafo-pet.ch` keine Mails mehr an. Aus demselben Grund bleibt „Enable
Receiving" in Resend ausgeschaltet.

## Deployment mit Vercel (automatisch bei jedem Push)

1. Auf [vercel.com](https://vercel.com) → **Add New… → Project** → dieses
   GitHub-Repository auswählen und importieren.
2. Framework Preset: **Other** (statisches Projekt + `/api`-Funktion, kein Build-Schritt).
3. Die Environment Variables aus `.env.example` unter Project Settings →
   Environment Variables eintragen (`RESEND_API_KEY` mindestens).
4. Unter Project Settings → Domains die Domain `mafo-pet.ch` diesem Projekt zuweisen
   (sie ist bereits mit dem Vercel-Account verbunden).
5. Ab jetzt deployt Vercel automatisch bei jedem Push auf den Standard-Branch —
   Preview-Deployments entstehen für alle anderen Branches/PRs.

## Zugangsschutz (Code)

Die Website ist nicht öffentlich: `middleware.js` läuft vor jeder Anfrage und
zeigt ohne gültigen Code eine Eingabeseite (HTTP 401). Geschützt ist alles –
Seiten, Bilder, Videos und `/api/*`. Frei bleiben nur Logo und Favicons für die
Eingabeseite selbst sowie `/robots.txt`.

Der Code steht ausschliesslich in der Environment Variable `MAFO_ZUGANGSCODE`
und nirgends im Repository. Ist sie nicht gesetzt, bleibt die Seite gesperrt.

Zwei Wege hinein:

- Code auf der Eingabeseite eintippen
- Link mit `?code=…` öffnen, z. B. `https://mafo-pet.ch/?code=…` — praktisch zum
  Weitergeben

Beides setzt ein Cookie (HttpOnly, Secure, SameSite=Lax), das 90 Tage gilt. Es
enthält nicht den Code, sondern nur ein per HMAC daraus abgeleitetes Kennzeichen –
wird der Code geändert, gelten alle bisherigen Cookies sofort nicht mehr.
Gross-/Kleinschreibung, Leerzeichen und Bindestriche spielen bei der Eingabe
keine Rolle. `?abmelden=1` löscht das Cookie wieder.

Damit Besucher die Eingabeseite überhaupt erreichen, muss unter Project Settings →
Deployment Protection die **Vercel Authentication ausgeschaltet** sein – sonst
blockiert Vercel schon davor.
