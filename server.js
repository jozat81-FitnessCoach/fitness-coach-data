import "dotenv/config";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";
import {
  checkInSchema,
  checkOutSchema,
  dailyAssessmentSchema,
  goalConfirmSchema,
  measurementDaySchema,
  movementAnalysisSchema,
  plannedCheckOutSchema,
  profileContextSchema,
  profileSetupSchema,
  trackingFieldsSchema,
  trainingPlanSchema,
  trackedMetricSchema
} from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.API_KEY;
const dashboardPassword = process.env.DASHBOARD_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || apiKey || "dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");
const defaultTimezone = "Europe/Berlin";

const standardCheckInTemplate = `CHECK-IN
Datum/Uhrzeit: [automatisch vorbefuellt]

1. Basis
- Koerpergewicht: ___ kg
- Schlafdauer: ___ h
- Schlafqualitaet (0 = sehr schlecht, 10 = sehr gut): ___/10

2. Energie, Motivation, Stress
- Energielevel (0 = voellig erschoepft, 10 = sehr energiegeladen): ___/10
- Motivation (0 = keine Motivation, 10 = sehr hohe Motivation): ___/10
- Mentale Belastung / Stress (0 = keine Belastung, 10 = extrem hoch): ___/10
- Laune und Wohlbefinden (0 = sehr schlecht, 10 = sehr gut): ___/10

3. Koerperlicher Zustand
- Muskelkater gesamt (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Waden und Fuesse (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Oberschenkel (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Rumpf (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Ruecken (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Oberkoerper (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater sonstiges: ___
- Beweglichkeit/Steifigkeit (0 = sehr steif, 10 = sehr locker): ___/10
- Krankheitsgefuehl (0 = keines, 10 = stark krank): ___/10

4. Schmerzen / Beschwerden
- Schmerzen oder Beschwerden vorhanden? ja/nein: ___
- Beschwerdebereich(e): ___
- Beschwerdeintensitaet (0 = keine, 10 = starke Schmerzen / Training nicht sinnvoll): ___/10

5. Training heute
- Trainingsbereitschaft heute (0 = gar nicht bereit, 10 = voll bereit): ___/10
- Verfuegbare Trainingszeit: ___ Minuten
- Trainingsfenster / Tageszeit: ___
- Verfuegbare Ausstattung: ___

6. Tageskontext
- Besondere Termine heute: ___
- Besondere Einschraenkungen heute: ___
- Was steht heute sonst an? (inkl. Termine): ___
- Freitext-Notiz: ___`;

const standardCheckOutTemplate = `CHECK-OUT
Datum/Uhrzeit: [automatisch vorbefuellt]

1. Trainingsplan - vorausgefuellt aus dem heutigen Plan
Bitte nur Abweichungen aendern. Wenn alles wie geplant gemacht wurde, Werte stehen lassen.

[Uebungen werden dynamisch aus dem Trainingsplan eingefuegt]

2. Gesamtbewertung der Einheit
- Gesamtdauer: ___ Minuten
- Subjektive Gesamtbelastung (0 = sehr leicht, 10 = maximal hart): ___/10
- Trainingsqualitaet / Ausfuehrung (0 = unsauber, 10 = technisch stark): ___/10
- Energie waehrend des Trainings (0 = leer, 10 = sehr energiegeladen): ___/10
- Explosivitaet / Spritzigkeit (0 = traege, 10 = sehr explosiv): ___/10
- Fokus / Konzentration (0 = unkonzentriert, 10 = voll fokussiert): ___/10

3. Schmerzen / Beschwerden
- Schmerzen oder Beschwerden waehrend/nach dem Training? ja/nein: ___
- Beschwerdebereich(e): ___
- Beschwerdeintensitaet (0 = keine, 10 = starke Schmerzen / Abbruch noetig): ___/10

4. Muskel- und Technikgefuehl
- Muskelgefuehl / Zielmuskel getroffen (0 = gar nicht, 10 = sehr gut): ___/10
- Technikgefuehl (0 = instabil / unsauber, 10 = stabil / sauber): ___/10

5. Regeneration
- Erschoepfung nach der Einheit (0 = gar nicht, 10 = komplett leer): ___/10
- Regenerationsbedarf subjektiv (0 = kaum noetig, 10 = hoch): ___/10

6. Reflexion
- Was lief gut? Was hat sich verbessert? ___
- Was lief nicht gut / was war auffaellig? ___
- Abweichungen vom Plan: ___
- Freitext-Notiz: ___`;

