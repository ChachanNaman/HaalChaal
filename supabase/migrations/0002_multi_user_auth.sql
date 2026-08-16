-- Adds per-user ownership of parents so multiple families can use the same deployment,
-- each only ever seeing their own parent(s) and call history.
--
-- Run this in the Supabase SQL editor after 0001 (schema.sql).

alter table parents add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- The voice backend writes call results itself (triggered by Twilio webhooks, not a logged-in
-- user), so it needs to bypass RLS entirely -- it now uses the service_role key instead of the
-- anon key (see README). RLS below only governs the anon key, i.e. the dashboard.
alter table parents enable row level security;
alter table calls enable row level security;
alter table family_contacts enable row level security;

create policy "Users manage their own parents" on parents
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users view calls for their own parents" on calls
    for select
    using (exists (
        select 1 from parents
        where parents.id = calls.parent_id and parents.user_id = auth.uid()
    ));

create policy "Users manage family contacts for their own parents" on family_contacts
    for all
    using (exists (
        select 1 from parents
        where parents.id = family_contacts.parent_id and parents.user_id = auth.uid()
    ))
    with check (exists (
        select 1 from parents
        where parents.id = family_contacts.parent_id and parents.user_id = auth.uid()
    ));

-- service_role should already bypass RLS and have full privileges by default in Supabase, but
-- grant explicitly too in case this project's default privileges were altered.
grant select, insert, update, delete on parents to service_role;
grant select, insert, update, delete on calls to service_role;
grant select, insert, update, delete on family_contacts to service_role;
