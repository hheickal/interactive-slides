# Interactive Slides

One deck source, two runtimes: presenter-driven for a room of 50–500 learners,
or opened solo and self-paced. Live polls, quizzes, and data widgets embedded
in the slides. Versioned in Git, auto-published on push.

**Status:** planning. No deck code yet — see the phase table in
[`docs/IDEA.md`](docs/IDEA.md#5-phases).

## Docs

| | |
|---|---|
| [`docs/REQUIREMENTS.md`](docs/REQUIREMENTS.md) | What this has to do, and what it deliberately won't |
| [`docs/IDEA.md`](docs/IDEA.md) | Platform comparison, recommendation, architecture, phases, risks |

## Planned stack

Slidev (Markdown + Vue) → GitHub Actions → GitHub Pages, with a Cloudflare
Worker + KV behind the live polls.

## Open decision

Course content public or private? It picks the host (GitHub Pages vs.
Cloudflare Pages) and blocks Phase 1. See
[`docs/IDEA.md` § 7](docs/IDEA.md#7-open-questions).
