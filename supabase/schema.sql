-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--
-- Trust model: a lecture room. Anyone holding the room code can read the room
-- and cast a vote. There are no accounts and nothing here is authenticated, so
-- a determined student can vote from a second browser or clear localStorage.
-- That is acceptable for participation polls and NOT acceptable for graded
-- assessment — if grading is ever added, this schema needs auth first.

create table if not exists rooms (
  code            text primary key,
  active_question jsonb,
  reveal          boolean     not null default false,
  -- Which slide the presenter is on. Followers mirror these two.
  current_slide   integer     not null default 1,
  current_clicks  integer     not null default 0,
  updated_at      timestamptz not null default now()
);

-- Safe to re-run over an earlier version of this schema.
alter table rooms add column if not exists current_slide  integer not null default 1;
alter table rooms add column if not exists current_clicks integer not null default 0;

create table if not exists responses (
  id         bigint generated always as identity primary key,
  room       text        not null references rooms (code) on delete cascade,
  qid        text        not null,
  answer     text        not null,
  client_id  text        not null,
  created_at timestamptz not null default now(),
  -- one vote per browser per question
  unique (room, qid, client_id)
);

create index if not exists responses_room_qid_idx on responses (room, qid);

alter table rooms     enable row level security;
alter table responses enable row level security;

drop policy if exists "anon read rooms"       on rooms;
drop policy if exists "anon insert rooms"     on rooms;
drop policy if exists "anon update rooms"     on rooms;
drop policy if exists "anon read responses"   on responses;
drop policy if exists "anon insert responses" on responses;

create policy "anon read rooms"       on rooms     for select to anon using (true);
create policy "anon insert rooms"     on rooms     for insert to anon with check (true);
create policy "anon update rooms"     on rooms     for update to anon using (true) with check (true);
create policy "anon read responses"   on responses for select to anon using (true);
create policy "anon insert responses" on responses for insert to anon with check (true);
-- Deliberately no update/delete policy on responses: a cast vote is immutable.

-- Push row changes to subscribed clients.
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table responses;
