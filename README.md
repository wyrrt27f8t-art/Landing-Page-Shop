# MAFO — Landingpage

Landingpage der Schweizer Marke MAFO: **MAFO**, der praktische Dog Travel Organizer fürs Auto,
und **MAFO WALK**, die 3-in-1 Trinkflasche.

## Struktur

- `index.html`, `mafo-walk.html` – Produktseiten mit Kaufbox („In den Warenkorb“)
- `kasse.html` – Kasse in vier Schritten: Warenkorb, Lieferadresse, Zahlungsart
  (Vorauskasse oder TWINT), Prüfung; danach Bestätigung mit Zahlungsangaben
- `style.css` – Design (dunkle/erdige Töne)
- `script.js` – Warenkorb (im Browser gespeichert), Warenkorb-Fenster, Kasse;
  schickt die Bestellung per `fetch` an `/api/reserve`
- `api/reserve.js` – Vercel Serverless Function für Bestellungen: validiert Artikel,
  Mengen und Lieferadresse, rechnet den Betrag selbst nach und verschickt eine
  strukturierte E-Mail an `info@mafo-pet.ch` sowie eine Bestätigung an die Kundschaft
  über [Resend](https://resend.com). Die Preise stehen dort in `ARTIKEL` und müssen
  mit der Website übereinstimmen.

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
| `MAFO_FROM_EMAIL` | `noreply@mafo-pet.ch` (Anzeigename ist im Code fest: „MAFO“) |
| `MAFO_TO_EMAIL` | `info@mafo-pet.ch` |
| `MAFO_IBAN` | IBAN für die Vorauskasse. Fehlt sie, steht in der Bestätigung, dass die Angaben separat folgen. |
| `MAFO_KONTOINHABER` | Name auf dem Konto, wie er auf der Überweisung stehen soll |
| `MAFO_TWINT_NUMMER` | Handynummer, an die per TWINT bezahlt wird |
| `MAFO_TWINT_QR` | Optional: Adresse (https://…) eines Bilds mit dem TWINT-QR-Code |
| `MAFO_BONUSCODES` | Bonuscodes, durch Komma getrennt. `CODE` gibt 30 % Rabatt, `CODE:20` einen eigenen Satz. Leer oder nicht gesetzt: kein Code gilt. |

Die Bonuscodes stehen absichtlich nur in Vercel und nicht im Code, weil dieses
Repository öffentlich ist. Der Rabatt gilt auf den ganzen Bestellbetrag und wird
auf 5 Rappen gerundet; der Server rechnet ihn bei jeder Bestellung selbst nach.

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
