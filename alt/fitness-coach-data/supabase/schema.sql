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

create index if not exists check_ins_entry_date_idx on check_ins (entry_date desc);
create index if not exists check_outs_entry_date_idx on check_outs (entry_date desc);
create index if not exists coach_recommendations_entry_date_idx on coach_recommendations (entry_date desc);

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
