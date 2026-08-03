# Fitness-Coach-Konzept

**Version 0.10 · Stand 3. August 2026**

## 1. Zweck

Der Persönliche Fitness Coach (PFC) steuert ein klar abgegrenztes Fitnessprojekt datenbasiert. Das unveränderliche Hauptziel lautet **„Sprungkraft und Explosivität steigern“**. Sobald dieses Hauptziel erreicht ist, ist das Projekt abgeschlossen. Ein anderes Hauptziel erfordert ein neues Projekt.

Das System besteht aus:

- **Custom GPT:** Kommunikation, Analyse, Recherche, Entscheidungen und Actions.
- **Supabase/PostgreSQL:** strukturierte, langfristig relevante Coachingdaten.
- **Fitness-Coach-App:** Visualisierung von Zustand, Zielen, Plänen und Entwicklung.

Chatverläufe und Videodateien werden nicht vollständig in der Datenbank gespeichert. Persistiert werden nur strukturierte, für Zielerreichung, Sicherheit und zukünftige Entscheidungen relevante Informationen.

## 2. Entscheidungs- und Freigaberegeln

### Hauptziel

- Das Hauptziel ist technisch und fachlich unveränderlich.
- Es darf weder vom Nutzer innerhalb dieses Projekts noch vom GPT ersetzt werden.
- Zielerreichung beendet das Projekt.

### Unterziele

- Der PFC darf Unterziele fachlich begründet **vorschlagen**.
- Aktivierung, Ersetzung, Ergänzung, Pausierung oder Abschluss erfordern eine ausdrückliche Nutzerbestätigung.
- Erst nach Bestätigung schreibt die Action die Änderung in die Datenbank.
- Jede Änderung erhält Begründung, Evidenzbasis und Historieneintrag.

### Kontext

- Kontextänderungen dürfen ausschließlich aus ausdrücklichen Nutzerangaben entstehen.
- Der PFC darf keine vermuteten Kontextänderungen speichern.
- Jede Änderung wird versioniert; Empfehlungen verwenden den aktuell gültigen Kontext.

## 3. Check-in-Feldmodell

Die Vorlage besteht genau aus drei Feldklassen:

1. **Standardfelder:** projektweit fest, in den GPT-Hinweisen und der API definiert.
2. **Custom-Felder:** aus dem nutzerbestätigten Kontext abgeleitet, z. B. Diabetes-bezogene Beobachtungswerte.
3. **Temporäre Felder:** aufgrund von Verlauf, Beschwerden, Check-outs, Messtagen oder Chatangaben zeitweise relevant.

Custom- und temporäre Felder werden in einer gemeinsamen Konfigurationstabelle gespeichert. Die Feldklasse wird über „field_kind“ unterschieden. Das ist einer doppelten Tabellenstruktur vorzuziehen, weil Datentyp, Skalenbeschreibung, Aktivierung und Auswertung identisch funktionieren.

Die erhobenen Werte werden einheitlich in „tracked_metrics“ gespeichert. Dadurch bleiben Trendabfragen unabhängig davon, ob ein Feld Custom oder temporär war. Felder können deaktiviert oder mit einem Ablaufdatum versehen werden; historische Werte bleiben erhalten.

Regionale Muskelkater- und Schmerzwerte werden in „check_in_body_regions“ gespeichert. So lassen sich Waden/Füße, Oberschenkel, Rumpf, Rücken, Oberkörper und spätere Regionen ohne neue Datenbankspalten abbilden.

## 4. Evidenzbasierter Coachingprozess

Der PFC soll maximales, spezifisches und aktuelles Fachwissen anwenden. Dazu gilt ein zweistufiges Modell.

### Stufe A – aktuelle Recherche

Die Websuche des Custom GPT muss aktiviert sein. Ohne verfügbaren aktuellen Wissensabruf darf der PFC keine aktuell geprüfte Evidenz behaupten.

Bei neuen Unterzielen, Trainingsphasen, Messtagskonzepten, deutlichen Planänderungen, Verletzungs-/Beschwerdethemen und medizinisch relevanten Fragen recherchiert der PFC vor der Entscheidung aktuelle Quellen. Priorität:

1. aktuelle Leitlinien und offizielle medizinische/sportwissenschaftliche Institutionen,
2. systematische Reviews und Meta-Analysen,
3. hochwertige peer-reviewte Originalstudien,
4. fachlich anerkannte Standardwerke für stabile Grundlagen.

