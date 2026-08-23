# Seitenwerk — Angebotsseite für Webdesign

Eigene Angebotsseite: Leistungen, drei Preispakete, Referenz, Ablauf, FAQ und
ein Kontaktformular, das Anfragen per E-Mail zustellt. Gleicher Aufbau wie
`mafo-pet.ch` – statische Seite plus eine Serverless Function, kein Build.

## Vor dem Livegang erledigen

1. **Namen ersetzen.** Der Arbeitsname ist `Seitenwerk` / `seitenwerk.ch` /
   `hallo@seitenwerk.ch`. Über den ganzen Ordner ersetzen:

   ```bash
   grep -rl "Seitenwerk" . --exclude-dir=fonts --exclude-dir=media | xargs sed -i 's/Seitenwerk/DeinName/g'
   grep -rl "seitenwerk\.ch" . --exclude-dir=fonts --exclude-dir=media | xargs sed -i 's/seitenwerk\.ch/deinedomain.ch/g'
   ```

2. **Alle TODO-Stellen füllen.** `grep -rn TODO .` zeigt sie an:
   - Impressum: Name und Adresse (zwingend), E-Mail-Adresse (zwingend)
   - Datenschutz: dieselben Angaben unter «Verantwortliche Stelle»
   - `index.html`: Absatz zum Einführungspreis entfernen, sobald drei
     Referenzen stehen

3. **Vorschaubild neu erzeugen.** `media/og.jpg` trägt noch den Arbeitsnamen.

4. **Referenzbilder.** `media/referenz-mafo-*.jpg` sind echte Screenshots von
   mafo-pet.ch. Bei jeder weiteren Referenz vorher das Einverständnis des
   Kunden einholen.

## Erstkontakt läuft über das Formular

Die Seite führt bewusst nirgends eine Telefonnummer als Einstieg: Anfragen
kommen über das Formular, die Antwort kommt innert eines Arbeitstages per
E-Mail, telefoniert wird erst danach. Das steht so im Hero, im Abschnitt
«Ablauf», im Kontaktabschnitt und im Impressum – wer das ändern will, muss
alle vier Stellen anfassen.

## Struktur

- `index.html` – die ganze Angebotsseite
- `impressum.html`, `datenschutz.html` – Rechtstexte nach revidiertem DSG
- `style.css` – Design-Tokens ganz oben, danach Abschnitt für Abschnitt
- `script.js` – mobiles Menü, Formularversand und das Einblenden beim
  Scrollen (läuft auf allen drei Seiten, jeder Teil prüft selbst, ob es ihn
  auf der Seite überhaupt gibt)
- `fonts.css` + `fonts/` – Inter, selbst gehostet, damit keine Anfrage an
  Google geht und die Seite kein Cookie-Banner braucht
- `api/kontakt.js` – Serverless Function: prüft die Eingaben, schickt eine
  Meldung an dich und eine Bestätigung an die anfragende Person (Resend)
- `media/` – Referenz-Screenshots und Social-Vorschaubild
- `neues-repo.sh` – macht aus diesem Ordner ein eigenständiges Projekt
  (wird beim Kopieren nicht mitgenommen)

## Eigenes Repository und eigenes Vercel-Projekt

Dieser Ordner liegt im Repository von mafo-pet.ch, gehört dort aber nicht hin:
Vercel macht nur aus einem `api/` im **Wurzelverzeichnis** eine Serverless
Function. Solange `api/kontakt.js` in einem Unterordner liegt, kann das
Formular nicht funktionieren.

**Schritt 1 – leeres Repository anlegen.** Auf github.com → *New repository*,
Name z. B. `seitenwerk`, *Private*. Wichtig: **kein** README, **kein**
.gitignore und **keine** Lizenz ankreuzen – das Repository muss leer sein.

**Schritt 2 – Ordner hineinschieben.** Dafür liegt `neues-repo.sh` bereit. Es
kopiert diesen Ordner an einen neuen Ort, macht daraus ein eigenes
Git-Repository und pusht es:

```bash
./neues-repo.sh https://github.com/DEINNAME/seitenwerk.git
```

Das MAFO-Repository wird dabei nicht verändert. Dasselbe Skript erzeugt später
auch jede Kundenseite:

```bash
./neues-repo.sh https://github.com/DEINNAME/kunde-muster.git ~/kunde-muster
```

**Schritt 3 – Vercel.** *Add New… → Project* → das neue Repository importieren,
Framework Preset **Other**, die Variablen aus `.env.example` eintragen, Deploy.
Danach unter *Settings → Domains* die Domain zuweisen.

Solange der Ordner noch im MAFO-Repository liegt, schützt eine `.vercelignore`
im Wurzelverzeichnis davor, dass er unter `mafo-pet.ch/webdesign/` öffentlich
erreichbar wird. Sobald das eigene Repository steht, kann der Ordner hier
gelöscht werden – dann braucht es auch die `.vercelignore` nicht mehr.

## E-Mail-Versand (Resend)

| Variable | Beispiel |
| --- | --- |
| `RESEND_API_KEY` | API-Key aus dem Resend-Dashboard |
| `KONTAKT_TO_EMAIL` | `hallo@deinedomain.ch` |
| `KONTAKT_FROM_EMAIL` | `DeinName <noreply@deinedomain.ch>` |

Die Absenderdomain muss in Resend verifiziert sein (DKIM-Eintrag im DNS).
In Resend eine **neue** Domain hinzufügen, nicht die bestehende bearbeiten:
ein Konto trägt beliebig viele verifizierte Domains, und derselbe API-Key gilt
für alle. Die DNS-Zone von mafo-pet.ch dabei nicht anfassen – ihr `MX`-Eintrag
(`mta-gw.infomaniak.ch`) und ihr `SPF`-Eintrag sind das, was den Mailempfang
auf `info@mafo-pet.ch` am Leben hält.

Änderungen an den Variablen greifen erst nach einem Redeploy.

## Lokal ansehen

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

Das Formular braucht die Serverless Function und läuft deshalb erst mit
`vercel dev` (vorher `.env.example` nach `.env.local` kopieren).
