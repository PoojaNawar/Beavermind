-- Subject fields for the report header (client-facing). Scoring is unchanged.

alter table evaluations
  add column if not exists client_name text;

alter table evaluations
  add column if not exists coach_name text;

alter table evaluations
  add column if not exists client_details text;
