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
  plannedCheckOutSchema,
  profileSetupSchema,
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

3. Koerperlicher Zustand
- Muskelkater gesamt (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Beine (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Oberkoerper (0 = keiner, 10 = sehr stark): ___/10
- Muskelkater Ruecken/Rumpf (0 = keiner, 10 = sehr stark): ___/10
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
- Besondere Einschraenkungen heute: ___
- Was steht heute sonst an? ___
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
  { key: "soreness", label: "Muskelkater gesamt", type: "scale", scale_min: 0, scale_max: 10, help_text: "0 = keiner, 10 = sehr stark" },
  { key: "muscle_soreness_legs", label: "Muskelkater Beine", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "muscle_soreness_upper", label: "Muskelkater Oberkoerper", type: "scale", scale_min: 0, scale_max: 10 },
  { key: "muscle_soreness_back_core", label: "Muskelkater Ruecken/Rumpf", type: "scale", scale_min: 0, scale_max: 10 },
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
  { key: "daily_context", label: "Was steht heute sonst an?", type: "text" },
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

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function localDateTime() {
  return new Date().toISOString();
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

function buildDefaultGoalProposal(profile) {
  return {
    profile_id: profile.id,
    recommended_first_profile: "Sprungkraft und Explosivitaet",
    confirmation_required: true,
    goals: [
      {
        title: "Sprungkraft und Explosivitaet steigern",
        goal_level: "primary",
        goal_type: "performance",
        priority: 10,
        description: "Basketballnahe Schnellkraft, Absprungqualitaet, Antritt und Landestabilitaet verbessern.",
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
  const [today, recentCheckIns, recentCheckOuts, weeklyLoad, todayTrainingPlan, metricTrends, activeGoals, latestAssessment, recentMeasurementDays] = await Promise.all([
    query("select * from daily_summary where entry_date = current_date"),
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

  return {
    profile,
    active_goals: activeGoals.rows,
    latest_daily_assessment: latestAssessment.rows[0] ?? null,
    today: today.rows[0] ?? null,
    recent_check_ins: recentCheckIns.rows,
    recent_check_outs: recentCheckOuts.rows,
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
      primary_goal = coalesce($3, primary_goal),
      user_context_json = coalesce($4, user_context_json),
      available_equipment_json = coalesce($5, available_equipment_json),
      training_constraints_json = coalesce($6, training_constraints_json),
      updated_at = now()
    where id = $7
    returning *`,
    [
      data.display_name ?? null,
      data.timezone ?? null,
      data.primary_goal ?? null,
      data.user_context ?? null,
      data.available_equipment ?? null,
      data.training_constraints ?? null,
      current.id
    ]
  );

  res.json({ profile: result.rows[0] });
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
  const proposal = buildDefaultGoalProposal(profile);
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
        goal.goal_level ?? "primary",
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
  res.json({
    date: req.query.date || getTodayIsoDate(),
    local_datetime: localDateTime(),
    profile,
    active_goal: activeGoal,
    fields: standardCheckInFields,
    template_markdown: standardCheckInTemplate
  });
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
      next_step_summary, scoring_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
      data.scoring ?? {}
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
      next_step_summary, scoring_json
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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
      scores.scoring
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
      muscle_soreness_other, stress, motivation, readiness,
      pain_present, pain_area, pain_intensity, mobility, sickness,
      available_training_minutes, training_window, available_equipment,
      daily_constraints, daily_context, resting_hr, hrv_ms, pain_notes, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
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

  const metrics = await insertTrackedMetrics(req.body.tracked_metrics, {
    date: data.date,
    source_type: "check_in",
    source_id: result.rows[0].id
  });

  res.status(201).json({ check_in: result.rows[0], tracked_metrics: metrics });
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
      entry_date, should_train, status, session_title, session_type, goal,
      estimated_duration_minutes, intensity_target, coach_summary, coach_reasoning,
      mental_focus, nutrition_recommendation, warnings
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    returning *`,
    [
      profile.id,
      data.goal_id ?? null,
      data.daily_assessment_id ?? null,
      data.date,
      data.should_train,
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
      data.warnings ?? null
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
    planned_sets: exercise.sets,
    planned_reps: exercise.reps,
    planned_load_text: exercise.load_text,
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
    `- Geplant: ${exercise.planned_sets ?? "-"} x ${exercise.planned_reps ?? "-"} @ ${exercise.planned_load_text ?? "-"}`,
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
