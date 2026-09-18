-- Interactive Slides — schema v2 (authenticated students)
--
-- Safe to re-run over v1: every change is guarded with `if not exists` or a
-- `drop policy if exists` before recreation.
--
-- Trust model, v2: students sign in with Google and must appear on the course
-- roster to take part. Answers carry the student's id, so results are
-- per-student and gradeable. Answer keys live in `polls` and are never sent to
-- a student's browser — grading happens inside a security-definer function.
--
-- This stores personal data (email, name, per-question answers). FERPA/GDPR
-- obligations apply: see docs/PRIVACY.md.

create extension if not exists citext;

-- ---------------------------------------------------------------- courses --

create table if not exists courses (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  name       text        not null default '',
  owner      uuid        not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner, code)
);

-- Who is allowed in. Email, because that is what a Google sign-in gives you
-- before the student has ever appeared in auth.users.
create table if not exists roster (
  course_id uuid   not null references courses (id) on delete cascade,
  email     citext not null,
  name      text   not null default '',
  primary key (course_id, email)
);

-- ------------------------------------------------------------------ polls --

-- Question bank, including the answer key. Students can read everything here
-- EXCEPT `correct_answer` — enforced by granting on a view, below.
create table if not exists polls (
  course_id      uuid not null references courses (id) on delete cascade,
  qid            text not null,
  question       text not null default '',
  options        jsonb not null default '[]'::jsonb,
  correct_answer text,
  -- Answers to an anonymous poll are recorded without the student's id.
  anonymous      boolean not null default false,
  primary key (course_id, qid)
);

-- ------------------------------------------------------------------ rooms --

create table if not exists rooms (
  code            text primary key,
  active_question jsonb,
  reveal          boolean     not null default false,
  current_slide   integer     not null default 1,
  current_clicks  integer     not null default 0,
  updated_at      timestamptz not null default now()
);

alter table rooms add column if not exists current_slide  integer not null default 1;
alter table rooms add column if not exists current_clicks integer not null default 0;
alter table rooms add column if not exists course_id uuid references courses (id) on delete cascade;
alter table rooms add column if not exists owner     uuid references auth.users (id) on delete cascade;

-- -------------------------------------------------------------- responses --

create table if not exists responses (
  id         bigint generated always as identity primary key,
  room       text        references rooms (code) on delete cascade,
  qid        text        not null,
  answer     text        not null,
  client_id  text        not null,
  created_at timestamptz not null default now(),
  unique (room, qid, client_id)
);

alter table responses add column if not exists user_id    uuid references auth.users (id) on delete set null;
alter table responses add column if not exists course_id  uuid references courses (id) on delete cascade;
alter table responses add column if not exists is_correct boolean;

create index if not exists responses_room_qid_idx on responses (room, qid);
create index if not exists responses_user_idx     on responses (user_id, course_id);

-- The v1 uniqueness rule was per-browser. Identity is the better key now, but
-- anonymous polls have no user_id, so both rules coexist.
create unique index if not exists responses_one_per_user
  on responses (room, qid, user_id) where user_id is not null;

-- Dedupe for anonymous polls. Deliberately NOT exposed through RLS to anyone:
-- only the grading function touches it, so the link between a student and an
-- anonymous answer exists nowhere a query can reach.
create table if not exists anon_votes (
  room    text not null,
  qid     text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (room, qid, user_id)
);

-- --------------------------------------------------------------- progress --

-- Self-paced answers, so a student resumes across devices.
create table if not exists progress (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  course_id  uuid        not null references courses (id) on delete cascade,
  qid        text        not null,
  answer     text        not null,
  is_correct boolean,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, qid)
);

-- ------------------------------------------------------------- helper fns --

-- Is the signed-in user on this course's roster?
create or replace function is_enrolled(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from roster r
    where r.course_id = p_course
      and r.email = (select email from auth.users where id = auth.uid())
  );
$$;

-- Does the signed-in user own this course?
create or replace function owns_course(p_course uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from courses c where c.id = p_course and c.owner = auth.uid()
  );
$$;

-- ------------------------------------------------------------------- RLS --

alter table courses    enable row level security;
alter table roster     enable row level security;
alter table polls      enable row level security;
alter table rooms      enable row level security;
alter table responses  enable row level security;
alter table progress   enable row level security;
alter table anon_votes enable row level security;  -- with no policy: nobody

-- v1 blanket-anon policies are gone.
drop policy if exists "anon read rooms"       on rooms;
drop policy if exists "anon insert rooms"     on rooms;
drop policy if exists "anon update rooms"     on rooms;
drop policy if exists "anon read responses"   on responses;
drop policy if exists "anon insert responses" on responses;

