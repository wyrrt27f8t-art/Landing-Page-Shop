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

## Eigenes Vercel-Projekt anlegen

Dieser Ordner liegt im Repository von mafo-pet.ch, gehört dort aber nicht hin:
Vercel macht nur aus einem `/api` im **Wurzelverzeichnis** eine Serverless
Function. Solange `api/kontakt.js` in einem Unterordner liegt, wird das
Formular nicht funktionieren.

Deshalb vor dem Livegang in ein eigenes Repository umziehen:

```bash
# im übergeordneten Verzeichnis
cp -r Landing-Page-Shop/webdesign seitenwerk
cd seitenwerk
git init && git add -A && git commit -m "Angebotsseite"
```

Danach auf vercel.com **Add New… → Project**, dieses Repository importieren,
Framework Preset **Other**, und die Environment Variables aus `.env.example`
eintragen.

## E-Mail-Versand (Resend)

| Variable | Beispiel |
| --- | --- |
| `RESEND_API_KEY` | API-Key aus dem Resend-Dashboard |
| `KONTAKT_TO_EMAIL` | `hallo@deinedomain.ch` |
| `KONTAKT_FROM_EMAIL` | `DeinName <noreply@deinedomain.ch>` |

Die Absenderdomain muss in Resend verifiziert sein (DKIM-Eintrag im DNS).
Wenn die Domain bereits Mail empfängt, den bestehenden `MX`- und
`SPF`-Eintrag nicht überschreiben – sonst kommen keine Mails mehr an.
Änderungen an den Variablen greifen erst nach einem Redeploy.

## Lokal ansehen

```bash
python3 -m http.server 8000
# http://localhost:8000/
```

Das Formular braucht die Serverless Function und läuft deshalb erst mit
`vercel dev` (vorher `.env.example` nach `.env.local` kopieren).
