# MAFO CAR — Landingpage

Landingpage für **MAFO CAR**, den edlen Dog Travel Organizer fürs Auto (Marke MAFO, Schweiz).

## Struktur

- `index.html` – Hero, Feature-Sektion, Vorbestell-Formular
- `style.css` – Design (dunkle/erdige Töne)
- `script.js` – sendet das Formular per `fetch` an `/api/reserve`
- `api/reserve.js` – Vercel Serverless Function: validiert die Eingaben und
  verschickt eine strukturierte E-Mail an `info@mafo-pet.ch` über [Resend](https://resend.com)

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

## E-Mail-Versand einrichten (Resend)

1. Account auf [resend.com](https://resend.com) anlegen (kostenloser Plan reicht zum Start).
2. API-Key erstellen und in Vercel als Environment Variable `RESEND_API_KEY` hinterlegen
   (Project Settings → Environment Variables).
3. Optional, aber empfohlen: Domain `mafo-pet.ch` in Resend verifizieren (DNS-Einträge
   dort werden angezeigt), danach `MAFO_FROM_EMAIL` auf z.B.
   `MAFO CAR <noreply@mafo-pet.ch>` setzen. Bis dahin funktioniert der Versand bereits
   über die Resend-Test-Adresse `onboarding@resend.dev`.
4. `MAFO_TO_EMAIL` ist standardmässig `info@mafo-pet.ch` — nur setzen, falls das
   Empfänger-Postfach abweichen soll.

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
