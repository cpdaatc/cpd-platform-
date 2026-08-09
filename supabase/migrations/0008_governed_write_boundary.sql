-- Force sensitive Phase-1 business writes through governed SECURITY DEFINER
-- commands that authorize the active role context and write audit events atomically.

revoke insert, update, delete on public.activities from authenticated;
revoke insert, update, delete on public.activity_assignments from authenticated;

drop policy if exists activities_insert_admin on public.activities;
drop policy if exists activities_update_admin on public.activities;
drop policy if exists assignments_insert_manager on public.activity_assignments;
drop policy if exists assignments_update_manager on public.activity_assignments;