const standardCheckInFields = [
  { key: "body_weight_kg", label: "Koerpergewicht", type: "number", unit: "kg" },
  { key: "sleep_hours", label: "Schlafdauer", type: "number", unit: "h" },
  { key: "sleep_quality", label: "Schlafqualitaet", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = sehr schlecht, 10 = sehr gut" },
  { key: "energy", label: "Energielevel", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = voellig erschoepft, 10 = sehr energiegeladen" },
  { key: "motivation", label: "Motivation", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keine Motivation, 10 = sehr hohe Motivation" },
  { key: "stress", label: "Mentale Belastung / Stress", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keine Belastung, 10 = extrem hoch" },
  { key: "mood_wellbeing", label: "Laune und Wohlbefinden", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = sehr schlecht, 10 = sehr gut" },
  { key: "soreness", label: "Muskelkater gesamt", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark" },
  { key: "soreness_calves_feet", label: "Muskelkater Waden und Fuesse", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark", storage: "body_regions" },
  { key: "soreness_thighs", label: "Muskelkater Oberschenkel", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark", storage: "body_regions" },
  { key: "soreness_core", label: "Muskelkater Rumpf", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark", storage: "body_regions" },
  { key: "soreness_back", label: "Muskelkater Ruecken", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark", storage: "body_regions" },
  { key: "soreness_upper_body", label: "Muskelkater Oberkoerper", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark", storage: "body_regions" },
  { key: "muscle_soreness_other", label: "Muskelkater sonstiges", type: "text" },
  { key: "pain_present", label: "Schmerzen oder Beschwerden vorhanden?", type: "boolean" },
  { key: "pain_area", label: "Beschwerdebereich(e)", type: "text" },
  { key: "pain_intensity", label: "Beschwerdeintensitaet", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "mobility", label: "Beweglichkeit/Steifigkeit", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = sehr steif, 10 = sehr locker" },
  { key: "sickness", label: "Krankheitsgefuehl", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "readiness", label: "Trainingsbereitschaft heute", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "available_training_minutes", label: "Verfuegbare Trainingszeit", type: "number", unit: "min" },
  { key: "training_window", label: "Trainingsfenster / Tageszeit", type: "text" },
  { key: "available_equipment", label: "Verfuegbare Ausstattung", type: "text" },
  { key: "daily_constraints", label: "Besondere Einschraenkungen heute", type: "text" },
  { key: "daily_context", label: "Besondere Termine / was steht heute sonst an?", type: "text" },
  { key: "notes", label: "Freitext-Notiz", type: "text" }
];

const standardCheckOutFields = [
  { key: "duration_minutes", label: "Gesamtdauer der Einheit", type: "number", unit: "min" },
  { key: "intensity", label: "Subjektive Gesamtbelastung", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "training_quality", label: "Trainingsqualitaet / Ausfuehrung", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "training_energy", label: "Energie waehrend des Trainings", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "explosiveness", label: "Explosivitaet / Spritzigkeit", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "focus", label: "Fokus / Konzentration", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "pain_present", label: "Schmerzen oder Beschwerden waehrend/nach dem Training?", type: "boolean" },
  { key: "pain_area", label: "Beschwerdebereich(e)", type: "text" },
  { key: "pain_intensity", label: "Beschwerdeintensitaet", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "muscle_feel", label: "Muskelgefuehl / Zielmuskel getroffen?", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "technique_feel", label: "Technikgefuehl", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "exhaustion_after", label: "Erschoepfung nach der Einheit", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "recovery_need", label: "Regenerationsbedarf subjektiv", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "went_well", label: "Was lief gut? Was hat sich verbessert?", type: "text" },
  { key: "not_well", label: "Was lief nicht gut / was war auffaellig?", type: "text" },
  { key: "plan_deviations", label: "Abweichungen vom Plan", type: "text" },
  { key: "notes", label: "Freitext-Notiz", type: "text" }
];

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

function signSession(value) {
  return crypto.createHmac("sha256", sessionSecret).update(value).digest("hex");
}

function getCookie(req, name) {
  const cookies = req.get("cookie") || "";
  const match = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function isDashboardAuthenticated(req) {
  const token = getCookie(req, "fitness_dashboard");
  return token && token === signSession("dashboard");
}

function requireDashboardAuth(req, res, next) {
  if (!dashboardPassword) {
    res.status(503).send("Dashboard password is not configured. Set DASHBOARD_PASSWORD in Render.");
    return;
  }

  if (!isDashboardAuthenticated(req)) {
    res.redirect("/app/login");
    return;
  }

  next();
}

async function getOrCreateDefaultProfile() {
  const existing = await query("select * from profiles order by created_at asc limit 1");
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await query(
    `insert into profiles (display_name, timezone, primary_goal, user_context_json, available_equipment_json)
    values ($1,$2,$3,$4,$5)
    returning *`,
    [
      "Johannes",
      defaultTimezone,
      "Sprungkraft und Explosivitaet steigern",
      { sport: "Basketball", initial_profile: true },
      ["Hanteln", "Langhantel", "Basketballkorb", "Baender", "Koerpergewicht"]
    ]
  );
  return created.rows[0];
}

async function getProfile(profileId) {
  if (profileId) {
    const result = await query("select * from profiles where id = $1", [profileId]);
    if (result.rows[0]) return result.rows[0];
  }
  return getOrCreateDefaultProfile();
}

async function getActiveGoal(profileId) {
  const result = await query(
    `select *
    from goals
    where profile_id = $1 and status = 'active'
    order by priority desc, created_at asc
    limit 1`,
    [profileId]
  );
  return result.rows[0] ?? null;
}

function berlinDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: defaultTimezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    timeZoneName: "longOffset"
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  const offset = (value("timeZoneName") || "GMT+00:00").replace("GMT", "");
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    local_datetime: `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}:${value("second")}${offset}`
  };
}

function getTodayIsoDate() {
  return berlinDateTime().date;
}

function localDateTime() {
  return berlinDateTime().local_datetime;
}

function scoreToPercent(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return Math.round(Math.max(0, Math.min(10, Number(value))) * 10);
}

function average(values) {
  const usable = values.filter((value) => value != null && !Number.isNaN(Number(value))).map(Number);
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function derivePragmaticReadiness(checkIn) {
  const inverse = (value) => (value == null ? null : 10 - Number(value));
  const health10 = average([
    inverse(checkIn.pain_intensity),
    inverse(checkIn.sickness),
    inverse(checkIn.soreness),
    checkIn.mobility
  ]);
  const mental10 = average([checkIn.motivation, inverse(checkIn.stress), checkIn.readiness]);
  const physical10 = average([
    checkIn.energy,
    checkIn.sleep_quality,
    inverse(checkIn.soreness),
    inverse(checkIn.muscle_soreness_legs),
    checkIn.readiness
  ]);
  const total10 = average([health10, mental10, physical10]);
  const total = scoreToPercent(total10);
  return {
    readiness_total: total,
    readiness_health: scoreToPercent(health10),
    readiness_mental: scoreToPercent(mental10),
    readiness_physical: scoreToPercent(physical10),
    traffic_light: total == null ? "neutral" : total >= 75 ? "green" : total >= 55 ? "yellow" : "red",
    scoring: {
      method: "pragmatic_v1",
      note: "Startgewichtung wird spaeter anhand Verlauf und Coach-Feedback kalibriert.",
      health_inputs: ["pain_intensity", "sickness", "soreness", "mobility"],
      mental_inputs: ["motivation", "stress", "readiness"],
      physical_inputs: ["energy", "sleep_quality", "soreness", "muscle_soreness_legs", "readiness"]
    }
  };
}

function buildDefaultGoalProposal(profile, primaryGoal) {
  return {
    profile_id: profile.id,
    recommended_first_profile: "Explosive Kraftbasis und Landestabilitaet",
    confirmation_required: true,
    goals: [
      {
        title: "Explosive Kraftbasis und Landestabilitaet entwickeln",
        parent_goal_id: primaryGoal?.id ?? null,
        goal_level: "supporting",
        goal_type: "training_phase",
        priority: 8,
        description: "Zeitlich begrenztes Unterziel zur Unterstuetzung des unveraenderlichen Hauptziels.",
        success_criteria: {
          direction: "increase",
          examples: ["hoeher springen", "explosiver antreten", "stabiler landen"]
        },
        research_basis: {
          approach: "GPT waehlt konkrete Messtag-Tests fachlich begruendet aus qualifizierten Quellen aus.",
          measurement_count: "ueberschaubar halten"
        },
        metrics: [
          { metric_key: "jump_height", label: "Sprunghoehe", role: "primary", target_direction: "increase", measurement_frequency: "Messtag", priority: 10 },
          { metric_key: "single_leg_jump_symmetry", label: "Einbeinige Sprung-Symmetrie", role: "supporting", target_direction: "maintain", measurement_frequency: "Messtag", priority: 8 },
          { metric_key: "broad_jump", label: "Standweitsprung", role: "supporting", target_direction: "increase", measurement_frequency: "Messtag", priority: 7 },
          { metric_key: "sprint_start_quality", label: "Antritt / Sprintstart", role: "supporting", target_direction: "increase", measurement_frequency: "Messtag", priority: 7 }
        ],
        training_principles: [
          { principle_type: "power", title: "Qualitaet vor Menge", description: "Explosive Wiederholungen nur bei sauberer Technik und ausreichender Frische.", priority: 10 },
          { principle_type: "strength", title: "Kraftbasis erhalten und ausbauen", description: "Unterkoerper- und Rumpfkraft bleiben Grundlage fuer Sprungkraft.", priority: 8 },
          { principle_type: "recovery", title: "Sprung- und Sehnenbelastung steuern", description: "Hohe Intensitaeten werden anhand Readiness, Schmerz und Muskelkater dosiert.", priority: 9 }
        ]
      }
    ]
  };
}

function buildMeasurementDayProposal(goal) {
  return {
    goal_id: goal?.id ?? null,
    title: "Messtag Sprungkraft und Explosivitaet",
    status: "proposed",
    trigger_reason: "GPT entscheidet anhand Verlauf, Check-in, Trainingsphase und Ziel, wann ein Messtag sinnvoll ist. Die Anzahl der Tests bleibt bewusst ueberschaubar.",
    tests: [
      {
        metric_key: "jump_height",
        test_name: "Vertikalsprung / Powermove-Hoehe",
        protocol: "Nach Warm-up 3-5 Versuche, bester sauberer Versuch zaehlt. Volle Pause zwischen Versuchen.",
        unit: "cm",
        target_direction: "increase",
        sort_order: 1,
        research_basis: { reason: "Direkter Kernindikator fuer Sprungkraft." }
      },
      {
        metric_key: "single_leg_jump_symmetry",
        test_name: "Einbeiniger Sprung links/rechts",
        protocol: "Je Seite 3 saubere Versuche. Seitenvergleich und Stabilitaet dokumentieren.",
        unit: "cm",
        target_direction: "maintain",
        sort_order: 2,
        research_basis: { reason: "Zeigt Seitenunterschiede und Belastbarkeit." }
      },
      {
        metric_key: "broad_jump",
        test_name: "Standweitsprung",
        protocol: "3 Versuche aus ruhigem Stand. Bester Versuch und Landungsqualitaet dokumentieren.",
        unit: "cm",
        target_direction: "increase",
        sort_order: 3,
        research_basis: { reason: "Einfacher Indikator fuer horizontale Explosivkraft." }
      },
      {
        metric_key: "sprint_start_quality",
        test_name: "Antritt / Sprintstart 5-10 m",
        protocol: "3 kurze Antritte. Zeit, subjektive Explosivitaet oder Videoqualitaet erfassen.",
        unit: "sec/text",
        target_direction: "decrease",
        sort_order: 4,
        research_basis: { reason: "Basketballnaher Transfer von Schnellkraft in Antritt." }
      }
    ]
  };
}

async function getDashboardSummary() {
  const profile = await getOrCreateDefaultProfile();
  const [today, dailyHistory, recentCheckIns, recentCheckOuts, weeklyLoad, todayTrainingPlan, metricTrends, activeGoals, latestAssessment, recentMeasurementDays] = await Promise.all([
    query("select * from daily_summary where entry_date = current_date"),
    query("select * from daily_summary order by entry_date desc limit 14"),
    query("select * from check_ins order by entry_date desc, created_at desc limit 14"),
    query("select * from check_outs order by entry_date desc, created_at desc limit 20"),
    query(
      `select
        date_trunc('week', entry_date)::date as week_start,
        count(*)::int as sessions,
        coalesce(sum(duration_minutes), 0)::int as minutes,
        round(coalesce(sum(duration_minutes * intensity), 0)::numeric, 1) as load
      from check_outs
      where entry_date >= current_date - interval '8 weeks'
      group by 1
      order by 1 desc`
    ),
    getTodayTrainingPlan(),
    query(
      `select *
      from tracked_metrics
      where entry_date >= current_date - interval '30 days'
      order by entry_date desc, created_at desc
      limit 80`
    ),
    query(
      `select *
      from goals
      where profile_id = $1 and status = 'active'
      order by priority desc, created_at asc`,
      [profile.id]
    ),
    query(
      `select *
      from coach_daily_assessments
      where profile_id = $1
      order by entry_date desc, created_at desc
      limit 1`,
      [profile.id]
    ),
    query(
      `select *
      from measurement_days
      where profile_id = $1
      order by entry_date desc, created_at desc
      limit 8`,
      [profile.id]
    )
  ]);

  let recentCheckOutRows = recentCheckOuts.rows;
  let recentCheckInRows = recentCheckIns.rows;
  const checkInIds = recentCheckInRows.map((row) => row.id);
  if (checkInIds.length) {
    const bodyRegions = await query(
      `select * from check_in_body_regions
       where check_in_id = any($1::uuid[])
       order by created_at asc`,
      [checkInIds]
    );
    const byCheckIn = bodyRegions.rows.reduce((acc, row) => {
      acc[row.check_in_id] = acc[row.check_in_id] || [];
      acc[row.check_in_id].push(row);
      return acc;
    }, {});
    recentCheckInRows = recentCheckInRows.map((row) => ({
      ...row,
      body_regions: byCheckIn[row.id] || []
    }));
  }
  const checkOutIds = recentCheckOutRows.map((row) => row.id);
  if (checkOutIds.length) {
    const exerciseResults = await query(
      `select *
      from exercise_results
      where check_out_id = any($1::uuid[])
      order by entry_date desc, created_at asc`,
      [checkOutIds]
    );
    const byCheckOut = exerciseResults.rows.reduce((acc, row) => {
      acc[row.check_out_id] = acc[row.check_out_id] || [];
      acc[row.check_out_id].push(row);
      return acc;
    }, {});
    recentCheckOutRows = recentCheckOutRows.map((row) => ({
      ...row,
      exercise_results: byCheckOut[row.id] || []
    }));
  }

  return {
    profile,
    active_goals: activeGoals.rows,
    latest_daily_assessment: latestAssessment.rows[0] ?? null,
    today: today.rows[0] ?? null,
    daily_history: dailyHistory.rows,
    recent_check_ins: recentCheckInRows,
    recent_check_outs: recentCheckOutRows,
    weekly_load: weeklyLoad.rows,
    today_training_plan: todayTrainingPlan,
    metric_trends: metricTrends.rows,
    recent_measurement_days: recentMeasurementDays.rows
  };
}

async function insertTrackedMetrics(metrics = [], defaults = {}) {
  const saved = [];
  for (const metric of metrics) {
    const data = {
      ...metric,
      date: metric.date ?? defaults.date,
      source_type: metric.source_type ?? defaults.source_type,
      source_id: metric.source_id ?? defaults.source_id
    };
    const parsed = trackedMetricSchema.safeParse(data);
    if (!parsed.success) {
      continue;
    }

    const m = parsed.data;
    const result = await query(
      `insert into tracked_metrics (
        entry_date, source_type, source_id, category, metric_key, label,
        numeric_value, text_value, unit, scale_min, scale_max, notes
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      returning *`,
      [
        m.date,
        m.source_type,
        m.source_id ?? null,
        m.category,
        m.metric_key,
        m.label,
        m.numeric_value ?? null,
        m.text_value ?? null,
        m.unit ?? null,
        m.scale_min ?? null,
        m.scale_max ?? null,
        m.notes ?? null
      ]
    );
    saved.push(result.rows[0]);
  }
  return saved;
}

async function getTrainingPlanByDate(date) {
  const planResult = await query(
    `select *
    from training_plans
    where entry_date = $1
    order by created_at desc
    limit 1`,
    [date]
  );
  const plan = planResult.rows[0];
  if (!plan) {
    return null;
  }

  const exercises = await query(
    `select *
    from training_plan_exercises
    where plan_id = $1
    order by sort_order asc, created_at asc`,
    [plan.id]
  );

  return {
    ...plan,
    exercises: exercises.rows
  };
}

async function getTodayTrainingPlan() {
  const dateResult = await query("select current_date::text as today");
  return getTrainingPlanByDate(dateResult.rows[0].today);
}

async function insertCheckOut(data) {
  const result = await query(
    `insert into check_outs (
      profile_id, plan_id, local_datetime,
      entry_date, activity, workout_type, duration_minutes, intensity, rpe,
      calories, distance_km, sets_summary, coach_rating, felt_after,
      training_quality, training_energy, explosiveness, focus,
      pain_present, pain_area, pain_intensity, muscle_feel, technique_feel,
      exhaustion_after, recovery_need, went_well, not_well, plan_deviations,
      notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
    returning *`,
    [
      data.profile_id ?? null,
      data.plan_id ?? null,
      data.local_datetime ?? null,
      data.date,
      data.activity,
      data.workout_type ?? null,
      data.duration_minutes,
      data.intensity,
      data.rpe ?? null,
      data.calories ?? null,
      data.distance_km ?? null,
      data.sets_summary ?? null,
      data.coach_rating ?? null,
      data.felt_after ?? null,
      data.training_quality ?? null,
      data.training_energy ?? null,
      data.explosiveness ?? null,
      data.focus ?? null,
      data.pain_present ?? null,
      data.pain_area ?? null,
      data.pain_intensity ?? null,
      data.muscle_feel ?? null,
      data.technique_feel ?? null,
      data.exhaustion_after ?? null,
      data.recovery_need ?? null,
      data.went_well ?? null,
      data.not_well ?? null,
      data.plan_deviations ?? null,
      data.notes ?? null
    ]
  );
  return result.rows[0];
}

app.get("/health", async (_req, res) => {
  const db = await query("select now() as now");
  res.json({ ok: true, database_time: db.rows[0].now });
});

app.get("/", (_req, res) => {
  res.redirect("/app");
});

app.get("/app/login", (_req, res) => {
  res.sendFile(path.join(publicDir, "login.html"));
});

app.get("/app/styles.css", (_req, res) => {
  res.sendFile(path.join(publicDir, "styles.css"));
});

app.post("/app/login", (req, res) => {
  if (!dashboardPassword) {
    res.status(503).send("Dashboard password is not configured. Set DASHBOARD_PASSWORD in Render.");
    return;
  }

  if (req.body.password !== dashboardPassword) {
    res.status(401).send("Falsches Passwort. Bitte zurueckgehen und erneut versuchen.");
    return;
  }

  const secure = req.secure || req.get("x-forwarded-proto") === "https";
  res.cookie("fitness_dashboard", signSession("dashboard"), {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
  res.redirect("/app");
});

app.post("/app/logout", (_req, res) => {
  res.clearCookie("fitness_dashboard");
  res.redirect("/app/login");
});

app.get("/app-data/summary", requireDashboardAuth, async (_req, res) => {
  res.json(await getDashboardSummary());
});

app.use("/app", requireDashboardAuth, express.static(publicDir));

app.use((req, res, next) => {
  if (!apiKey) {
    res.status(500).json({ error: "API_KEY is not configured" });
    return;
  }

  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (token !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
});

app.get("/profile/current", async (req, res) => {
  const profile = await getProfile(req.query.profile_id);
  const activeGoal = await getActiveGoal(profile.id);
  res.json({ profile, active_goal: activeGoal });
});

app.post("/profile/setup", async (req, res) => {
  const parsed = profileSetupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid profile setup", details: parsed.error.flatten() });
    return;
  }

  const current = await getOrCreateDefaultProfile();
  const data = parsed.data;
  const result = await query(
    `update profiles
    set display_name = coalesce($1, display_name),
      timezone = coalesce($2, timezone),
      updated_at = now()
    where id = $3
    returning *`,
    [
      data.display_name ?? null,
      data.timezone ?? null,
      current.id
    ]
  );

  res.json({ profile: result.rows[0] });
});

app.post("/profile/context", async (req, res) => {
  const parsed = profileContextSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Context changes require explicit user confirmation", details: parsed.error.flatten() });
    return;
  }
  const profile = await getProfile(parsed.data.profile_id);
  const data = parsed.data;
  const result = await query(
    `update profiles set
      user_context_json = $1,
      available_equipment_json = coalesce($2, available_equipment_json),
      training_constraints_json = coalesce($3, training_constraints_json),
      updated_at = now()
    where id = $4 returning *`,
    [data.user_context, data.available_equipment ?? null, data.training_constraints ?? null, profile.id]
  );
  await query(
    `insert into profile_context_history (
      profile_id, context_json, available_equipment_json, training_constraints_json,
      change_reason, changed_by
    ) values ($1,$2,$3,$4,$5,'user')`,
    [
      profile.id,
      data.user_context,
      data.available_equipment ?? result.rows[0].available_equipment_json,
      data.training_constraints ?? result.rows[0].training_constraints_json,
      data.change_reason
    ]
  );
  res.json({ profile: result.rows[0], context_changed_by: "user" });
});

app.get("/goals", async (req, res) => {
  const profile = await getProfile(req.query.profile_id);
  const goals = await query(
    `select *
    from goals
    where profile_id = $1
    order by status asc, priority desc, created_at asc`,
    [profile.id]
  );
  res.json({ profile, goals: goals.rows });
});

app.post("/goals/propose", async (req, res) => {
  const profile = await getProfile(req.body?.profile_id);
  const primaryGoal = await getActiveGoal(profile.id);
  const proposal = buildDefaultGoalProposal(profile, primaryGoal);
  res.json({
    proposal,
    instruction: "Bitte mit dem Nutzer abstimmen. Erst nach ausdruecklicher Bestaetigung /goals/confirm aufrufen."
  });
});

app.post("/goals/confirm", async (req, res) => {
  const parsed = goalConfirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goals", details: parsed.error.flatten() });
    return;
  }

  const profile = await getProfile(parsed.data.profile_id);
  const proposedPrimary = parsed.data.goals.find((goal) => (goal.goal_level ?? "supporting") === "primary");
  const existingPrimary = await query(
    "select * from goals where profile_id = $1 and goal_level = 'primary' and status = 'active' limit 1",
    [profile.id]
  );
  if (proposedPrimary && existingPrimary.rows[0]) {
    res.status(409).json({ error: "Primary goal is immutable. Start a new project for a new primary goal." });
    return;
  }
  if (parsed.data.replacement_mode === "replace_supporting") {
    await query(
      `update goals set status = 'archived', valid_until = current_date, updated_at = now()
       where profile_id = $1 and goal_level in ('secondary','supporting') and status = 'active'`,
      [profile.id]
    );
  }
  const savedGoals = [];

  for (const goal of parsed.data.goals) {
    const goalResult = await query(
      `insert into goals (
        profile_id, parent_goal_id, title, goal_level, goal_type, description,
        priority, valid_from, valid_until, notes, success_criteria_json,
        constraints_json, research_basis_json
      ) values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,current_date),$9,$10,$11,$12,$13)
      returning *`,
      [
        profile.id,
        goal.parent_goal_id ?? null,
        goal.title,
        goal.goal_level ?? "supporting",
        goal.goal_type ?? null,
        goal.description ?? null,
        goal.priority ?? 1,
        goal.valid_from ?? null,
        goal.valid_until ?? null,
        goal.notes ?? null,
        goal.success_criteria ?? {},
        goal.constraints ?? {},
        goal.research_basis ?? {}
      ]
    );
    const savedGoal = goalResult.rows[0];

    for (const metric of goal.metrics ?? []) {
      await query(
        `insert into goal_metrics (
          goal_id, metric_key, label, role, target_value, target_unit,
          target_direction, measurement_frequency, priority, notes
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          savedGoal.id,
          metric.metric_key,
          metric.label,
          metric.role ?? "tracking",
          metric.target_value ?? null,
          metric.target_unit ?? null,
          metric.target_direction ?? null,
          metric.measurement_frequency ?? null,
          metric.priority ?? 1,
          metric.notes ?? null
        ]
      );
    }

    for (const principle of goal.training_principles ?? []) {
      await query(
        `insert into goal_training_principles (
          goal_id, principle_type, title, description, priority, active
        ) values ($1,$2,$3,$4,$5,$6)`,
        [
          savedGoal.id,
          principle.principle_type,
          principle.title,
          principle.description ?? null,
          principle.priority ?? 1,
          principle.active ?? true
        ]
      );
    }

    await query(
      `insert into goal_history (goal_id, change_reason, new_values_json)
      values ($1,$2,$3)`,
      [savedGoal.id, "goal_confirmed_by_user", goal]
    );
    savedGoals.push(savedGoal);
  }

  res.status(201).json({ profile, goals: savedGoals });
});

app.get("/check-in-template", async (req, res) => {
  const profile = await getProfile(req.query.profile_id);
  const activeGoal = await getActiveGoal(profile.id);
  const configuredFields = await query(
    `select metric_key as key, label, category, field_kind, value_type as type,
      unit, scale_min, scale_max, scale_min_label, scale_max_label, required, rationale
     from profile_tracking_fields
     where profile_id = $1 and active = true
       and (active_until is null or active_until >= current_date)
     order by field_kind, category, created_at`,
    [profile.id]
  );
  const dynamicMarkdown = configuredFields.rows.length
    ? "\n\n7. Zusaetzliche Felder\n" + configuredFields.rows.map((field) => {
        const scale = field.type === "scale"
          ? ` (${field.scale_min ?? 0} = ${field.scale_min_label ?? "niedrig"}, ${field.scale_max ?? 10} = ${field.scale_max_label ?? "hoch"})`
          : "";
        return `- ${field.label}${scale}: ___${field.unit ? ` ${field.unit}` : ""}`;
      }).join("\n")
    : "";
  res.json({
    date: req.query.date || getTodayIsoDate(),
    local_datetime: localDateTime(),
    profile,
    active_goal: activeGoal,
    standard_fields: standardCheckInFields,
    custom_fields: configuredFields.rows.filter((field) => field.field_kind === "custom"),
    temporary_fields: configuredFields.rows.filter((field) => field.field_kind === "temporary"),
    template_markdown: standardCheckInTemplate + dynamicMarkdown
  });
});

app.get("/tracking-fields", async (req, res) => {
  const profile = await getProfile(req.query.profile_id);
  const fields = await query(
    "select * from profile_tracking_fields where profile_id = $1 order by active desc, field_kind, category, created_at",
    [profile.id]
  );
  res.json({ profile_id: profile.id, fields: fields.rows });
});

app.post("/tracking-fields/configure", async (req, res) => {
  const parsed = trackingFieldsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid tracking fields", details: parsed.error.flatten() });
    return;
  }
  const profile = await getProfile(parsed.data.profile_id);
  const saved = [];
  for (const field of parsed.data.fields) {
    const result = await query(
      `insert into profile_tracking_fields (
        profile_id, metric_key, label, category, field_kind, value_type, unit,
        scale_min, scale_max, scale_min_label, scale_max_label, required,
        active, active_until, rationale
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      on conflict (profile_id, metric_key) do update set
        label=excluded.label, category=excluded.category, field_kind=excluded.field_kind,
        value_type=excluded.value_type, unit=excluded.unit, scale_min=excluded.scale_min,
        scale_max=excluded.scale_max, scale_min_label=excluded.scale_min_label,
        scale_max_label=excluded.scale_max_label, required=excluded.required,
        active=excluded.active, active_until=excluded.active_until,
        rationale=excluded.rationale, updated_at=now()
      returning *`,
      [profile.id, field.metric_key, field.label, field.category, field.field_kind,
       field.value_type, field.unit ?? null, field.scale_min ?? null, field.scale_max ?? null,
       field.scale_min_label ?? null, field.scale_max_label ?? null, field.required ?? false,
       field.active ?? true, field.active_until ?? null, field.rationale]
    );
    saved.push(result.rows[0]);
  }
  res.status(201).json({ fields: saved });
});

app.post("/daily-assessments", async (req, res) => {
  const parsed = dailyAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid daily assessment", details: parsed.error.flatten() });
    return;
  }

  const profile = await getProfile(parsed.data.profile_id);
  const data = parsed.data;
  const result = await query(
    `insert into coach_daily_assessments (
      profile_id, check_in_id, goal_id, entry_date, readiness_total,
      readiness_health, readiness_mental, readiness_physical, traffic_light,
      coach_statement, reason, mental_alignment, nutrition_recommendation,
      next_step_summary, scoring_json, evidence_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    returning *`,
    [
      profile.id,
      data.check_in_id ?? null,
      data.goal_id ?? null,
      data.date,
      data.readiness_total ?? null,
      data.readiness_health ?? null,
      data.readiness_mental ?? null,
      data.readiness_physical ?? null,
      data.traffic_light ?? "neutral",
      data.coach_statement ?? null,
      data.reason ?? null,
      data.mental_alignment ?? null,
      data.nutrition_recommendation ?? null,
      data.next_step_summary ?? null,
      data.scoring ?? {},
      data.evidence ?? {}
    ]
  );

  const metrics = await insertTrackedMetrics(data.tracked_metrics, {
    date: data.date,
    source_type: "daily_assessment",
    source_id: result.rows[0].id
  });

  res.status(201).json({ daily_assessment: result.rows[0], tracked_metrics: metrics });
});

app.post("/daily-assessments/from-check-in/:checkInId", async (req, res) => {
  const checkInResult = await query("select * from check_ins where id = $1", [req.params.checkInId]);
  const checkIn = checkInResult.rows[0];
  if (!checkIn) {
    res.status(404).json({ error: "Check-in not found" });
    return;
  }

  const profile = await getProfile(checkIn.profile_id);
  const activeGoal = await getActiveGoal(profile.id);
  const scores = derivePragmaticReadiness(checkIn);
  const result = await query(
    `insert into coach_daily_assessments (
      profile_id, check_in_id, goal_id, entry_date, readiness_total,
      readiness_health, readiness_mental, readiness_physical, traffic_light,
      coach_statement, reason, mental_alignment, nutrition_recommendation,
      next_step_summary, scoring_json, evidence_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    returning *`,
    [
      profile.id,
      checkIn.id,
      activeGoal?.id ?? null,
      checkIn.entry_date,
      scores.readiness_total,
      scores.readiness_health,
      scores.readiness_mental,
      scores.readiness_physical,
      scores.traffic_light,
      "Pragmatische Tagesbewertung auf Basis des Check-ins.",
      "Startgewichtung v1: Gesundheit, mentale Readiness und koerperliche Readiness werden aus den Standardwerten abgeleitet und spaeter kalibriert.",
      "Heute klar und ehrlich steuern: Qualitaet vor Ego, Tagesform respektieren.",
      "Kurz und pragmatisch: Eiweiss sichern, rund um Training Kohlenhydrate passend dosieren, ausreichend trinken.",
      "GPT soll darauf aufbauend den konkreten Tagesplan speichern.",
      scores.scoring,
      {}
    ]
  );

  res.status(201).json({ daily_assessment: result.rows[0] });
});

app.post("/measurement-days/propose", async (req, res) => {
  const profile = await getProfile(req.body?.profile_id);
  const activeGoal = req.body?.goal_id
    ? (await query("select * from goals where id = $1", [req.body.goal_id])).rows[0]
    : await getActiveGoal(profile.id);
  const proposal = buildMeasurementDayProposal(activeGoal);
  res.json({
    profile,
    active_goal: activeGoal,
    proposal,
    instruction: "Bitte mit dem Nutzer abstimmen. Tests ueberschaubar halten und erst nach Bestaetigung speichern."
  });
});

app.post("/measurement-days", async (req, res) => {
  const parsed = measurementDaySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid measurement day", details: parsed.error.flatten() });
    return;
  }

  const profile = await getProfile(parsed.data.profile_id);
  const data = parsed.data;
  const dayResult = await query(
    `insert into measurement_days (
      profile_id, goal_id, entry_date, title, status, trigger_reason, notes
    ) values ($1,$2,$3,$4,$5,$6,$7)
    returning *`,
    [
      profile.id,
      data.goal_id ?? null,
      data.date,
      data.title,
      data.status ?? "planned",
      data.trigger_reason ?? null,
      data.notes ?? null
    ]
  );
  const day = dayResult.rows[0];
  const tests = [];
  const results = [];

  for (const [index, test] of data.tests.entries()) {
    const testResult = await query(
      `insert into measurement_tests (
        profile_id, goal_id, metric_key, test_name, protocol, unit,
        target_direction, sort_order, active, research_basis_json
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      returning *`,
      [
        profile.id,
        data.goal_id ?? null,
        test.metric_key,
        test.test_name,
        test.protocol ?? null,
        test.unit ?? null,
        test.target_direction ?? null,
        test.sort_order ?? index + 1,
        test.active ?? true,
        test.research_basis ?? {}
      ]
    );
    const savedTest = testResult.rows[0];
    tests.push(savedTest);

    if (test.result) {
      const result = await query(
        `insert into measurement_results (
          measurement_day_id, measurement_test_id, value_number, value_text,
          unit, attempt_no, notes
        ) values ($1,$2,$3,$4,$5,$6,$7)
        returning *`,
        [
          day.id,
          savedTest.id,
          test.result.value_number ?? null,
          test.result.value_text ?? null,
          test.result.unit ?? test.unit ?? null,
          test.result.attempt_no ?? null,
          test.result.notes ?? null
        ]
      );
      results.push(result.rows[0]);
    }
  }

  let evaluation = null;
  if (data.evaluation) {
    const evaluationResult = await query(
      `insert into measurement_evaluations (
        measurement_day_id, summary, strengths, risks, recommendations
      ) values ($1,$2,$3,$4,$5)
      returning *`,
      [
        day.id,
        data.evaluation.summary ?? null,
        data.evaluation.strengths ?? null,
        data.evaluation.risks ?? null,
        data.evaluation.recommendations ?? null
      ]
    );
    evaluation = evaluationResult.rows[0];
  }

  res.status(201).json({ measurement_day: day, tests, results, evaluation });
});

app.post("/check-ins", async (req, res) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid check-in", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const profile = await getProfile(data.profile_id);
  const result = await query(
    `insert into check_ins (
      profile_id, local_datetime,
      entry_date, body_weight_kg, sleep_hours, sleep_quality, energy, soreness,
      muscle_soreness_legs, muscle_soreness_upper, muscle_soreness_back_core,
      muscle_soreness_other, stress, motivation, mood_wellbeing, readiness,
      pain_present, pain_area, pain_intensity, mobility, sickness,
      available_training_minutes, training_window, available_equipment,
      daily_constraints, daily_context, resting_hr, hrv_ms, pain_notes, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
    returning *`,
    [
      profile.id,
      data.local_datetime ?? null,
      data.date,
      data.body_weight_kg ?? null,
      data.sleep_hours ?? null,
      data.sleep_quality,
      data.energy,
      data.soreness,
      data.muscle_soreness_legs ?? null,
      data.muscle_soreness_upper ?? null,
      data.muscle_soreness_back_core ?? null,
      data.muscle_soreness_other ?? null,
      data.stress ?? null,
      data.motivation,
      data.mood_wellbeing ?? null,
      data.readiness ?? null,
      data.pain_present ?? null,
      data.pain_area ?? null,
      data.pain_intensity ?? null,
      data.mobility ?? null,
      data.sickness ?? null,
      data.available_training_minutes ?? null,
      data.training_window ?? null,
      data.available_equipment ?? null,
      data.daily_constraints ?? null,
      data.daily_context ?? null,
      data.resting_hr ?? null,
      data.hrv_ms ?? null,
      data.pain_notes ?? null,
      data.notes ?? null
    ]
  );

  const bodyRegions = [];
  for (const region of data.body_regions ?? []) {
    const savedRegion = await query(
      `insert into check_in_body_regions (
        check_in_id, region_key, region_label, soreness_score, pain_score, notes
      ) values ($1,$2,$3,$4,$5,$6)
      on conflict (check_in_id, region_key) do update set
        region_label=excluded.region_label, soreness_score=excluded.soreness_score,
        pain_score=excluded.pain_score, notes=excluded.notes
      returning *`,
      [result.rows[0].id, region.region_key, region.region_label,
       region.soreness_score ?? null, region.pain_score ?? null, region.notes ?? null]
    );
    bodyRegions.push(savedRegion.rows[0]);
  }

  const metrics = await insertTrackedMetrics(req.body.tracked_metrics, {
    date: data.date,
    source_type: "check_in",
    source_id: result.rows[0].id
  });

  res.status(201).json({ check_in: result.rows[0], body_regions: bodyRegions, tracked_metrics: metrics });
});

app.post("/check-outs", async (req, res) => {
  const parsed = checkOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid check-out", details: parsed.error.flatten() });
    return;
  }

  const profile = await getProfile(parsed.data.profile_id);
  const checkOut = await insertCheckOut({ ...parsed.data, profile_id: profile.id });

  res.status(201).json({ check_out: checkOut });
});

app.post("/training-plans", async (req, res) => {
  const parsed = trainingPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid training plan", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const profile = await getProfile(data.profile_id);
  const planResult = await query(
    `insert into training_plans (
      profile_id, goal_id, daily_assessment_id,
      entry_date, should_train, plan_type, measurement_day_id, status, session_title, session_type, goal,
      estimated_duration_minutes, intensity_target, coach_summary, coach_reasoning,
      mental_focus, nutrition_recommendation, warnings, evidence_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    returning *`,
    [
      profile.id,
      data.goal_id ?? null,
      data.daily_assessment_id ?? null,
      data.date,
      data.should_train,
      data.plan_type,
      data.measurement_day_id ?? null,
      data.status ?? "planned",
      data.session_title,
      data.session_type ?? null,
      data.goal ?? null,
      data.estimated_duration_minutes ?? null,
      data.intensity_target ?? null,
      data.coach_summary ?? null,
      data.coach_reasoning ?? null,
      data.mental_focus ?? null,
      data.nutrition_recommendation ?? null,
      data.warnings ?? null,
      data.evidence ?? {}
    ]
  );

  const plan = planResult.rows[0];
  const exercises = [];
  for (const [index, exercise] of data.exercises.entries()) {
    const exerciseResult = await query(
      `insert into training_plan_exercises (
        plan_id, sort_order, exercise_name, block_name, sets, reps, load_text,
        rpe_target, rest_seconds, tempo, technical_notes, today_focus, alternative
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      returning *`,
      [
        plan.id,
        exercise.sort_order ?? index + 1,
        exercise.exercise_name,
        exercise.block_name ?? null,
        exercise.sets ?? null,
        exercise.reps ?? null,
        exercise.load_text ?? null,
        exercise.rpe_target ?? null,
        exercise.rest_seconds ?? null,
        exercise.tempo ?? null,
        exercise.technical_notes ?? null,
        exercise.today_focus ?? null,
        exercise.alternative ?? null
      ]
    );
    exercises.push(exerciseResult.rows[0]);
  }

  const metrics = await insertTrackedMetrics(data.tracked_metrics, {
    date: data.date,
    source_type: "training_plan",
    source_id: plan.id
  });

  res.status(201).json({ training_plan: { ...plan, exercises }, tracked_metrics: metrics });
});

app.get("/training-plans/today", async (_req, res) => {
  const plan = await getTodayTrainingPlan();
  res.json({ training_plan: plan });
});

app.get("/check-out-template", async (req, res) => {
  const dateResult = req.query.date ? null : await query("select current_date::text as today");
  const date = req.query.date || dateResult.rows[0].today;
  const plan = await getTrainingPlanByDate(date);

  if (!plan) {
    res.json({
      date,
      training_plan: null,
      exercise_defaults: [],
      standard_fields: standardCheckOutFields,
      template_markdown: standardCheckOutTemplate
    });
    return;
  }

  const exerciseDefaults = plan.exercises.map((exercise) => ({
    plan_exercise_id: exercise.id,
    exercise_name: exercise.exercise_name,
    planned_block_name: exercise.block_name,
    planned_sets: exercise.sets,
    planned_reps: exercise.reps,
    planned_load_text: exercise.load_text,
    planned_rpe_target: exercise.rpe_target,
    planned_rest_seconds: exercise.rest_seconds,
    planned_technical_notes: exercise.technical_notes,
    planned_today_focus: exercise.today_focus,
    planned_alternative: exercise.alternative,
    actual_sets: exercise.sets,
    actual_reps: exercise.reps,
    actual_load_text: exercise.load_text,
    completed: true,
    rpe: null,
    pain_score: null,
    notes: ""
  }));

  const exerciseLines = exerciseDefaults.flatMap((exercise, index) => [
    `Uebung ${index + 1}: ${exercise.exercise_name}`,
    `- Block: ${exercise.planned_block_name ?? "-"}`,
    `- Geplant: ${exercise.planned_sets ?? "-"} x ${exercise.planned_reps ?? "-"} @ ${exercise.planned_load_text ?? "-"}`,
    `- RPE-Ziel / Belastungsziel: ${exercise.planned_rpe_target ?? "-"}`,
    `- Pause: ${exercise.planned_rest_seconds != null ? `${exercise.planned_rest_seconds} Sekunden` : "-"}`,
    `- Technik: ${exercise.planned_technical_notes ?? "-"}`,
    `- Heute achten auf: ${exercise.planned_today_focus ?? "-"}`,
    `- Alternative: ${exercise.planned_alternative ?? "-"}`,
    `- Gemacht: ${exercise.actual_sets ?? "-"} x ${exercise.actual_reps ?? "-"} @ ${exercise.actual_load_text ?? "-"}`,
    "- RPE / Anstrengung (0 = sehr leicht, 10 = maximal): ___/10",
    "- Schmerz / Beschwerden bei der Uebung (0 = keine, 10 = stark): ___/10",
    "- Notiz zur Uebung: ___",
    ""
  ]);

  res.json({
    date,
    training_plan: plan,
    exercise_defaults: exerciseDefaults,
    standard_fields: standardCheckOutFields,
    template_markdown: standardCheckOutTemplate.replace("[Uebungen werden dynamisch aus dem Trainingsplan eingefuegt]", exerciseLines.join("\n"))
  });
});

app.post("/planned-check-outs", async (req, res) => {
  const parsed = plannedCheckOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid planned check-out", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const profile = await getProfile(data.profile_id);
  const checkOut = await insertCheckOut({ ...data, profile_id: profile.id });
  const exerciseResults = [];

  for (const exercise of data.exercise_results ?? []) {
    const result = await query(
      `insert into exercise_results (
        check_out_id, plan_exercise_id, entry_date, exercise_name,
        planned_sets, planned_reps, planned_load_text,
        actual_sets, actual_reps, actual_load_text,
        rpe, pain_score, completed, notes
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      returning *`,
      [
        checkOut.id,
        exercise.plan_exercise_id ?? null,
        data.date,
        exercise.exercise_name,
        exercise.planned_sets ?? null,
        exercise.planned_reps ?? null,
        exercise.planned_load_text ?? null,
        exercise.actual_sets ?? exercise.planned_sets ?? null,
        exercise.actual_reps ?? exercise.planned_reps ?? null,
        exercise.actual_load_text ?? exercise.planned_load_text ?? null,
        exercise.rpe ?? null,
        exercise.pain_score ?? null,
        exercise.completed ?? true,
        exercise.notes ?? null
      ]
    );
    exerciseResults.push(result.rows[0]);
  }

  if (data.plan_id) {
    await query("update training_plans set status = 'completed', updated_at = now() where id = $1", [data.plan_id]);
  }

  const metrics = await insertTrackedMetrics(data.tracked_metrics, {
    date: data.date,
    source_type: "check_out",
    source_id: checkOut.id
  });

  res.status(201).json({ check_out: checkOut, exercise_results: exerciseResults, tracked_metrics: metrics });
});

app.post("/movement-analyses", async (req, res) => {
  const parsed = movementAnalysisSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid movement analysis", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const profile = await getProfile(data.profile_id);
  const result = await query(
    `insert into movement_analyses (
      profile_id, measurement_day_id, measurement_test_id, entry_date,
      movement_name, source_description, summary, strengths, technical_findings,
      risks, recommendations, analysis_context_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    returning *`,
    [profile.id, data.measurement_day_id ?? null, data.measurement_test_id ?? null,
     data.entry_date, data.movement_name, data.source_description ?? null,
     data.summary, data.strengths ?? null, data.technical_findings ?? null,
     data.risks ?? null, data.recommendations ?? null, data.analysis_context ?? {}]
  );
  const metrics = await insertTrackedMetrics(data.derived_metrics, {
    date: data.entry_date,
    source_type: "measurement_day",
    source_id: data.measurement_day_id ?? result.rows[0].id
  });
  res.status(201).json({
    movement_analysis: result.rows[0],
    derived_metrics: metrics,
    media_stored: false
  });
});

app.get("/movement-analyses", async (req, res) => {
  const profile = await getProfile(req.query.profile_id);
  const result = await query(
    `select * from movement_analyses where profile_id = $1
     order by entry_date desc, created_at desc limit 20`,
    [profile.id]
  );
  res.json({ movement_analyses: result.rows });
});

app.get("/dashboard-summary", async (_req, res) => {
  res.json(await getDashboardSummary());
});

app.get("/athlete-state", async (_req, res) => {
  const profile = await getOrCreateDefaultProfile();
  const result = await query(
    `select
      (select row_to_json(c) from (select * from check_ins order by entry_date desc, created_at desc limit 1) c) as latest_check_in,
      (select row_to_json(c) from (select * from check_outs order by entry_date desc, created_at desc limit 1) c) as latest_check_out,
      (select row_to_json(a) from (select * from coach_daily_assessments where profile_id = $1 order by entry_date desc, created_at desc limit 1) a) as latest_daily_assessment,
      (select json_agg(g order by priority desc, created_at asc) from (select * from goals where profile_id = $1 and status = 'active') g) as active_goals,
      (select json_agg(m order by entry_date desc, created_at desc) from (select * from measurement_days where profile_id = $1 order by entry_date desc, created_at desc limit 5) m) as recent_measurement_days,
      (select json_agg(d order by entry_date desc) from (select * from daily_summary order by entry_date desc limit 14) d) as daily_history`,
    [profile.id]
  );

  res.json({ profile, ...result.rows[0] });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Fitness coach API listening on port ${port}`);
});
