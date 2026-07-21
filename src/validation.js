import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const score = z.coerce.number().int().min(0).max(10);
const percentScore = z.coerce.number().int().min(0).max(100);

export const checkInSchema = z.object({
  date: dateString,
  local_datetime: z.string().datetime().optional(),
  profile_id: z.string().uuid().optional(),
  body_weight_kg: z.coerce.number().positive().optional(),
  sleep_hours: z.coerce.number().min(0).max(24).optional(),
  sleep_quality: score,
  energy: score,
  soreness: score,
  muscle_soreness_legs: score.optional(),
  muscle_soreness_upper: score.optional(),
  muscle_soreness_back_core: score.optional(),
  muscle_soreness_other: z.string().max(1000).optional(),
  stress: score.optional(),
  motivation: score,
  readiness: score.optional(),
  pain_present: z.boolean().optional(),
  pain_area: z.string().max(1000).optional(),
  pain_intensity: score.optional(),
  mobility: score.optional(),
  sickness: score.optional(),
  available_training_minutes: z.coerce.number().int().positive().optional(),
  training_window: z.string().max(500).optional(),
  available_equipment: z.string().max(1000).optional(),
  daily_constraints: z.string().max(2000).optional(),
  daily_context: z.string().max(2000).optional(),
  resting_hr: z.coerce.number().int().positive().optional(),
  hrv_ms: z.coerce.number().positive().optional(),
  pain_notes: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  tracked_metrics: z.array(z.lazy(() => trackedMetricSchema)).optional()
});

export const checkOutSchema = z.object({
  date: dateString,
  local_datetime: z.string().datetime().optional(),
  profile_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
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
  training_quality: score.optional(),
  training_energy: score.optional(),
  explosiveness: score.optional(),
  focus: score.optional(),
  pain_present: z.boolean().optional(),
  pain_area: z.string().max(1000).optional(),
  pain_intensity: score.optional(),
  muscle_feel: score.optional(),
  technique_feel: score.optional(),
  exhaustion_after: score.optional(),
  recovery_need: score.optional(),
  went_well: z.string().max(2000).optional(),
  not_well: z.string().max(2000).optional(),
  plan_deviations: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  tracked_metrics: z.array(z.lazy(() => trackedMetricSchema)).optional()
});

export const trackedMetricSchema = z.object({
  date: dateString.optional(),
  source_type: z.enum(["check_in", "check_out", "training_plan", "daily_assessment", "measurement_day", "manual"]).optional(),
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
  profile_id: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional(),
  daily_assessment_id: z.string().uuid().optional(),
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
  nutrition_recommendation: z.string().max(2000).optional(),
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

export const profileSetupSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(100).optional(),
  primary_goal: z.string().max(500).optional(),
  user_context: z.record(z.any()).optional(),
  available_equipment: z.array(z.string()).optional(),
  training_constraints: z.record(z.any()).optional()
});

export const goalConfirmSchema = z.object({
  profile_id: z.string().uuid().optional(),
  goals: z.array(z.object({
    title: z.string().min(1).max(300),
    parent_goal_id: z.string().uuid().optional(),
    goal_level: z.enum(["primary", "secondary", "supporting"]).optional(),
    goal_type: z.string().max(100).optional(),
    description: z.string().max(2000).optional(),
    priority: z.coerce.number().int().min(1).max(10).optional(),
    valid_from: dateString.optional(),
    valid_until: dateString.optional(),
    notes: z.string().max(2000).optional(),
    success_criteria: z.record(z.any()).optional(),
    constraints: z.record(z.any()).optional(),
    research_basis: z.record(z.any()).optional(),
    metrics: z.array(z.object({
      metric_key: z.string().min(1).max(120),
      label: z.string().min(1).max(200),
      role: z.string().max(100).optional(),
      target_value: z.coerce.number().optional(),
      target_unit: z.string().max(50).optional(),
      target_direction: z.enum(["increase", "decrease", "maintain", "observe"]).optional(),
      measurement_frequency: z.string().max(200).optional(),
      priority: z.coerce.number().int().min(1).max(10).optional(),
      notes: z.string().max(1000).optional()
    })).optional(),
    training_principles: z.array(z.object({
      principle_type: z.string().min(1).max(100),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      priority: z.coerce.number().int().min(1).max(10).optional(),
      active: z.boolean().optional()
    })).optional()
  })).min(1)
});

export const dailyAssessmentSchema = z.object({
  date: dateString,
  profile_id: z.string().uuid().optional(),
  check_in_id: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional(),
  readiness_total: percentScore.optional(),
  readiness_health: percentScore.optional(),
  readiness_mental: percentScore.optional(),
  readiness_physical: percentScore.optional(),
  traffic_light: z.enum(["green", "yellow", "red", "neutral"]).optional(),
  coach_statement: z.string().max(2000).optional(),
  reason: z.string().max(4000).optional(),
  mental_alignment: z.string().max(2000).optional(),
  nutrition_recommendation: z.string().max(2000).optional(),
  next_step_summary: z.string().max(2000).optional(),
  scoring: z.record(z.any()).optional(),
  tracked_metrics: z.array(trackedMetricSchema).optional()
});

export const measurementDaySchema = z.object({
  date: dateString,
  profile_id: z.string().uuid().optional(),
  goal_id: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  status: z.enum(["proposed", "planned", "completed", "skipped"]).optional(),
  trigger_reason: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  tests: z.array(z.object({
    metric_key: z.string().min(1).max(120),
    test_name: z.string().min(1).max(200),
    protocol: z.string().max(2000).optional(),
    unit: z.string().max(50).optional(),
    target_direction: z.enum(["increase", "decrease", "maintain", "observe"]).optional(),
    sort_order: z.coerce.number().int().positive().optional(),
    active: z.boolean().optional(),
    research_basis: z.record(z.any()).optional(),
    result: z.object({
      value_number: z.coerce.number().optional(),
      value_text: z.string().max(1000).optional(),
      unit: z.string().max(50).optional(),
      attempt_no: z.coerce.number().int().positive().optional(),
      notes: z.string().max(1000).optional()
    }).optional()
  })).default([]),
  evaluation: z.object({
    summary: z.string().max(4000).optional(),
    strengths: z.string().max(4000).optional(),
    risks: z.string().max(4000).optional(),
    recommendations: z.string().max(4000).optional()
  }).optional()
});
