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
    species.ts   Pflanzenarten mit ihren Stufennamen
    stats.ts     Tageszustände, 30-Tage-Quote
  db/          Dexie (IndexedDB): Schema, Schreibfunktionen, Live-Hooks, Backup
  tree/        Pflanzen: Zufallsgenerator, Formen, Farben, SVG-Komponente
    species/     ein Erzeuger je Art (recursive.ts = gemeinsamer Baumkern)
    grove.ts     Begleitpflanzen des Hains ab H = 100
  screens/     Heute, Garten, Detail, Formular, Einstellungen
  components/  wiederverwendbare Bausteine (Zeile, Heatmap, Kalender …)
  app/         Router (Hash-URLs) und Aktionen mit Feedback
  lib/         Haptik, Hinweise, Dialoge, Installation
```

### Grundregeln

- **Gespeichert werden nur Fakten:** Habits und „an Tag X erledigt“. Serien,
  Gesundheitswert und Statistik werden immer neu berechnet – dadurch stimmen sie
  auch nach nachträglichen Korrekturen sofort.
- **Gesundheitswert H:** erledigt +1 (max. 365) · 1. verpasster fälliger Tag −1 und
  welk · ab dem 2. in Folge halbiert · H < 1 nach einem großen Baum = kahl.
  Stufen bei H = 1 / 3 / 7 / 14 / 30 / 60 (Pflanze) und 100 / 200 / 365 (Hain).
- **Neue Art hinzufügen:** Erzeuger in `tree/species/` schreiben (gibt ein
  `PlantModel` zurück), in `tree/species/index.ts` und `domain/species.ts` eintragen.
  `src/tree/species.test.ts` prüft automatisch, dass jede Art Stufe für Stufe wächst.
- **Schema-Änderungen** in `db/schema.ts` immer als neue `version(n)` anhängen.

## Pflanzen und Hain

Acht Arten: Laubbaum, Kirschbaum, Apfelbaum, Birke, Trauerweide, Tanne, Kaktus,
Sonnenblume – jede mit eigenem Wuchs, eigenen Blättern und eigenen Blüten bzw.
Früchten, Zapfen oder Kätzchen in der Habit-Farbe. Gewählt wird die Art im
Formular; Habits von vor der Einführung bleiben Laubbäume und sehen unverändert aus
(ein Test sichert das ab).

Bis H = 100 wächst die Pflanze selbst bis zur vollen Blüte. Danach entsteht um sie
herum ein Hain: bei H = 100, 150, 200, 270 und 340 kommt je eine Begleitpflanze
dazu, die als Keimling beginnt und mitwächst. Verpasste Tage lassen zuerst die
jüngsten wieder verschwinden.

## Schatten-Ich (statt Pflanze)

Pro Gewohnheit wählbar: eine dunkle Version von dir, die an jedem Tag stärker wird,
an dem du schwach bist. Ihr steht euch auf demselben Boden gegenüber; die Grenze
zwischen deinem Land und seinem verschiebt sich mit dem Kräfteverhältnis.

- Schattenstärke S: verpasster fälliger Tag +18 % des Abstands zu 100, erledigter Tag −15 %
- dein Licht L = 100 · (1 − e^(−H/25)), Territorium T = (L + 10) / (L + S + 20)
- Lagen: Er herrscht (< 15 %) · Er rückt vor · Patt (40–60 %) · Du drängst ihn zurück · Dein Land (≥ 85 %)
- abgestimmt auf den Baum: von voller Stärke 7 verpasste Tage → „Er herrscht“

Logik in `domain/shadow.ts` (mit Tests), Darstellung in `shadow/ShadowDuel.tsx`.
Im Baumlabor zeigt `baumlabor.html?schatten` alle Lagen.

## Ausnahmetage („heute nicht möglich“)

Über „⋯“ in einer Zeile (oder lange drücken) bzw. „Heute nicht möglich …“ in der
Detailansicht lässt sich ein Tag mit Grund aussetzen: Krank, Dienst, Unterwegs,
Familie, Ruhetag oder anderer Grund, optional mit Notiz. Im Kalender der
Detailansicht geht das per langem Druck auch für vergangene Tage.

Ein ausgesetzter Tag zählt wie ein nicht fälliger Tag: kein Welken, die Serie
läuft weiter, der Schatten wird nicht stärker, die Erfolgsquote zählt ihn nicht.
Wird er doch erledigt, gilt „erledigt“. Gespeichert als Abhak-Eintrag mit
`excused: true`, `reason` und optional `reasonNote` (Logik: `domain/excuse.ts`).
Das Blatt zeigt, wie viele Ausnahmen es in den letzten 30 Tagen gab.

## Notizen pro Tag

Unter „Heute“ gibt es ein Notizfeld zum ausgewählten Tag (über die Wochenleiste
auch für vergangene Tage). Gespeichert wird automatisch in der Tabelle `dayEntries`
(`version(2)` in `db/schema.ts`), eine Notiz pro Kalendertag, unabhängig von Habits.
Notizen sind im Backup enthalten (Backup-Format 2; ältere Backups lassen sich weiter
einspielen).

## Erweiterungen (vorbereitet)

- **Stimmung pro Tag:** als zusätzliches Feld in `DayEntry` (`domain/types.ts`) –
  da nur ein neues, nicht indiziertes Feld, ist dafür keine neue Schema-Version nötig.
- **Sync (z. B. Supabase):** IDs sind UUIDs, jeder Datensatz hat `updatedAt`,
  gelöschte Habits bleiben als Grabstein (`deleted: true`), abgehakte Tage werden
  mit `done: false` statt gelöscht zurückgenommen – damit lässt sich „neuester
  Stand gewinnt“ zusammenführen. Andocken in `db/repo.ts`.
- **Push-Erinnerungen:** brauchen einen Server, der die Nachricht verschickt
  (Web Push mit VAPID-Schlüsseln, z. B. als Supabase-Funktion) und Code im Service
  Worker (dann `injectManifest` statt `generateSW` in `vite.config.ts`). Auf dem
  iPhone nur für die installierte App, ab iOS 16.4.
