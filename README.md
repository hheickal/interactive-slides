# Interactive Slides

Lecture slides with live polls. Students answer from their phones; the tally
renders on the slide as it comes in. The same deck opened without a room code
becomes a self-paced handout that works with no backend at all.

**Stack:** Slidev (Markdown + Vue) → GitHub Actions → GitHub Pages, with
Supabase behind the polls. No server code.

## Quick start

```bash
nvm use 20        # Node 20+ required — see docs/SETUP.md § 0
npm ci
npm run dev
```

Then follow [`docs/SETUP.md`](docs/SETUP.md) to create the Supabase project and
fill in `public/config.js`.

## Running a lecture

| Who | URL |
|---|---|
| You, presenting | `…/interactive-slides/?room=CS101` |
| Students | `…/interactive-slides/join/` → enter `CS101` |
| Anyone, self-paced | `…/interactive-slides/` |

Advancing to a poll slide pushes that question to every joined phone.

## Layout

```
slides.md                 the deck — write lectures here
components/Poll.vue       poll widget (live + solo modes)
components/PollResults.vue  the tally bar chart
components/JoinInfo.vue   the "go here, enter this code" slide
lib/poll.ts               Supabase / localStorage plumbing
public/join/index.html    what students open on their phones
public/config.js          your Supabase URL + anon key
supabase/schema.sql       run once in the Supabase SQL editor
```

## Docs

| | |
|---|---|
| [`docs/SETUP.md`](docs/SETUP.md) | Get it running; writing polls; scaling; trust model |
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | What this has to do |
| [`docs/IDEA.md`](docs/IDEA.md) | Why Slidev over Google Slides; architecture; phases |

## Not for grading

Polls are anonymous and unauthenticated, and correct answers are visible in the
page source. This is built for participation and temperature checks. See
[`docs/SETUP.md` § Trust model](docs/SETUP.md#trust-model).
