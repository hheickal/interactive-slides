# Requirements

Captured 2026-09-18. Source: interview with project owner.

## R1 — Interactivity

| ID | Requirement | Priority |
|----|-------------|----------|
| R1.1 | Live polls and quizzes. Audience answers on their own device; results aggregate and render on the slide in real time. | Must |
| R1.2 | Embedded live data and widgets. Charts fed by real data, calculators, parameter simulators running inside the slide. | Must |
| R1.3 | Step reveals / animations | Nice to have |
| R1.4 | Branching, non-linear navigation | Nice to have |

## R2 — Audience and delivery modes

| ID | Requirement | Priority |
|----|-------------|----------|
| R2.1 | **Presented mode.** Presenter drives the deck; a room of learners follows and participates from their phones. | Must |
| R2.2 | **Solo mode.** A learner opens a link alone and works through the same deck self-paced, with no presenter and no room. | Must |
| R2.3 | One deck source serves both modes. No forked content. | Must |
| R2.4 | Concurrent audience: 50–500. | Must |

## R3 — Content domain

Teaching / training course material. Implies knowledge checks, progress
tracking, per-module gating, and repeat delivery of the same deck to
different cohorts.

## R4 — Authoring ergonomics

Owner prefers GUI / low-config authoring and wants to avoid heavy build
tooling. This conflicts with R1.2 and R5 (see `IDEA.md` § Conflict). The
chosen design must keep day-to-day slide authoring close to plain text or
a form, with code confined to a reusable widget library.

## R5 — Repository and deployment

| ID | Requirement | Priority |
|----|-------------|----------|
| R5.1 | Everything lives in a GitHub repo: docs, specs, deck source, widget code. | Must |
| R5.2 | Auto-deploy. Push to `main` publishes the deck. | Must |
| R5.3 | Deck reachable by URL for solo learners. | Must |

## Non-requirements (explicitly out of scope for v1)

- Learner accounts, login, or identity. Participation is anonymous.
- Grading, certificates, LMS grade passback.
- Authoring UI for non-technical third parties.
- Offline / air-gapped delivery.

## Open questions

See `IDEA.md` § Open questions.