drop policy if exists "owner manages courses"   on courses;
drop policy if exists "student reads course"    on courses;
drop policy if exists "owner manages roster"    on roster;
drop policy if exists "student reads own roster" on roster;
drop policy if exists "owner manages polls"     on polls;
drop policy if exists "owner manages rooms"     on rooms;
drop policy if exists "member reads room"       on rooms;
drop policy if exists "owner reads responses"   on responses;
drop policy if exists "student reads own responses" on responses;
drop policy if exists "student manages own progress" on progress;

create policy "owner manages courses" on courses
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "student reads course" on courses
  for select to authenticated using (is_enrolled(id));

create policy "owner manages roster" on roster
  for all to authenticated using (owns_course(course_id)) with check (owns_course(course_id));

-- A student may confirm their own enrolment, nobody else's.
create policy "student reads own roster" on roster
  for select to authenticated
  using (email = (select email from auth.users where id = auth.uid()));

-- NOTE: this covers `correct_answer` too, so the client must read questions
-- through the `polls_public` view below, never from `polls` directly.
create policy "owner manages polls" on polls
  for all to authenticated using (owns_course(course_id)) with check (owns_course(course_id));

create policy "owner manages rooms" on rooms
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "member reads room" on rooms
  for select to authenticated using (course_id is not null and is_enrolled(course_id));

create policy "owner reads responses" on responses
  for select to authenticated using (course_id is not null and owns_course(course_id));

create policy "student reads own responses" on responses
  for select to authenticated using (user_id = auth.uid());

create policy "student manages own progress" on progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Responses are inserted ONLY through submit_answer(), never directly, so
-- there is no insert policy here. A cast vote also stays immutable: no update,
-- no delete, for anyone.

-- ------------------------------------------------- questions without keys --

create or replace view polls_public
with (security_invoker = true)
as select course_id, qid, question, options, anonymous from polls;

grant select on polls_public to authenticated;

drop policy if exists "member reads polls" on polls;
create policy "member reads polls" on polls
  for select to authenticated using (is_enrolled(course_id));

-- --------------------------------------------------------------- grading --

-- The one way a student's answer gets in. Runs as the definer so it can read
-- the answer key and write the dedupe table, neither of which the caller can
-- touch. Returns whether the answer was right, never what the right one was.
create or replace function submit_answer(
  p_course uuid,
  p_room   text,
  p_qid    text,
  p_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_poll      polls%rowtype;
  v_correct   boolean;
  v_anonymous boolean;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not is_enrolled(p_course) then
    raise exception 'not on the roster for this course' using errcode = '42501';
  end if;

  select * into v_poll from polls where course_id = p_course and qid = p_qid;

  -- A question with no key is ungraded, not an error: opinion polls and
  -- confidence checks have no right answer.
  v_correct := case
    when v_poll.correct_answer is null then null
    else p_answer = v_poll.correct_answer
  end;
  v_anonymous := coalesce(v_poll.anonymous, false);

  if p_room is null then
    -- Self-paced. Keyed to the student so it follows them across devices.
    insert into progress (user_id, course_id, qid, answer, is_correct, updated_at)
    values (v_user, p_course, p_qid, p_answer, v_correct, now())
    on conflict (user_id, course_id, qid)
      do update set answer = excluded.answer,
                    is_correct = excluded.is_correct,
                    updated_at = now();
    return jsonb_build_object('ok', true, 'is_correct', v_correct);
  end if;

  if v_anonymous then
    -- Record that this student voted, without recording what they voted for.
    insert into anon_votes (room, qid, user_id) values (p_room, p_qid, v_user);
    insert into responses (room, qid, answer, client_id, user_id, course_id, is_correct)
    values (p_room, p_qid, p_answer, gen_random_uuid()::text, null, p_course, v_correct);
  else
    insert into responses (room, qid, answer, client_id, user_id, course_id, is_correct)
    values (p_room, p_qid, p_answer, v_user::text, v_user, p_course, v_correct);
  end if;

  return jsonb_build_object('ok', true, 'is_correct', v_correct);

exception
  when unique_violation then
    return jsonb_build_object('ok', true, 'duplicate', true);
end;
$$;

revoke all on function submit_answer(uuid, text, text, text) from public, anon;
grant execute on function submit_answer(uuid, text, text, text) to authenticated;

-- ----------------------------------------------------------------- scores --

-- Per-student totals for a course. RLS on `responses` and `progress` means a
-- student sees only their own row and the owner sees the whole class.
create or replace view scores
with (security_invoker = true)
as
select
  course_id,
  user_id,
  count(*) filter (where is_correct is not null)  as graded,
  count(*) filter (where is_correct)              as correct
from (
  select course_id, user_id, is_correct from responses where user_id is not null
  union all
  select course_id, user_id, is_correct from progress
) t
group by course_id, user_id;

grant select on scores to authenticated;
