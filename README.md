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
  garden/      Gartenszene: Licht und Farben, Himmel, Wiese, Tiere
  screens/     Heute, To-dos, Garten, Erfolge, Detail, Formular, Einstellungen
  components/  wiederverwendbare Bausteine (Zeile, Heatmap, Kalender …)
    BottomSheet.tsx  Blatt von unten: Griff, Esc, Zurück-Geste, bleibt über der Tastatur
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

## Erfolge, Monatsquote, lebendiger Garten

- **Erfolge** (Tab „Erfolge“): 49 Abzeichen in sieben Kategorien und vier
  Seltenheiten (Bronze, Silber, Gold, Legendär), dazu Geheimerfolge, die sich
  erst beim Erreichen zeigen. Berechnet aus der Historie (`domain/achievements.ts`),
  Uhrzeit-Erfolge aus dem Zeitstempel der Haken; neu freigeschaltete melden sich
  per Hinweis.
- **Erfolgsquote je Monat**: in jeder Detailansicht und über alle Gewohnheiten
  im Tab „Erfolge“ (`monthlyRates` in `domain/stats.ts`).
- **Drohungen des Schattens**: Sprechblase in der Detailansicht, wechselt täglich
  und reagiert auf Lage, Abhaken und Ausnahmen (`domain/taunts.ts`).
- **Lebendiger Garten**: siehe unten.

## Wochenrückblick

Am Sonntag und Montag wartet auf „Heute“ eine Karte, bis der Rückblick einmal geöffnet
wurde (Sonntag: die laufende Woche, Montag: die vergangene). Dauerhaft erreichbar über
den Tab „Erfolge“, ältere Wochen über die Pfeile. Er zeigt Quote mit Vergleich zur
Vorwoche, die Tage als Balken, längste laufende Serie, erledigte To-dos, was eine Stufe
aufgestiegen ist und jede Gewohnheit Tag für Tag. Offenes lässt sich gesammelt in die
neue Woche legen. Berechnet in `domain/review.ts`, gespeichert wird nichts außer der
Merkhilfe, welcher Rückblick schon gesehen wurde.

## Lebendiger Garten

Eine Landschaft in Schichten, in der man nichts tun muss: Berge, Hügel, Wälder und ein
See, davor eine Wiese mit Gras und Blumen, die zur Jahreszeit passen. Alles folgt der
echten Tageszeit, Jahreszeit und Mondphase; das Wetter wird pro Tag fest gewürfelt
(meist klar, manchmal wolkig, selten Regen mit Regenbogen).

- **Licht:** `garden/palette.ts` färbt Landschaft und Tiere mit dem Licht der Tageszeit
  ein, die Pflanzen bekommen dazu einen passenden CSS-Filter.
- **Leben:** Vogelzüge, Enten, grasende Rehe, Hase, Bienen, Schmetterlinge, Fledermäuse,
  Igel, Eule, Glühwürmchen, Sternschnuppen, fallendes Laub, Schnee und Regen. Pflanzen, denen
  es gut geht, verlieren ab und zu eine Blüte, welkende ein trockenes Blatt.
- **Leistung:** Unbewegtes liegt in eigenen SVGs und die Wiese ist ein Kachelbild, beides
  zeichnet der Browser nur einmal. Bewegtes sind eigene Elemente mit CSS-Animation auf
  `transform`/`opacity`, die auf dem Grafikchip laufen. Bei „Bewegung reduzieren“ bleibt das
  Bild stehen und die Tiere fehlen.

In der Entwicklung zum Ausprobieren: `?zeit=nacht&saison=winter&wetter=regen&mond=0.5`.

## To-dos für Tag und Woche

Eigener Reiter, von „Heute“ aus auch per Wischen nach links erreichbar: Zwischen allen
Hauptansichten lässt sich waagerecht wischen (`components/SwipePager.tsx`). Die Seite
folgt dem Finger, es ist aber immer nur eine Ansicht gerendert. Senkrechtes Wischen
scrollt wie gewohnt, der Bildschirmrand bleibt der Zurück-Geste des Systems überlassen.

Ein To-do gilt für einen Tag oder für eine Woche und steht in einem der Abschnitte
Überfällig, Heute, Diese Woche, Später oder Erledigt (`domain/todos.ts`). Offenes
wandert nicht von selbst weiter, sondern bleibt als überfällig sichtbar, bis es
erledigt oder neu gelegt ist. Wochenaufgaben werden am Sonntag dringend. Was dringend
ist, zeigt auch die Karte auf „Heute“, der Zähler an der Leiste und (falls das Gerät
es kann) die Zahl am App-Symbol. Gespeichert in der Tabelle `todos`, im Backup enthalten.

