# Hain – Gewohnheiten, die wachsen

Habit-Tracker als Progressive Web App. Jede Gewohnheit hat einen eigenen, prozedural
erzeugten Baum, der mit jedem erledigten Tag wächst und bei verpassten Tagen welkt.
Alles bleibt lokal im Browser (IndexedDB) – kein Konto, kein Server.

## Befehle

| Befehl | Zweck |
|---|---|
| `npm install` | Abhängigkeiten installieren (einmalig) |
| `npm run dev` | Entwicklungsserver auf http://localhost:5173 |
| `npm run dev:lan` | dto., aber auch im WLAN erreichbar (Handy-Test) |
| `npm test` | Tests der Fachlogik (Serien, Gesundheitswert, Backup) |
| `npm run build` | Produktions-Build nach `dist/` (inkl. Typprüfung) |
| `npm run preview` | den Build lokal ausliefern (mit Service Worker) |
| `npm run icons` | PNG-Icons aus `public/icon.svg` neu erzeugen |

Nur in der Entwicklung:

- `http://localhost:5173/?demo` legt Demo-Habits mit Vorgeschichte an (nur wenn die
  Datenbank leer ist), alternativ in der Konsole `await hainDemo()`.
- `http://localhost:5173/baumlabor.html` zeigt alle Baumstufen nebeneinander.

## Auf dem Handy testen (gleiches WLAN)

1. `npm run dev:lan` – Vite zeigt unter „Network“ eine Adresse wie `http://192.168.x.y:5173`.
2. Diese Adresse am Handy im Browser öffnen. Windows fragt beim ersten Mal nach der
   Firewall – für private Netzwerke erlauben.

Einschränkung: Über `http://` (ohne s) gibt es keinen Service Worker. Die Oberfläche
lässt sich so testen, Offline-Betrieb und echte Installation aber erst mit HTTPS –
also nach dem Deployment.

## Deployment

### Vercel (am einfachsten)

1. Projekt auf GitHub hochladen (siehe unten) und bei vercel.com mit GitHub anmelden.
2. „Add New → Project“, Repo wählen. Vercel erkennt Vite automatisch
   (Build: `npm run build`, Output: `dist`). Deploy.
3. Jeder Push auf `main` veröffentlicht automatisch neu.

Ohne GitHub geht es auch per CLI: `npx vercel` im Projektordner.

### GitHub Pages

1. Repo auf GitHub anlegen und pushen.
2. Im Repo: Settings → Pages → Source: **GitHub Actions**.
3. Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main`
   und veröffentlicht unter `https://<name>.github.io/<repo>/`.

### Code zu GitHub bringen

```bash
git add -A
git commit -m "Hain: erste Version"
git branch -M main
git remote add origin https://github.com/<name>/<repo>.git
git push -u origin main
```

### Auf dem Handy installieren

- **iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
  Wichtig: Die installierte App hat einen *eigenen* Speicher. Daten, die du vorher
  in Safari angelegt hast, per Export/Import mitnehmen.
- **Android:** In Chrome erscheint „App installieren“ (auch in den Einstellungen der App).

## Aufbau

```
src/
  domain/      reine Fachlogik ohne React/Datenbank – hier wird gerechnet
    dates.ts     Datumsrechnung auf 'JJJJ-MM-TT'-Texten (keine Zeitzonenfehler)
    schedule.ts  fällig an welchem Tag? (Häufigkeit mit Versionsliste)
    streaks.ts   aktuelle und längste Serie
    health.ts    Gesundheitswert H, Stufen, Wachstum g
    stats.ts     Tageszustände, 30-Tage-Quote
  db/          Dexie (IndexedDB): Schema, Schreibfunktionen, Live-Hooks, Backup
  tree/        Baum: Zufallsgenerator, Geometrie, Farben, SVG-Komponente
  screens/     Heute, Garten, Detail, Formular, Einstellungen
  components/  wiederverwendbare Bausteine (Zeile, Heatmap, Kalender …)
  app/         Router (Hash-URLs) und Aktionen mit Feedback
  lib/         Haptik, Hinweise, Dialoge, Installation
```

### Grundregeln

- **Gespeichert werden nur Fakten:** Habits und „an Tag X erledigt“. Serien,
  Gesundheitswert und Statistik werden immer neu berechnet – dadurch stimmen sie
  auch nach nachträglichen Korrekturen sofort.
- **Gesundheitswert H:** erledigt +1 (max. 100) · 1. verpasster fälliger Tag −1 und
  welk · ab dem 2. in Folge halbiert · H < 1 nach einem großen Baum = kahl.
  Stufen bei H = 1 / 3 / 7 / 14 / 30 / 60.
- **Schema-Änderungen** in `db/schema.ts` immer als neue `version(n)` anhängen.

## Erweiterungen (vorbereitet)

- **Notizen / Stimmung pro Tag:** neue Tabelle `dayEntries` als `version(2)` in
  `db/schema.ts`, Eingabe z. B. im Detail-Kalender oder unter „Heute“.
- **Sync (z. B. Supabase):** IDs sind UUIDs, jeder Datensatz hat `updatedAt`,
  gelöschte Habits bleiben als Grabstein (`deleted: true`), abgehakte Tage werden
  mit `done: false` statt gelöscht zurückgenommen – damit lässt sich „neuester
  Stand gewinnt“ zusammenführen. Andocken in `db/repo.ts`.
- **Push-Erinnerungen:** brauchen einen Server, der die Nachricht verschickt
  (Web Push mit VAPID-Schlüsseln, z. B. als Supabase-Funktion) und Code im Service
  Worker (dann `injectManifest` statt `generateSW` in `vite.config.ts`). Auf dem
  iPhone nur für die installierte App, ab iOS 16.4.