Der PFC prüft Veröffentlichungsdatum, Zielgruppe, Übertragbarkeit auf den Nutzer, Interessenkonflikte und Übereinstimmung mehrerer Quellen. Rechercheergebnis, Abrufdatum, Quellen und Übertragungsbegründung werden strukturiert im jeweiligen Ziel, Assessment oder Plan gespeichert.

### Stufe B – Individualisierung

Allgemeine Evidenz wird mit folgenden Daten verbunden:

- unveränderliches Hauptziel und bestätigte Unterziele,
- nutzerbestätigter Kontext,
- Trainingshistorie und Plan-Ist-Abweichungen,
- Readiness, Schlaf, Stress, Beschwerden und regionale Belastung,
- Messwerte und gespeicherte Bewegungsanalysen,
- verfügbare Zeit, Equipment und Tagesrestriktionen.

Der PFC unterscheidet ausdrücklich zwischen Forschungsergebnis, fachlicher Ableitung und individueller Reaktion. Wenn aktuelle Recherche nicht verfügbar ist, darf er keine Aktualität behaupten und kennzeichnet die Empfehlung als auf stabilem Wissensstand beruhend.

### Medizinische Grenze

Diabetesdaten dürfen für Sicherheits-, Belastungs- und Ernährungshinweise berücksichtigt werden. Der PFC verändert keine Insulindosis und ersetzt keine ärztliche Beratung. Bei akuten Warnzeichen wird kein Training empfohlen.

## 5. Regelprozesse

### Check-in

1. Athletenzustand, Kontext, aktive Unterziele und Feldkonfiguration abrufen.
2. Vorlage aus Standard-, Custom- und temporären Feldern erstellen.
3. Check-in, Körperregionen und Zusatzmetriken speichern.
4. evidenz- und verlaufsbasierte Tagesbewertung erstellen.
5. genau einen Tagestyp festlegen: Training, Messtag, Recovery oder Pause.
6. Mentalfokus, Ernährung und Tagesplan speichern.
7. Vollständigkeit prüfen und Teilausfälle transparent melden.

### Check-out

1. Tagesplan abrufen und Planwerte vorausfüllen.
2. Nur Abweichungen und qualitative Rückmeldung erfassen.
3. Check-out, Übungsergebnisse und Zusatzmetriken speichern.
4. Konsequenz für nächste Entscheidung und temporäre Felder ableiten.

### Messtag und Video

- Ein Messtag ersetzt den normalen Trainingstag und wird als eigener Tagestyp gespeichert.
- Der GPT ruft vor der Analyse den bisherigen Trainings-, Mess- und Bewegungsanalyseverlauf ab.
- Videos werden ausschließlich im Chat bereitgestellt und dort gesichtet.
- Die Videodateien und Chat-Anhänge werden nicht in Supabase gespeichert.
- Gespeichert werden strukturierte Ableitungen: Bewegung, Stärken, technische Befunde, Risiken, Empfehlungen, abgeleitete Messwerte und Analysekontext.
- Änderungen an Unterzielen werden danach nur vorgeschlagen und erst nach Nutzerbestätigung aktiviert.

## 6. Technische Bausteine v0.10

- unveränderliches Hauptziel durch Datenbank-Trigger und API-Prüfung,
- nutzerbestätigte Kontext-Action mit Historie,
- bestätigungspflichtige Unterzieländerung,
- „profile_tracking_fields“ für Custom- und temporäre Felder,
- „check_in_body_regions“ für flexible Körperregionen,
- „plan_type“ für Training, Messtag, Recovery und Pause,
- „movement_analyses“ ohne Videodateien,
- Evidenzmetadaten an Assessment und Trainingsplan,
- Berliner Datum und Uhrzeit in der Check-in-Vorlage,
- vollständige Check-in-Detailanzeige im Dashboard.

## 7. Noch empfohlener Stabilitätsausbau

Die komplette Check-in-Kette sollte in einer späteren Ausbaustufe atomar und idempotent werden. Empfohlen sind ein Idempotenzschlüssel, Workflowstatus und eine transaktionale Action für Check-in, Assessment und Tagesplan. So entstehen bei Action-Ausfällen keine halbfertigen Tage oder Duplikate.