**Wiederkehrend:** Täglich, wöchentlich, alle 2 Wochen, monatlich oder jährlich; Wochenaufgaben
wöchentlich oder alle 2 Wochen (`domain/repeat.ts`). Eine Reihe hat immer genau einen offenen
Termin. Beim Abhaken entsteht der nächste, bleibt er liegen, steht er als überfällig da, statt
dass sich Termine stapeln. Monatstage hängen am ersten Termin: Der 31. wird im Februar zum 28.
und danach wieder zum 31. Weggeklickte Erinnerungen kommen beim nächsten Termin wieder, ein
„1 Std.“ aus dem Banner gilt nur einmal. In der Kalenderdatei steht nur der jeweils aktuelle Termin.

**Erinnerungen und ihre Grenze:** Ohne Server kann eine Web-App nichts auslösen, solange
sie geschlossen ist; geplante Benachrichtigungen gibt es im Web nicht.

| App-Zustand | Was passiert |
|---|---|
| offen | Banner zur Uhrzeit (Erledigt, 1 Std., Morgen, OK), wird nach 12 s oder per Wischen zur kleinen Glocke, `components/ReminderHost.tsx` |
| läuft noch im Hintergrund | zusätzlich Benachrichtigung, falls erlaubt (Klick-Verhalten in `public/sw-extra.js`) |
| geschlossen | nichts; Verpasstes kommt beim nächsten Öffnen |
| geschlossen, Kalender genutzt | der Kalender des Handys erinnert (`domain/ics.ts`, `lib/calendar.ts`) |

Ein To-do kann beliebig viele Erinnerungen haben, auch an verschiedenen Tagen. Im Blatt
gelten die Uhrzeiten für den gewählten Tag, antippen setzt oder entfernt sie. Wandert das
To-do auf einen anderen Tag, wandern die Erinnerungen mit. Sind mehrere verpasst, kommt
pro To-do nur ein Banner, „OK“ räumt alle fälligen ab und lässt die späteren stehen.
Gespeichert werden nur offene Erinnerungen (Feld `reminders`, `version(4)` übernimmt die
frühere Einzel-Erinnerung; Backup-Format 4, ältere Backups bleiben lesbar).

In der Kalenderdatei wird jede künftige Erinnerung ein eigener Termin mit Alarm zur
Uhrzeit, ob der Kalender den Alarm übernimmt, hängt von der Kalender-App ab. Für echte
Push-Nachrichten siehe „Erweiterungen“.

**iPhone:** Im Teilen-Menü fehlt der Kalender, und eine in „Dateien“ gespeicherte Datei
trägt iOS nicht von selbst ein. Hain ruft deshalb im selben Fenster `…/kalender/*.ics`
auf, dort antwortet der Service Worker (`public/sw-extra.js`) mit `text/calendar` aus
einem Cache. Antwortet er nicht, bleibt der Weg über die Datei.

## Tagesziele: Menge oder Dauer

Statt nur abzuhaken kann eine Gewohnheit ein Tagesziel haben (Formular, „Ziel pro Tag“):

- **Menge**, z. B. 8 Gläser oder 2 Liter. Ein Tipp auf die Zeile in „Heute“ zählt den
  eingestellten Schritt dazu (auch 0,25), der Ring füllt sich.
- **Dauer**, z. B. 30 Minuten. Ein Tipp startet bzw. stoppt einen Timer. Gespeichert wird nur
  der Startzeitpunkt (Meta `timer.<id>`), er läuft also auch bei geschlossener App weiter.
  Die Minuten zählen für den Tag, an dem er gestartet wurde; mehr als 12 h gelten als
  vergessen und werden mit Hinweis auf 12 h begrenzt.

Genau eintragen, abziehen oder für vergangene Tage nachtragen: „⋯“ bzw. lange drücken, oder in
der Detailansicht (dort auch Durchschnitt, Gesamt und bester Tag). Gespeichert wird pro Tag die
Menge (`Checkin.amount`); erreicht heißt `done: true`, damit rechnen Baum, Serien und Schatten
unverändert. Ein geändertes Ziel gilt ab dann, erledigte Tage bleiben erledigt. Ein Haken ohne
Menge (Kalender, frühere Tage) zählt als erreichtes Ziel. Logik in `domain/goal.ts`,
Backup-Format 6.

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
