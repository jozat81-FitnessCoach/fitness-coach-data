# Fitness Coach Data API

Diese kleine API ist die Datenbasis fuer den Fitness-Coach:

- Check-ins speichern
- Check-outs speichern
- Dashboard-Daten abrufen
- aktuellen Athletenzustand fuer ChatGPT/GPT Actions abrufen

## Dateien

- `supabase/schema.sql`: Datenbankschema fuer Supabase/Postgres
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

## Coach-Instruktion

```text
Wenn der Nutzer einen morgendlichen Check-in abschliesst, rufe createCheckIn auf.
Wenn der Nutzer nach einer Einheit einen Check-out abgibt, rufe createCheckOut auf.
Bevor du Empfehlungen gibst, rufe getAthleteState oder getDashboardSummary auf.
```
