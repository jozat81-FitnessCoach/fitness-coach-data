# Fitness Coach Data API

Diese kleine API ist die Datenbasis fuer den Fitness-Coach:

- Check-ins speichern
- Check-outs speichern
- Dashboard-Daten abrufen
- aktuellen Athletenzustand fuer ChatGPT/GPT Actions abrufen

## Dateien

- `supabase/schema.sql`: Datenbankschema fuer Supabase/Postgres
- `supabase/upgrade_training_plans.sql`: Upgrade fuer bestehende Datenbanken mit Trainingsplaenen, Uebungen und flexiblen Metriken
- `supabase/upgrade_profiles_goals_v08.sql`: Upgrade fuer Profile, Ziele, Standard-Check-in, Standard-Check-out, Daily Assessments und Mess-Tage
- `src/server.js`: API-Server
- `public/`: geschuetztes Dashboard unter `/app`
- `openapi.yaml`: Schema fuer Custom GPT Actions
- `.env.example`: benoetigte Umgebungsvariablen

## Supabase einrichten

1. Supabase-Projekt erstellen.
2. SQL Editor oeffnen.
3. Inhalt von `supabase/schema.sql` ausfuehren.
4. Unter Project Settings die Postgres Connection String kopieren.
5. Diese URL als `DATABASE_URL` im Deployment hinterlegen.

## Bestehende Datenbank erweitern

Wenn die erste Version bereits laeuft, fuehre in Supabase nur diese Datei im SQL Editor aus:

```text
supabase/upgrade_training_plans.sql
```

Das ergaenzt:

- flexible Zusatzmetriken wie rechter Ellenbogen, Leiste oder Sprunggefuehl
- konkrete Tages-Trainingsplaene
- geplante Uebungen mit Saetzen, Wiederholungen, Gewicht, Technikhinweis und Tagesfokus
- Uebungsergebnisse fuer den Check-out mit Plan-Ist-Abgleich

## Upgrade auf Konzept v0.8

Fuehre danach zusaetzlich diese Datei im Supabase SQL Editor aus:

```text
supabase/upgrade_profiles_goals_v08.sql
```

Das ergaenzt:

- Standardprofil und technische Vorbereitung fuer mehrere Nutzer
- Zielstruktur mit uebergeordneten Zielen und Unterzielen
- Zielmetriken und Trainingsprinzipien
- Standard-Check-in-Felder gemaess Konzept v0.8
- Standard-Check-out-Felder gemaess Konzept v0.8
- Coach Daily Assessments fuer Ampel, Readiness, Coach-Statement, Mentalfokus und Ernaehrungsempfehlung
- Messtage, Messtag-Tests, Messergebnisse und Messtag-Auswertungen
- pragmatische Startgewichtung fuer Readiness, die spaeter kalibriert werden kann

## Lokal starten

```bash
npm install
cp .env.example .env
npm run dev
```

Danach pruefen:

```bash
curl http://localhost:3000/health
```

Geschuetzte Endpunkte brauchen den Header:

```text
Authorization: Bearer <API_KEY>
```

## Dashboard

Nach dem Deployment ist das Dashboard erreichbar unter:

```text
https://deine-render-adresse.onrender.com/app
```

Setze dafuer in Render zusaetzlich:

```text
DASHBOARD_PASSWORD=<dein Dashboard-Passwort>
SESSION_SECRET=<ein langer zufaelliger Text>
```

## Custom GPT Action

1. API deployen und HTTPS-URL merken.
2. In `openapi.yaml` die Server-URL ersetzen.
3. Im GPT Builder unter Actions das Schema einfuegen.
4. Authentifizierung auf API Key/Bearer stellen.
5. Den gleichen API Key verwenden, der im Backend als `API_KEY` gesetzt ist.

Nach Version 0.2 kann der GPT zusaetzlich:

- `createTrainingPlan` aufrufen, um den konkreten Tagesplan zu speichern
- `getCheckOutTemplate` aufrufen, um beim Check-out die geplanten Uebungen bereits vorauszufuellen
- `createPlannedCheckOut` aufrufen, um Plan-Ist-Ergebnisse zu speichern

Nach Version 0.8 kann der GPT zusaetzlich:

