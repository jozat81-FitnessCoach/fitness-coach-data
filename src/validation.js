import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const score = z.coerce.number().int().min(1).max(10);

export const checkInSchema = z.object({
  date: dateString,
  body_weight_kg: z.coerce.number().positive().optional(),
  sleep_hours: z.coerce.number().min(0).max(24).optional(),
  sleep_quality: score,
  energy: score,
  soreness: score,
  stress: score.optional(),
  motivation: score,
  readiness: score.optional(),
  resting_hr: z.coerce.number().int().positive().optional(),
  hrv_ms: z.coerce.number().positive().optional(),
  pain_notes: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional()
});

export const checkOutSchema = z.object({
  date: dateString,
  activity: z.string().min(1).max(200),
  workout_type: z.string().max(100).optional(),
  duration_minutes: z.coerce.number().int().positive(),
  intensity: score,
  rpe: score.optional(),
  calories: z.coerce.number().int().positive().optional(),
  distance_km: z.coerce.number().positive().optional(),
  sets_summary: z.string().max(4000).optional(),
  coach_rating: score.optional(),
  felt_after: score.optional(),
  notes: z.string().max(4000).optional()
});

export const trackedMetricSchema = z.object({
  date: dateString.optional(),
  source_type: z.enum(["check_in", "check_out", "training_plan", "manual"]).optional(),
  source_id: z.string().uuid().optional(),
  category: z.string().min(1).max(100),
  metric_key: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  numeric_value: z.coerce.number().optional(),
  text_value: z.string().max(2000).optional(),
  unit: z.string().max(40).optional(),
  scale_min: z.coerce.number().optional(),
  scale_max: z.coerce.number().optional(),
  notes: z.string().max(2000).optional()
});

export const trainingPlanSchema = z.object({
  date: dateString,
  should_train: z.boolean(),
  status: z.enum(["planned", "completed", "adjusted", "skipped"]).optional(),
  session_title: z.string().min(1).max(200),
  session_type: z.string().max(100).optional(),
  goal: z.string().max(300).optional(),
  estimated_duration_minutes: z.coerce.number().int().positive().optional(),
  intensity_target: z.string().max(120).optional(),
  coach_summary: z.string().max(2000).optional(),
  coach_reasoning: z.string().max(4000).optional(),
  mental_focus: z.string().max(2000).optional(),
  warnings: z.string().max(2000).optional(),
  exercises: z.array(z.object({
    sort_order: z.coerce.number().int().positive().optional(),
    exercise_name: z.string().min(1).max(200),
    block_name: z.string().max(100).optional(),
    sets: z.string().max(80).optional(),
    reps: z.string().max(80).optional(),
    load_text: z.string().max(120).optional(),
    rpe_target: z.string().max(80).optional(),
    rest_seconds: z.coerce.number().int().positive().optional(),
    tempo: z.string().max(120).optional(),
    technical_notes: z.string().max(1000).optional(),
    today_focus: z.string().max(1000).optional(),
    alternative: z.string().max(1000).optional()
  })).default([]),
  tracked_metrics: z.array(trackedMetricSchema).optional()
});

export const plannedCheckOutSchema = checkOutSchema.extend({
  plan_id: z.string().uuid().optional(),
  exercise_results: z.array(z.object({
    plan_exercise_id: z.string().uuid().optional(),
    exercise_name: z.string().min(1).max(200),
    planned_sets: z.string().max(80).optional(),
    planned_reps: z.string().max(80).optional(),
    planned_load_text: z.string().max(120).optional(),
    actual_sets: z.string().max(80).optional(),
    actual_reps: z.string().max(80).optional(),
    actual_load_text: z.string().max(120).optional(),
    rpe: score.optional(),
    pain_score: score.optional(),
    completed: z.boolean().optional(),
    notes: z.string().max(2000).optional()
  })).optional(),
  tracked_metrics: z.array(trackedMetricSchema).optional()
});
