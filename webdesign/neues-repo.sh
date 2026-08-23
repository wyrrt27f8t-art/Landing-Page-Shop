#!/usr/bin/env bash
#
# Macht aus diesem Ordner ein eigenständiges Projekt und schiebt es in ein
# leeres GitHub-Repository. Das MAFO-Repository wird dabei nicht angefasst.
#
#   ./neues-repo.sh https://github.com/DEINNAME/seitenwerk.git
#   ./neues-repo.sh https://github.com/DEINNAME/kunde-muster.git ~/kunde-muster
#
# Das Ziel-Repository muss auf github.com bereits existieren und leer sein
# (beim Anlegen also kein README, kein .gitignore, keine Lizenz auswählen).

set -euo pipefail

REMOTE="${1:-}"
ZIEL="${2:-$HOME/$(basename "${1:-projekt}" .git)}"

if [ -z "$REMOTE" ]; then
  echo "Aufruf: $0 <git-remote-url> [zielordner]" >&2
  exit 1
fi

if [ -e "$ZIEL" ]; then
  echo "Abbruch: $ZIEL existiert bereits – bitte anderen Zielordner angeben." >&2
  exit 1
fi

QUELLE="$(cd "$(dirname "$0")" && pwd)"

echo "Kopiere $QUELLE nach $ZIEL"
mkdir -p "$ZIEL"
# Der Punkt am Ende kopiert auch Dateien wie .gitignore und .env.example mit.
cp -a "$QUELLE"/. "$ZIEL"/
# Das Skript selbst gehört nicht ins neue Projekt.
rm -f "$ZIEL/neues-repo.sh"

cd "$ZIEL"
git init -b main
git add -A
git commit -m "Angebotsseite"
git remote add origin "$REMOTE"
git push -u origin main

cat <<HINWEIS

Fertig. Der Ordner liegt jetzt unter: $ZIEL

Weiter auf vercel.com:
  1. Add New… -> Project -> dieses Repository importieren
  2. Framework Preset: Other (kein Build-Schritt nötig)
  3. Environment Variables aus .env.example eintragen
  4. Deploy, danach unter Settings -> Domains die Domain zuweisen

Die DNS-Zone von mafo-pet.ch dabei nicht anfassen.
HINWEIS
