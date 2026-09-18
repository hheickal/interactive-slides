# Privacy

Version 1 stored nothing that identified anyone. Version 2 does. This page
records what is held, why, and who can see it, so the obligations are explicit
rather than discovered later.

**This is not legal advice.** If you run this for a real course, your
institution almost certainly has a data protection officer and an approval
process for student-facing tools. Talk to them before the first lecture.

## What is stored

| Data | Where | Why |
|---|---|---|
| Email, name, Google account id | Supabase `auth.users` | Identity; matching a student to the roster |
| Roster email + name | `roster` | Deciding who may take part |
| Answer, question id, timestamp, correctness | `responses` | Live tallies and grading |
| Self-paced answers | `progress` | Resuming across devices |
| Answer without any identity | `responses` (anonymous polls) | Honest confidence checks |

Google returns the profile scope by default; nothing beyond email and name is
requested or kept.

## Who can see it

Row Level Security, not application code, decides. The policies are in
[`../supabase/schema.sql`](../supabase/schema.sql).

- **A student** sees their own answers, their own roster row, and their own
  score. Not another student's, and not the answer key.
- **The course owner** sees every answer for their own course, and nothing from
  any other course.
- **Nobody** can read `anon_votes` — RLS is enabled on it with no policy, so
  anonymous answers cannot be traced back even by you, even with a direct query.
- **The service-role key bypasses all of this.** It is in `.env`, gitignored,
  and is the one credential whose leak actually matters.

## Retention

Nothing expires on its own. Deleting a course cascades to its roster, polls,
rooms, responses and progress:

```sql
delete from courses where id = '<course-id>';
```

Deleting one student's data:

```sql
delete from responses where user_id = '<user-id>';
delete from progress   where user_id = '<user-id>';
delete from roster     where email   = 'student@uni.edu';
```

Their anonymous answers stay, by design — they are no longer linked to them and
cannot be identified for removal. Worth saying out loud if a student asks for
erasure.

Decide a retention period per course and act on it. "Kept until someone
remembers" is the usual outcome and the wrong one.

## What to tell students

Before the first poll, say plainly:

- Sign-in records **who** answered **what**, and answers may count toward
  participation or grades.
- Polls marked *anonymous* on the slide are not linked to them at all — the
  badge on the slide is the honest signal, and the schema backs it up.
- Where the data lives (Supabase), how long it is kept, and how to ask for
  removal.

## Residency

Supabase hosts in the region chosen when the project was created. If your
institution requires student data to stay in a particular jurisdiction, check
the project's region **before** a real cohort uses it — moving it later means
recreating the project.
