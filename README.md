# Fitness Coach Data API

Diese kleine API ist die Datenbasis fuer den Fitness-Coach:

- Check-ins speichern
- Check-outs speichern
- Dashboard-Daten abrufen
- aktuellen Athletenzustand fuer ChatGPT/GPT Actions abrufen

## Dateien

- `supabase/schema.sql`: Datenbankschema fuer Supabase/Postgres
- `supabase/upgrade_training_plans.sql`: Upgrade fuer bestehende Datenbanken mit Trainingsplaenen, Uebungen und flexiblen Metriken
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

## Coach-Instruktion

```text
Wenn der Nutzer einen morgendlichen Check-in abschliesst, rufe createCheckIn auf.
Wenn der Nutzer nach einer Einheit einen Check-out abgibt, rufe createCheckOut auf.
Bevor du Empfehlungen gibst, rufe getAthleteState oder getDashboardSummary auf.
```

## Erweiterte Coach-Instruktion

```text
Nach jedem morgendlichen Check-in:
1. Speichere den Check-in mit createCheckIn.
2. Rufe getAthleteState oder getDashboardSummary auf.
3. Entscheide, ob heute trainiert wird.
4. Wenn trainiert wird, erstelle einen konkreten Tages-Trainingsplan mit Uebungen, Saetzen, Wiederholungen, Gewicht, RPE-Ziel, Pause, Technikhinweis, heutigem Fokus und Alternative.
5. Speichere diesen Plan mit createTrainingPlan.

Beim Check-out:
1. Rufe zuerst getCheckOutTemplate auf.
2. Nutze die geplanten Uebungen als vorausgefuellte Ist-Werte.
3. Frage nur nach Abweichungen, RPE, Schmerz/Unwohlsein und kurzer Notiz.
4. Speichere den Check-out mit createPlannedCheckOut.

Wenn ein neuer relevanter Messwert auftaucht, z. B. rechter Ellenbogen, Leiste, Blutzucker, Sprunggefuehl oder Mobility:
1. Frage den Wert kuenftig regelmaessig ab, wenn er fuer das Ziel relevant ist.
2. Speichere ihn als tracked_metrics mit stabilen metric_key-Werten.
```
