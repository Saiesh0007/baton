-- Merge-save for the shared working state: the reviewer (reviews) and the leaver (interview answers)
-- can save at the same time without overwriting each other. Top-level keys in `patch` replace the
-- stored ones; other keys are kept. Runs as the caller, so row-level security still decides who may write.
create or replace function public.patch_state(p uuid, patch jsonb) returns integer
language sql security invoker set search_path = public as $$
  with u as (
    update public.project_state
       set data = data || patch, updated_at = now(), updated_by = auth.uid()
     where project_id = p
    returning 1
  )
  select count(*)::int from u
$$;
grant execute on function public.patch_state(uuid, jsonb) to authenticated;
