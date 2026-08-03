create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  timezone text not null default 'Europe/Berlin',
  primary_goal text,
  user_context_json jsonb not null default '{}'::jsonb,
  available_equipment_json jsonb not null default '[]'::jsonb,
  training_constraints_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into profiles (display_name, primary_goal, user_context_json, available_equipment_json)
select
  'Johannes',
  'Sprungkraft und Explosivitaet steigern',
  '{"sport":"Basketball","initial_profile":true}'::jsonb,
  '["Hanteln","Langhantel","Basketballkorb","Baender","Koerpergewicht"]'::jsonb
where not exists (select 1 from profiles);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  parent_goal_id uuid references goals(id) on delete cascade,
  title text not null,
  goal_level text not null default 'primary' check (goal_level in ('primary', 'secondary', 'supporting')),
  goal_type text,
  description text,
  priority integer not null default 1 check (priority between 1 and 10),
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'completed', 'archived')),
  valid_from date not null default current_date,
  valid_until date,
  notes text,
  success_criteria_json jsonb not null default '{}'::jsonb,
  constraints_json jsonb not null default '{}'::jsonb,
  research_basis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goal_metrics (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  metric_key text not null,
  label text not null,
  role text not null default 'tracking',
  target_value numeric(10,2),
  target_unit text,
  target_direction text check (target_direction in ('increase', 'decrease', 'maintain', 'observe')),
  measurement_frequency text,
  priority integer not null default 1 check (priority between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists goal_training_principles (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals(id) on delete cascade,
  principle_type text not null,
  title text not null,
  description text,
  priority integer not null default 1 check (priority between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists goal_history (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid references goals(id) on delete cascade,
  changed_at timestamptz not null default now(),
  changed_by text not null default 'gpt',
  change_reason text,
  old_values_json jsonb,
  new_values_json jsonb not null default '{}'::jsonb
);

create table if not exists check_in_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  name text not null,
  version integer not null default 1,
  active boolean not null default true,
  template_markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists check_out_templates (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  name text not null,
  version integer not null default 1,
  active boolean not null default true,
  template_markdown text not null,
  created_at timestamptz not null default now()
);

create table if not exists coach_daily_assessments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  check_in_id uuid references check_ins(id) on delete set null,
  goal_id uuid references goals(id) on delete set null,
  entry_date date not null,
  readiness_total integer check (readiness_total between 0 and 100),
  readiness_health integer check (readiness_health between 0 and 100),
  readiness_mental integer check (readiness_mental between 0 and 100),
  readiness_physical integer check (readiness_physical between 0 and 100),
  traffic_light text check (traffic_light in ('green', 'yellow', 'red', 'neutral')),
  coach_statement text,
  reason text,
  mental_alignment text,
  nutrition_recommendation text,
  next_step_summary text,
  scoring_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists measurement_days (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  entry_date date not null,
  title text not null,
  status text not null default 'planned' check (status in ('proposed', 'planned', 'completed', 'skipped')),
  trigger_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists measurement_tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  metric_key text not null,
  test_name text not null,
  protocol text,
  unit text,
  target_direction text check (target_direction in ('increase', 'decrease', 'maintain', 'observe')),
  sort_order integer not null default 1,
  active boolean not null default true,
  research_basis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists measurement_results (
  id uuid primary key default gen_random_uuid(),
  measurement_day_id uuid not null references measurement_days(id) on delete cascade,
  measurement_test_id uuid references measurement_tests(id) on delete set null,
  value_number numeric(10,2),
  value_text text,
  unit text,
  attempt_no integer,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists measurement_evaluations (
  id uuid primary key default gen_random_uuid(),
  measurement_day_id uuid not null references measurement_days(id) on delete cascade,
  summary text,
  strengths text,
  risks text,
  recommendations text,
  created_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  file_url text not null,
  file_type text,
  title text,
  notes text,
  uploaded_at timestamptz not null default now()
);

create table if not exists dashboard_configs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  goal_id uuid references goals(id) on delete set null,
  module_key text not null,
  title text not null,
  metric_keys_json jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table check_ins add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table check_ins add column if not exists local_datetime timestamptz;
alter table check_ins add column if not exists muscle_soreness_legs integer check (muscle_soreness_legs between 0 and 10);
alter table check_ins add column if not exists muscle_soreness_upper integer check (muscle_soreness_upper between 0 and 10);
alter table check_ins add column if not exists muscle_soreness_back_core integer check (muscle_soreness_back_core between 0 and 10);
alter table check_ins add column if not exists muscle_soreness_other text;
alter table check_ins add column if not exists pain_present boolean;
alter table check_ins add column if not exists pain_area text;
alter table check_ins add column if not exists pain_intensity integer check (pain_intensity between 0 and 10);
alter table check_ins add column if not exists mobility integer check (mobility between 0 and 10);
alter table check_ins add column if not exists sickness integer check (sickness between 0 and 10);
alter table check_ins add column if not exists available_training_minutes integer check (available_training_minutes > 0);
alter table check_ins add column if not exists training_window text;
alter table check_ins add column if not exists available_equipment text;
alter table check_ins add column if not exists daily_constraints text;
alter table check_ins add column if not exists daily_context text;

alter table check_outs add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table check_outs add column if not exists plan_id uuid references training_plans(id) on delete set null;
alter table check_outs add column if not exists local_datetime timestamptz;
alter table check_outs add column if not exists training_quality integer check (training_quality between 0 and 10);
alter table check_outs add column if not exists training_energy integer check (training_energy between 0 and 10);
alter table check_outs add column if not exists explosiveness integer check (explosiveness between 0 and 10);
alter table check_outs add column if not exists focus integer check (focus between 0 and 10);
alter table check_outs add column if not exists pain_present boolean;
alter table check_outs add column if not exists pain_area text;
alter table check_outs add column if not exists pain_intensity integer check (pain_intensity between 0 and 10);
alter table check_outs add column if not exists muscle_feel integer check (muscle_feel between 0 and 10);
alter table check_outs add column if not exists technique_feel integer check (technique_feel between 0 and 10);
alter table check_outs add column if not exists exhaustion_after integer check (exhaustion_after between 0 and 10);
alter table check_outs add column if not exists recovery_need integer check (recovery_need between 0 and 10);
alter table check_outs add column if not exists went_well text;
alter table check_outs add column if not exists not_well text;
alter table check_outs add column if not exists plan_deviations text;

alter table training_plans add column if not exists profile_id uuid references profiles(id) on delete set null;
alter table training_plans add column if not exists goal_id uuid references goals(id) on delete set null;
alter table training_plans add column if not exists daily_assessment_id uuid references coach_daily_assessments(id) on delete set null;
alter table training_plans add column if not exists nutrition_recommendation text;

alter table tracked_metrics drop constraint if exists tracked_metrics_source_type_check;
alter table tracked_metrics add constraint tracked_metrics_source_type_check
  check (source_type in ('check_in', 'check_out', 'training_plan', 'daily_assessment', 'measurement_day', 'manual'));

alter table check_ins drop constraint if exists check_ins_sleep_quality_check;
alter table check_ins add constraint check_ins_sleep_quality_check check (sleep_quality between 0 and 10);
alter table check_ins drop constraint if exists check_ins_energy_check;
alter table check_ins add constraint check_ins_energy_check check (energy between 0 and 10);
alter table check_ins drop constraint if exists check_ins_soreness_check;
alter table check_ins add constraint check_ins_soreness_check check (soreness between 0 and 10);
alter table check_ins drop constraint if exists check_ins_stress_check;
alter table check_ins add constraint check_ins_stress_check check (stress between 0 and 10);
alter table check_ins drop constraint if exists check_ins_motivation_check;
alter table check_ins add constraint check_ins_motivation_check check (motivation between 0 and 10);
alter table check_ins drop constraint if exists check_ins_readiness_check;
alter table check_ins add constraint check_ins_readiness_check check (readiness between 0 and 10);

alter table check_outs drop constraint if exists check_outs_intensity_check;
alter table check_outs add constraint check_outs_intensity_check check (intensity between 0 and 10);
alter table check_outs drop constraint if exists check_outs_rpe_check;
alter table check_outs add constraint check_outs_rpe_check check (rpe between 0 and 10);
alter table check_outs drop constraint if exists check_outs_coach_rating_check;
alter table check_outs add constraint check_outs_coach_rating_check check (coach_rating between 0 and 10);
alter table check_outs drop constraint if exists check_outs_felt_after_check;
alter table check_outs add constraint check_outs_felt_after_check check (felt_after between 0 and 10);
alter table exercise_results drop constraint if exists exercise_results_rpe_check;
alter table exercise_results add constraint exercise_results_rpe_check check (rpe between 0 and 10);
alter table exercise_results drop constraint if exists exercise_results_pain_score_check;
alter table exercise_results add constraint exercise_results_pain_score_check check (pain_score between 0 and 10);

update check_ins set profile_id = (select id from profiles order by created_at asc limit 1) where profile_id is null;
update check_outs set profile_id = (select id from profiles order by created_at asc limit 1) where profile_id is null;
update training_plans set profile_id = (select id from profiles order by created_at asc limit 1) where profile_id is null;

create index if not exists profiles_created_at_idx on profiles (created_at asc);
create index if not exists goals_profile_status_idx on goals (profile_id, status, priority);
create index if not exists goal_metrics_goal_idx on goal_metrics (goal_id, priority);
create index if not exists check_ins_profile_date_idx on check_ins (profile_id, entry_date desc);
create index if not exists check_outs_profile_date_idx on check_outs (profile_id, entry_date desc);
create index if not exists training_plans_profile_date_idx on training_plans (profile_id, entry_date desc);
create index if not exists daily_assessments_profile_date_idx on coach_daily_assessments (profile_id, entry_date desc);
create index if not exists measurement_days_profile_date_idx on measurement_days (profile_id, entry_date desc);

insert into goals (profile_id, title, goal_level, goal_type, description, priority, success_criteria_json, research_basis_json)
select
  p.id,
  'Sprungkraft und Explosivitaet steigern',
  'primary',
  'performance',
  'Initiales Zielprofil: Sprungkraft, Explosivitaet und basketballnahe Schnellkraft verbessern.',
  10,
  '{"direction":"increase","examples":["hoeher springen","explosiver antreten","stabiler landen"]}'::jsonb,
  '{"decision":"GPT legt konkrete Mess-Tests fachlich begruendet und ueberschaubar fest."}'::jsonb
from profiles p
where not exists (
  select 1 from goals g
  where g.profile_id = p.id
    and g.status = 'active'
    and lower(g.title) like '%sprungkraft%'
);
