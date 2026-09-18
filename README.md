# Interactive Slides

Lecture slides with live polls. Students sign in with Google, answer from their
phones, and the tally renders on the slide as it comes in. Answers are graded
server-side against a key that never reaches the browser. The same deck opened
without a room code becomes a self-paced handout that resumes across devices.

**Stack:** Slidev (Markdown + Vue) → GitHub Actions → GitHub Pages, with
Supabase behind the polls. No server code.

## Quick start

```bash
nvm use 20        # Node 20+ required — see docs/SETUP.md § 0
npm ci
npm run dev
```

Then follow [`docs/SETUP.md`](docs/SETUP.md) for the Supabase project, and
[`docs/AUTH.md`](docs/AUTH.md) for Google sign-in, the roster and answer keys.

## Running a lecture

| Who | URL |
|---|---|
| You, presenting | `…/interactive-slides/?room=CS101` |
| Students | `…/interactive-slides/join/` → enter `CS101` |
| Anyone, self-paced | `…/interactive-slides/` |

Students see the whole deck on their phones, mirroring whichever slide you are
on, and answer polls in place. Tallies appear live on your screen.

## Layout

```
slides.md                 the deck — write lectures here
components/Poll.vue       poll widget (live + solo modes)
components/PollResults.vue  the tally bar chart
components/JoinInfo.vue   the "go here, enter this code" slide
components/RoomSync.vue   mirrors the presenter's slide to every follower
components/SignInGate.vue Google sign-in and the roster check
lib/client.ts             config + Supabase client
lib/auth.ts               session, enrolment, ownership
lib/poll.ts               rooms, votes, tallies, progress
scripts/admin.mjs         course, roster, answer keys, grade export
keys/                     answer keys - never bundled, never in the deck
roster/                   student lists, one CSV per course
public/join/index.html    code entry; redirects into the deck in follow mode
public/config.json        Supabase URL, anon key, course id
supabase/schema.sql       run once in the Supabase SQL editor
```

## Docs

| | |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Get it running; writing polls; scaling |
| [`docs/AUTH.md`](docs/AUTH.md) | Google sign-in, roster, answer keys, grades |
| [`docs/PRIVACY.md`](docs/PRIVACY.md) | What student data is held, and who can see it |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | What this has to do |
| [`docs/IDEA.md`](docs/IDEA.md) | Why Slidev over Google Slides; architecture; phases |

## Grading

Answers are attributable and graded server-side, so participation marks are
defensible. What it still does not do is prove attendance: a rostered student
who knows the room code can answer from anywhere. See
[`docs/AUTH.md` § What is still weak](docs/AUTH.md#what-is-still-weak).

Polls marked `anonymous` are stored with no student id at all, and the link is
unrecoverable by design — use them for confidence checks.
