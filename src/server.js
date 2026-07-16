import "dotenv/config";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./db.js";
import { checkInSchema, checkOutSchema, plannedCheckOutSchema, trainingPlanSchema, trackedMetricSchema } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.API_KEY;
const dashboardPassword = process.env.DASHBOARD_PASSWORD || "";
const sessionSecret = process.env.SESSION_SECRET || apiKey || "dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

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

async function getDashboardSummary() {
  const [today, recentCheckIns, recentCheckOuts, weeklyLoad, todayTrainingPlan, metricTrends] = await Promise.all([
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
    )
  ]);

  return {
    today: today.rows[0] ?? null,
    recent_check_ins: recentCheckIns.rows,
    recent_check_outs: recentCheckOuts.rows,
    weekly_load: weeklyLoad.rows,
    today_training_plan: todayTrainingPlan,
    metric_trends: metricTrends.rows
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
      entry_date, activity, workout_type, duration_minutes, intensity, rpe,
      calories, distance_km, sets_summary, coach_rating, felt_after, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    returning *`,
    [
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

app.post("/check-ins", async (req, res) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid check-in", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const result = await query(
    `insert into check_ins (
      entry_date, body_weight_kg, sleep_hours, sleep_quality, energy, soreness,
      stress, motivation, readiness, resting_hr, hrv_ms, pain_notes, notes
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    returning *`,
    [
      data.date,
      data.body_weight_kg ?? null,
      data.sleep_hours ?? null,
      data.sleep_quality,
      data.energy,
      data.soreness,
      data.stress ?? null,
      data.motivation,
      data.readiness ?? null,
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

  const checkOut = await insertCheckOut(parsed.data);

  res.status(201).json({ check_out: checkOut });
});

app.post("/training-plans", async (req, res) => {
  const parsed = trainingPlanSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid training plan", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const planResult = await query(
    `insert into training_plans (
      entry_date, should_train, status, session_title, session_type, goal,
      estimated_duration_minutes, intensity_target, coach_summary, coach_reasoning,
      mental_focus, warnings
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    returning *`,
    [
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
    res.json({ date, training_plan: null, exercise_defaults: [] });
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

  res.json({ date, training_plan: plan, exercise_defaults: exerciseDefaults });
});

app.post("/planned-check-outs", async (req, res) => {
  const parsed = plannedCheckOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid planned check-out", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const checkOut = await insertCheckOut(data);
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
  const result = await query(
    `select
      (select row_to_json(c) from (select * from check_ins order by entry_date desc, created_at desc limit 1) c) as latest_check_in,
      (select row_to_json(c) from (select * from check_outs order by entry_date desc, created_at desc limit 1) c) as latest_check_out,
      (select json_agg(d order by entry_date desc) from (select * from daily_summary order by entry_date desc limit 14) d) as daily_history`
  );

  res.json(result.rows[0]);
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Fitness coach API listening on port ${port}`);
});