- `getCheckInTemplate` aufrufen, um immer zuerst eine kopierbare, thematisch gruppierte Check-in-Vorlage bereitzustellen
- `setupProfile` nutzen, um Nutzerkontext, Equipment und Einschraenkungen zu speichern
- `proposeGoals` nutzen, um Ziele, Metriken und Trainingsprinzipien vorzuschlagen
- `confirmGoals` erst nach Nutzerbestaetigung nutzen, um Ziele zu speichern
- `createDailyAssessment` oder `createPragmaticDailyAssessmentFromCheckIn` nutzen, um die Coach-Tagesbewertung zu speichern
- `proposeMeasurementDay` nutzen, um einen ueberschaubaren Messtag fachlich vorzuschlagen
- `createMeasurementDay` nutzen, um Messtag, Tests, Ergebnisse und Auswertung zu speichern

## Coach-Instruktion

```text
Wenn der Nutzer einen morgendlichen Check-in abschliesst, rufe createCheckIn auf.
Wenn der Nutzer nach einer Einheit einen Check-out abgibt, rufe createCheckOut auf.
Bevor du Empfehlungen gibst, rufe getAthleteState oder getDashboardSummary auf.
```

## Erweiterte Coach-Instruktion

```text
Nach jedem morgendlichen Check-in:
1. Rufe getCheckInTemplate auf und stelle die Vorlage kopierbar im Chat bereit.
2. Speichere den befuellten Check-in mit createCheckIn.
3. Speichere eine Tagesbewertung mit createDailyAssessment. Alternativ kann createPragmaticDailyAssessmentFromCheckIn eine Startbewertung erzeugen.
4. Rufe getAthleteState oder getDashboardSummary auf.
5. Entscheide, ob heute trainiert wird.
6. Wenn trainiert wird, erstelle einen konkreten Tages-Trainingsplan mit Warm-up, Hauptteil und Cool-down. Jede Uebung braucht Uebung, Blockname, Saetze, Wiederholungen, Gewicht oder Belastung, RPE-Ziel, Pause, kurze Technik-Anleitung, konkreten heutigen Fokus und bei Bedarf eine Alternative.
7. Speichere diesen Plan mit createTrainingPlan.

Pflicht fuer createTrainingPlan bei should_train=true:
- Mindestens eine Uebung im Block `Warm-up`.
- Mindestens eine Uebung im Block `Hauptteil`.
- Mindestens eine Uebung im Block `Cool-down`.
- `technical_notes` ist bei jeder Uebung auszufuellen, kurz und praktisch.
- `today_focus` ist bei jeder Uebung auszufuellen, z. B. langsam runter, 2 Sekunden halten, explosiv hoch.
- Das Feld `goal` beschreibt das heutige Tagesziel der Einheit, also wohin die Einheit im Sinne des uebergeordneten Ziels fuehren soll.

Beim Check-out:
1. Rufe zuerst getCheckOutTemplate auf.
2. Nutze die geplanten Uebungen als vorausgefuellte Ist-Werte.
3. Frage nur nach Abweichungen und den Standardwerten aus dem Check-out: Dauer, Belastung, Qualitaet, Energie, Explosivitaet, Fokus, Schmerz, Muskelgefuehl, Technikgefuehl, Erschoepfung, Regenerationsbedarf und Reflexion.
4. Speichere den Check-out mit createPlannedCheckOut.

Bei Zielaenderungen:
1. Rufe proposeGoals auf oder entwickle einen fachlich begruendeten Vorschlag.
2. Stimme Ziel, Unterziele, Metriken, Mess-Tage, Check-in-Felder, Check-out-Felder und Dashboardmodule mit dem Nutzer ab.
3. Speichere erst nach ausdruecklicher Bestaetigung mit confirmGoals.

Bei Mess-Tagen:
1. GPT entscheidet anhand Ziel, Historie, Check-in und Belastbarkeit, ob ein Messtag sinnvoll ist.
2. Rufe proposeMeasurementDay auf.
3. Halte die Anzahl der Messungen ueberschaubar.
4. Speichere erst nach Nutzerbestaetigung oder nach Durchfuehrung mit createMeasurementDay.

Wenn ein neuer relevanter Messwert auftaucht, z. B. rechter Ellenbogen, Leiste, Blutzucker, Sprunggefuehl oder Mobility:
1. Frage den Wert kuenftig regelmaessig ab, wenn er fuer das Ziel relevant ist.
2. Speichere ihn als tracked_metrics mit stabilen metric_key-Werten.
```
