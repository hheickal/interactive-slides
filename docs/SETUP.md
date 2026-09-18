# Setup

Three steps to a working live poll: create the backend, point the deck at it,
turn on Pages. About 15 minutes.

## 0. Node 20+

Slidev pulls in a dependency that needs `styleText` from `node:util`, added in
Node 20.12. **Node 18 cannot build this deck** — it fails with
`does not provide an export named 'styleText'`. CI already runs Node 20; only
local development needs the upgrade.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
exec $SHELL
nvm install 20 && nvm use 20
npm ci
```

## 1. Supabase project

1. Sign up at [supabase.com](https://supabase.com) and create a project (free tier).
2. Open **SQL Editor → New query**, paste all of
   [`supabase/schema.sql`](../supabase/schema.sql), run it. It is safe to re-run
   after pulling changes — slide-sync columns are added with
   `add column if not exists`.
3. Open **Project Settings → API** and copy the **Project URL** and the
   **`anon` `public`** key.

## 2. Point the deck at it

Edit [`public/config.json`](../public/config.json):

```json
{
  "supabaseUrl": "https://xxxxxxxx.supabase.co",
  "supabaseAnonKey": "eyJhbGci..."
}
```

Both the deck and the join page fetch this one file at runtime, so there is no
second place to keep in sync.

The `anon` key is **public by design** — Supabase ships it in every browser
bundle, and committing it to a public repo is normal. Row Level Security is the
actual boundary. Never put the `service_role` key here; that one is a real
secret and grants full database access.

## 3. GitHub Pages

Repo → **Settings → Pages → Source: GitHub Actions**. Push to `main` and the
workflow publishes to
`https://hheickal.github.io/interactive-slides/`.

---

## Running a lecture

| Who | URL | Sees |
|---|---|---|
| You, presenting | `…/interactive-slides/?room=CS101` | the deck, plus live tallies |
| Students | `…/interactive-slides/join/` then enter `CS101` | the whole deck, following your slide |
| Anyone, self-paced | `…/interactive-slides/` (no `?room=`) | the deck, answering at their own pace |

Students get the **entire deck**, not just the questions — their phone mirrors
whichever slide you are on, poll or not, and polls become tappable in place.
The join page is only a doorway: it turns a code into
`…/?room=CS101&follow=1`, which is the deck in follow mode.

A follower can still swipe around; the next slide you move to snaps them back,
and a small "following the presenter" badge says so.

**On a phone, slides render small.** A 16:9 slide inside a portrait screen is a
narrow band. Tell students to turn the phone sideways, and keep body text on
lecture slides large.

Pick any room code you like — there is no registration step. The room opens the
moment you load the deck with `?room=`, so students can join before you reach
the first question. Use a fresh code per lecture so tallies don't mix.

Every move you make is mirrored to followers, including click-throughs within a
slide. **Reveal answer** marks the correct option on your screen.

### Solo mode

Opened without `?room=`, the same deck becomes a self-study handout: students
click an option directly in the slide, get instant feedback, and their answers
persist in `localStorage`. **No backend is involved** — this works even if
Supabase is down or unconfigured.

---

## Writing a poll

```markdown
<Poll
  id="q-collision"
  question="What is a hash collision?"
  :options="[
    { text: 'Two different inputs producing the same digest', correct: true },
    { text: 'A digest longer than the input' },
  ]"
/>
```

`id` must be unique across the deck — it keys both the tally and the solo
answer. Mark at most one option `correct: true`; omit it entirely for an
opinion poll with no right answer.

**The correct answer is visible in the page source.** For participation polls
that is fine. Do not use this for anything graded.

---

## Scaling

Current design: every student holds one realtime connection to the room, so a
class of 100 uses ~101 of Supabase's **200-connection** free-tier limit.

Past roughly 180 students, that ceiling binds. The fix is not a bigger plan —
replace the follower subscription in
[`components/RoomSync.vue`](../components/RoomSync.vue) with a 2-second fetch of
the room row. Student traffic is tiny either way: one POST per question each,
plus a small polled read. Only the presenter genuinely needs a live feed, and
that is one connection no matter how big the class gets.

---

## Resetting a room

There is deliberately **no delete policy** — a cast vote is immutable, so
nothing the browser can do will erase results. That also means old rooms
accumulate. Clear one from the SQL editor when you want to reuse a code:

```sql
delete from rooms where code = 'CS101';   -- responses cascade
```

Easier habit: use a fresh code per lecture (`CS101-W3`) and never reset.

## Trust model

No accounts, no names, no emails — nothing here identifies a student, which
keeps the project clear of FERPA/GDPR obligations.

The cost is that nothing is authenticated. Anyone with the room code can vote,
and a determined student can vote twice from a second browser (the one-vote
rule is enforced per-browser via `localStorage`, not per-person). Fine for
participation and temperature checks. Not fine for grading.

**The anon key is in a public repo,** which is how Supabase is designed to
work — but it does mean anyone who finds this repo can insert rows. The blast
radius is bounded: they can add junk votes and rooms, they cannot read anything
private (there is nothing private), delete anything, or touch other projects.
If it ever becomes a nuisance, rotate the key in the Supabase dashboard and
update `public/config.json`.
