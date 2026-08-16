-- SUPERSEDED by supabase/migrations/0002_multi_user_auth.sql now that the dashboard has real
-- user accounts -- that migration re-enables RLS with per-user policies instead. Kept here for
-- history / for anyone doing a quick single-tenant setup without auth.
--
-- This backend is server-only (the anon key lives in voice-backend/.env, never shipped to a
-- browser), so we disable RLS and grant the anon role direct access rather than writing policies.
alter table parents disable row level security;
alter table calls disable row level security;
alter table family_contacts disable row level security;

grant select, insert, update, delete on parents to anon;
grant select, insert, update, delete on calls to anon;
grant select, insert, update, delete on family_contacts to anon;
