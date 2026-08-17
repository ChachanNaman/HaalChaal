-- phone_number was globally unique (leftover from before multi-tenant auth existed), which
-- blocks a second user from ever registering a number someone else already used -- including
-- re-registering your own number under a fresh demo account. Scope uniqueness to (user_id,
-- phone_number) instead: still stops one user from registering the same parent twice, but lets
-- different users (or the same person's different demo accounts) share a number.

alter table parents drop constraint if exists parents_phone_number_key;
alter table parents add constraint parents_user_id_phone_number_key unique (user_id, phone_number);
