-- Pipeline stage + audit metadata. Does not alter scoring semantics.
-- Older rows remain valid; new columns are nullable except retry_count default.

alter table evaluations
  add column if not exists stage text
    check (
      stage is null
      or stage in (
        'pending',
        'extracting_evidence',
        'aggregating_evidence',
        'evaluating',
        'validating',
        'scoring',
        'completed',
        'failed'
      )
    );

alter table evaluations
  add column if not exists provider text;

alter table evaluations
  add column if not exists pipeline_version text;

alter table evaluations
  add column if not exists processing_path text
    check (
      processing_path is null
      or processing_path in ('single', 'chunked')
    );

alter table evaluations
  add column if not exists chunk_count integer;

alter table evaluations
  add column if not exists model_call_count integer;

alter table evaluations
  add column if not exists retry_count integer not null default 0;

alter table evaluations
  add column if not exists processing_duration_ms integer;

alter table evaluations
  add column if not exists evidence_count integer;

alter table evaluations
  add column if not exists verified_evidence_count integer;

alter table evaluations
  add column if not exists rejected_evidence_count integer;

create index if not exists evaluations_stage_idx on evaluations (stage);

update evaluations
  set stage = status
  where stage is null
    and status in ('pending', 'completed', 'failed');
