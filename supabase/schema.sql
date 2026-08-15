-- Sukoon: minimum data model per PRD section 8.
-- Run this in the Supabase SQL editor for a fresh project.

create extension if not exists "pgcrypto";

create table if not exists parents (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    phone_number text not null unique,
    preferred_language text not null default 'hi-en',
    created_at timestamptz not null default now()
);

create table if not exists calls (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid not null references parents(id) on delete cascade,
    timestamp timestamptz not null default now(),
    transcript text,
    audio_url text,
    mood_score int not null check (mood_score between 1 and 5),
    coherence_score int not null check (coherence_score between 1 and 5),
    medication_taken text not null check (medication_taken in ('yes', 'no', 'unclear')),
    new_complaint text,
    flagged_urgent boolean not null default false
);

create table if not exists family_contacts (
    id uuid primary key default gen_random_uuid(),
    parent_id uuid not null references parents(id) on delete cascade,
    whatsapp_number text not null,
    name text not null
);

create index if not exists calls_parent_id_timestamp_idx on calls (parent_id, timestamp desc);
