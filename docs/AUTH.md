# Student authentication

Students sign in with Google, must appear on the course roster, and their
answers are graded server-side against a key their browser never receives.

This replaces the anonymous v1 model. Read [`PRIVACY.md`](PRIVACY.md) before
running a real class — you are now holding student data.

---

## How it fits together

```
 student ──Google sign-in──► Supabase Auth
     │
     │  taps an option
     ▼
 submit_answer(course, room, qid, answer)      ← the only way an answer gets in
     │
     ├─ is the caller on this course's roster?   no → rejected
     ├─ grade against polls.correct_answer       ← never leaves the database
     ├─ anonymous poll?  store with no user_id
     └─ return { is_correct }                    ← the verdict, not the key
```

`responses` has **no insert policy**. Nothing can write an answer except that
function, so the roster check and the grading cannot be bypassed by calling the
REST API directly.

Answer keys live in [`keys/`](../keys/), which the deck never imports, so they
are not in the bundle. `slides.md` carries questions and options only.

---

## One-time setup

### 1. Google OAuth credentials

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):

1. **Create credentials → OAuth client ID → Web application.**
2. Authorised redirect URI — copy this from Supabase (**Authentication →
   Providers → Google**); it looks like
   `https://<project>.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client secret**.

In Supabase → **Authentication → Providers → Google**: enable it, paste both,
save.

In Supabase → **Authentication → URL Configuration**, add your deck to
**Redirect URLs**:

```
https://hheickal.github.io/interactive-slides/**
http://localhost:3030/**
```

Without the wildcard the OAuth round trip loses your `?room=` and `&follow=1`.

### 2. Schema

SQL Editor → New query → paste all of
[`supabase/schema.sql`](../supabase/schema.sql) → Run. Safe to re-run over v1.

It drops the v1 blanket-anon policies, so **the deck stops working for
anonymous users at this point** — finish the rest before your next lecture.

### 3. Admin credentials

```bash
cp .env.example .env
```

Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings →
API). The service-role key bypasses RLS completely: it is gitignored, belongs
only on your machine, and must never reach `public/config.json`.

### 4. Create the course

Sign in to the deck once with your own Google account first, so Supabase has a
user record for you. Then:

```bash
npm run admin course:create CS101 "Intro to Hashing" you@uni.edu
```

This writes `courseId` into `public/config.json`. **Commit it** — the deck
needs it to know which roster and key set apply.

### 5. Upload the roster

```bash
npm run admin roster:sync roster/cs101.csv
```

CSV columns are `email,name`; a header row is ignored. The email must be the
one the student signs in to Google with. Syncing adds and updates — it never
removes, so deleting a student is a manual `delete from roster`.

### 6. Upload the answer keys

```bash
npm run admin polls:sync keys/lecture-01.json
```

Re-run this whenever a key changes. Format is documented in
[`keys/README.md`](../keys/README.md).

---

## Running a lecture

Unchanged, except that everyone signs in first.

| Who | URL |
|---|---|
| You | `…/interactive-slides/?room=LEC1` |
| Students | `…/interactive-slides/join/` → enter `LEC1` |

You are the course owner, so you are let in without being on the roster. A
student who is signed in but not rostered gets a clear "not on the roster"
screen naming the account they used — the common failure is a personal Gmail
instead of the university address.

**Budget a minute for first sign-in.** After that the session persists, so the
same student rejoining next week taps through instantly.

---

## Anonymous polls

Add `anonymous` to the poll in `slides.md` and set `"anonymous": true` in the
key file:

```markdown
<Poll id="q-confidence" question="How well are you following?" anonymous
  :options="[{ text: 'Comfortable' }, { text: 'Lost' }]" />
```

The answer is stored with **no** `user_id`. The one-vote rule still holds,
through an `anon_votes` table that records *that* a student voted without
recording *what* they voted for — and that table has RLS enabled with no policy
at all, so nobody can query it. The link does not exist anywhere reachable.

Use this for confidence checks. An identified confidence check measures
willingness to admit confusion, not confusion.

---

## Grades

```bash
npm run admin scores:export scores.csv
```

Columns: `email, qid, answer, is_correct, answered_at`. Anonymous polls are
excluded, having no student to attribute to. `scores.csv` is gitignored.

There is also a `scores` view for per-student totals, which RLS scopes
automatically: a student querying it sees only their own row, you see the class.

---

## Self-paced mode

A signed-in student opening the deck without `?room=` answers into `progress`,
keyed to their user id, so they resume on any device. Graded the same way,
through the same function.

A deck with no `courseId` still works completely offline with inline
`correct: true` keys in `slides.md` — useful for a public practice deck, and
unsuitable for anything graded, since the key is in the page source.

---

## What is still weak

- **A rostered student can answer from anywhere.** Nothing proves attendance;
  a student who is not in the room can still vote if they know the code. Room
  codes are short and guessable — treat participation as participation, not as
  proctored assessment.
- **A student sees their own grade rows.** That is deliberate, but it means
  `is_correct` is visible to them the moment they answer.
- **No lateness rule.** Answers are accepted for as long as the room exists.
