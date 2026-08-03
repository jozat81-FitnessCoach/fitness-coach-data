create extension if not exists pgcrypto;

create table if not exists check_ins (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  body_weight_kg numeric(5,2),
  sleep_hours numeric(4,2),
  sleep_quality integer not null check (sleep_quality between 1 and 10),
  energy integer not null check (energy between 1 and 10),
  soreness integer not null check (soreness between 1 and 10),
  stress integer check (stress between 1 and 10),
  motivation integer not null check (motivation between 1 and 10),
  readiness integer check (readiness between 1 and 10),
  resting_hr integer check (resting_hr > 0),
  hrv_ms numeric(6,2),
  pain_notes text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists check_outs (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  activity text not null,
  workout_type text,
  duration_minutes integer not null check (duration_minutes > 0),
  intensity integer not null check (intensity between 1 and 10),
  rpe integer check (rpe between 1 and 10),
  calories integer check (calories > 0),
  distance_km numeric(7,2),
  sets_summary text,
  coach_rating integer check (coach_rating between 1 and 10),
  felt_after integer check (felt_after between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists coach_recommendations (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  recommendation_type text not null,
  title text not null,
  body text not null,
  confidence integer check (confidence between 1 and 10),
  created_at timestamptz not null default now()
);

create table if not exists tracked_metrics (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  source_type text not null check (source_type in ('check_in', 'check_out', 'training_plan', 'manual')),
  source_id uuid,
  category text not null,
  metric_key text not null,
  label text not null,
  numeric_value numeric(10,2),
  text_value text,
  unit text,
  scale_min numeric(10,2),
  scale_max numeric(10,2),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null,
  should_train boolean not null,
  status text not null default 'planned' check (status in ('planned', 'completed', 'adjusted', 'skipped')),
  session_title text not null,
  session_type text,
  goal text,
  estimated_duration_minutes integer check (estimated_duration_minutes > 0),
  intensity_target text,
  coach_summary text,
  coach_reasoning text,
  mental_focus text,
  warnings text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists training_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans(id) on delete cascade,
  sort_order integer not null default 1,
  exercise_name text not null,
  block_name text,
  sets text,
  reps text,
  load_text text,
  rpe_target text,
  rest_seconds integer,
  tempo text,
  technical_notes text,
  today_focus text,
  alternative text,
  created_at timestamptz not null default now()
);

create table if not exists exercise_results (
  id uuid primary key default gen_random_uuid(),
  check_out_id uuid references check_outs(id) on delete cascade,
  plan_exercise_id uuid references training_plan_exercises(id) on delete set null,
  entry_date date not null,
  exercise_name text not null,
  planned_sets text,
  planned_reps text,
  planned_load_text text,
  actual_sets text,
  actual_reps text,
  actual_load_text text,
  rpe integer check (rpe between 1 and 10),
  pain_score integer check (pain_score between 1 and 10),
  completed boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists check_ins_entry_date_idx on check_ins (entry_date desc);
create index if not exists check_outs_entry_date_idx on check_outs (entry_date desc);
create index if not exists coach_recommendations_entry_date_idx on coach_recommendations (entry_date desc);
create index if not exists tracked_metrics_entry_date_idx on tracked_metrics (entry_date desc);
create index if not exists tracked_metrics_key_idx on tracked_metrics (metric_key, entry_date desc);
create index if not exists training_plans_entry_date_idx on training_plans (entry_date desc);
create index if not exists training_plan_exercises_plan_idx on training_plan_exercises (plan_id, sort_order);
create index if not exists exercise_results_entry_date_idx on exercise_results (entry_date desc);

create or replace view daily_summary as
select
  d.entry_date,
  ci.id as check_in_id,
  ci.body_weight_kg,
  ci.sleep_hours,
  ci.sleep_quality,
  ci.energy,
  ci.soreness,
  ci.stress,
  ci.motivation,
  ci.readiness,
  ci.resting_hr,
  ci.hrv_ms,
  coalesce(count(co.id), 0)::int as workout_count,
  coalesce(sum(co.duration_minutes), 0)::int as workout_minutes,
  round(coalesce(sum(co.duration_minutes * co.intensity), 0)::numeric, 1) as training_load,
  round(avg(co.intensity)::numeric, 1) as avg_intensity,
  max(ci.created_at) as check_in_created_at,
  max(co.created_at) as latest_check_out_at
from (
  select entry_date from check_ins
  union
  select entry_date from check_outs
) d
left join lateral (
  select *
  from check_ins
  where check_ins.entry_date = d.entry_date
  order by created_at desc
  limit 1
) ci on true
left join check_outs co on co.entry_date = d.entry_date
group by
  d.entry_date,
  ci.id,
  ci.body_weight_kg,
  ci.sleep_hours,
  ci.sleep_quality,
  ci.energy,
  ci.soreness,
  ci.stress,
  ci.motivation,
  ci.readiness,
  ci.resting_hr,
  ci.hrv_ms;
