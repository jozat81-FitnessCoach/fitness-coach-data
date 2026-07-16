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
