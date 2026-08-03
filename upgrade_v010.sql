-- Fitness Coach v0.10: unveraenderliches Hauptziel, dynamische Check-in-Felder,
-- Kontext-Historie, Messtag-Tagesplaene und gespeicherte Video-Ableitungen.

alter table profiles add column if not exists primary_goal_locked boolean not null default true;

create or replace function prevent_profile_primary_goal_mutation()
returns trigger language plpgsql as $$
begin
  if old.primary_goal is distinct from new.primary_goal then
    raise exception 'The primary goal is immutable for this project';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_primary_goal_immutable on profiles;
create trigger profiles_primary_goal_immutable
before update on profiles
for each row execute function prevent_profile_primary_goal_mutation();

create table if not exists profile_context_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  context_json jsonb not null default '{}'::jsonb,
  available_equipment_json jsonb not null default '[]'::jsonb,
  training_constraints_json jsonb not null default '{}'::jsonb,
  change_reason text not null,
  changed_by text not null default 'user' check (changed_by = 'user'),
  created_at timestamptz not null default now()
);

create table if not exists profile_tracking_fields (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  metric_key text not null,
  label text not null,
  category text not null,
  field_kind text not null check (field_kind in ('custom', 'temporary')),
  value_type text not null check (value_type in ('number', 'scale', 'text', 'boolean')),
  unit text,
  scale_min numeric(10,2),
  scale_max numeric(10,2),
  scale_min_label text,
  scale_max_label text,
  required boolean not null default false,
  active boolean not null default true,
  active_from date not null default current_date,
  active_until date,
  rationale text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, metric_key)
);

create table if not exists check_in_body_regions (
  id uuid primary key default gen_random_uuid(),
  check_in_id uuid not null references check_ins(id) on delete cascade,
  region_key text not null,
  region_label text not null,
  soreness_score integer check (soreness_score between 0 and 10),
  pain_score integer check (pain_score between 0 and 10),
  notes text,
  created_at timestamptz not null default now(),
  unique (check_in_id, region_key)
);

alter table check_ins add column if not exists mood_wellbeing integer check (mood_wellbeing between 0 and 10);
alter table coach_daily_assessments add column if not exists evidence_json jsonb not null default '{}'::jsonb;
alter table training_plans add column if not exists plan_type text not null default 'training'
  check (plan_type in ('training', 'measurement', 'recovery', 'pause'));
alter table training_plans add column if not exists measurement_day_id uuid references measurement_days(id) on delete set null;
alter table training_plans add column if not exists evidence_json jsonb not null default '{}'::jsonb;
alter table measurement_days add column if not exists check_in_id uuid references check_ins(id) on delete set null;
alter table measurement_days add column if not exists daily_assessment_id uuid references coach_daily_assessments(id) on delete set null;

create table if not exists movement_analyses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  measurement_day_id uuid references measurement_days(id) on delete set null,
  measurement_test_id uuid references measurement_tests(id) on delete set null,
  entry_date date not null,
  movement_name text not null,
  source_description text,
  summary text not null,
  strengths text,
  technical_findings text,
  risks text,
  recommendations text,
  analysis_context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists profile_context_history_profile_idx on profile_context_history(profile_id, created_at desc);
create index if not exists profile_tracking_fields_active_idx on profile_tracking_fields(profile_id, active, field_kind);
create index if not exists check_in_body_regions_check_in_idx on check_in_body_regions(check_in_id);
create index if not exists movement_analyses_profile_date_idx on movement_analyses(profile_id, entry_date desc);

create unique index if not exists one_active_primary_goal_per_profile
  on goals(profile_id) where goal_level = 'primary' and status = 'active';

create or replace function prevent_primary_goal_mutation()
returns trigger language plpgsql as $$
begin
  if old.goal_level = 'primary' and (
    new.title is distinct from old.title or
    new.description is distinct from old.description or
    new.status is distinct from old.status or
    new.valid_until is distinct from old.valid_until or
    new.success_criteria_json is distinct from old.success_criteria_json
  ) then
    raise exception 'The primary goal is immutable for this project';
  end if;
  return new;
end;
$$;

drop trigger if exists goals_primary_immutable on goals;
create trigger goals_primary_immutable
before update on goals
for each row execute function prevent_primary_goal_mutation();

create or replace view daily_summary as
select
  d.entry_date,
  ci.id as check_in_id,
  ci.body_weight_kg, ci.sleep_hours, ci.sleep_quality, ci.energy, ci.soreness,
  ci.muscle_soreness_legs, ci.muscle_soreness_upper, ci.muscle_soreness_back_core,
  ci.stress, ci.motivation, ci.mood_wellbeing, ci.readiness,
  ci.pain_present, ci.pain_area, ci.pain_intensity, ci.mobility, ci.sickness,
  ci.resting_hr, ci.hrv_ms,
  coalesce(count(co.id), 0)::int as workout_count,
  coalesce(sum(co.duration_minutes), 0)::int as workout_minutes,
  round(coalesce(sum(co.duration_minutes * co.intensity), 0)::numeric, 1) as training_load,
  round(avg(co.intensity)::numeric, 1) as avg_intensity,
  max(ci.created_at) as check_in_created_at,
  max(co.created_at) as latest_check_out_at
from (select entry_date from check_ins union select entry_date from check_outs) d
left join lateral (
  select * from check_ins where check_ins.entry_date = d.entry_date order by created_at desc limit 1
) ci on true
left join check_outs co on co.entry_date = d.entry_date
group by d.entry_date, ci.id, ci.body_weight_kg, ci.sleep_hours, ci.sleep_quality,
  ci.energy, ci.soreness, ci.muscle_soreness_legs, ci.muscle_soreness_upper,
  ci.muscle_soreness_back_core, ci.stress, ci.motivation, ci.mood_wellbeing,
  ci.readiness, ci.pain_present, ci.pain_area, ci.pain_intensity, ci.mobility,
  ci.sickness, ci.resting_hr, ci.hrv_ms;
