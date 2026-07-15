import "dotenv/config";
import cors from "cors";
import express from "express";
import { query } from "./db.js";
import { checkInSchema, checkOutSchema } from "./validation.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.API_KEY;

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  if (req.path === "/health") {
    next();
    return;
  }

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

app.get("/health", async (_req, res) => {
  const db = await query("select now() as now");
  res.json({ ok: true, database_time: db.rows[0].now });
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

  res.status(201).json({ check_in: result.rows[0] });
});

app.post("/check-outs", async (req, res) => {
  const parsed = checkOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid check-out", details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
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

  res.status(201).json({ check_out: result.rows[0] });
});

app.get("/dashboard-summary", async (_req, res) => {
  const [today, recentCheckIns, recentCheckOuts, weeklyLoad] = await Promise.all([
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
    )
  ]);

  res.json({
    today: today.rows[0] ?? null,
    recent_check_ins: recentCheckIns.rows,
    recent_check_outs: recentCheckOuts.rows,
    weekly_load: weeklyLoad.rows
  });
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
