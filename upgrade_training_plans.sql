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

create index if not exists tracked_metrics_entry_date_idx on tracked_metrics (entry_date desc);
create index if not exists tracked_metrics_key_idx on tracked_metrics (metric_key, entry_date desc);
create index if not exists training_plans_entry_date_idx on training_plans (entry_date desc);
create index if not exists training_plan_exercises_plan_idx on training_plan_exercises (plan_id, sort_order);
create index if not exists exercise_results_entry_date_idx on exercise_results (entry_date desc);
