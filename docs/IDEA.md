# Interactive Slides — Idea Document

**Draft for review** · 2026-09-18 · Owner: hheickal

One deck source, two runtimes: driven by a presenter for a room of 50–500
learners, or opened solo and self-paced. Live polls, quizzes, and data widgets
embedded in the slides. Versioned in Git, auto-published on push.

---

## 1. Platform choice

The requirements conflict: R4 wants GUI authoring, R5 wants deck source in Git
with auto-deploy. R5 wins, because **Google Slides and PowerPoint have no
usable source form** — a `.gslides` is a cloud object, a `.pptx` is a binary
blob Git can't diff, and "deploy on push" has nothing to deploy.

| | Google Slides | PowerPoint | Web deck (Slidev) |
|---|---|---|---|
| Live polls (R1.1) | ⚠️ add-on only | ⚠️ add-in only | ✅ |
| Live widgets in-slide (R1.2) | ❌ **no iframe/HTML embed exists** | ⚠️ Web Viewer add-in, needs sideload/admin | ✅ it is a web page |
| Solo self-paced (R2.2) | ⚠️ tool-dependent | ❌ weak | ✅ same URL |
| One source, both modes (R2.3) | ⚠️ | ❌ | ✅ |
| Source in Git (R5.1) | ❌ | ❌ | ✅ |
| Auto-deploy (R5.2) | ❌ | ❌ | ✅ |
| Cost at 500 learners | paid seats | paid tier | ~$0 |

Four `Must` requirements score ❌ on the office tools. No workaround recovers
them.

**Recommendation: build on Slidev.** Markdown deck, Vue widget library, static
build to GitHub Pages, polls on a small serverless API. Keep **Pear Deck on
Google Slides** as the Phase-0 validation shortcut and the documented fallback.

R4 is paid down by keeping authoring in Markdown with drop-in widget tags, plus
hot-reload preview. Code stays confined to the widget library, built once:

```markdown
# Hash collisions

<Poll id="q-collide" type="mcq">
  <Option correct>Two inputs producing the same digest</Option>
  <Option>A digest longer than its input</Option>
</Poll>
```

---

## 2. Dual-mode design

The core decision. One deck, one URL, runtime chosen at load:

| | Presented (`?room=ABC123`) | Solo (default) |
|---|---|---|
| Advances slides | presenter | learner |
| Poll answers | aggregated in the room | `localStorage` |
| Slide shows | live bar chart of the room | instant right/wrong |
| Network | required | none — works offline |

Every widget implements both branches. That rule is what stops one deck from
quietly becoming two.

---

## 3. Widgets

**Tier 1 (any lesson needs these):** `<Poll type="mcq">`, `<Poll type="text">`
(word cloud), `<Confidence>` (1–5 "do you follow this?" — best teaching signal
per unit of effort), `<Quiz>`.

**Tier 2 (the reason for picking a web deck):** `<LiveChart>`, `<Simulator>`
(sliders → curve moves; impossible in Google Slides), `<CodeRunner>`,
`<Match>`, `<FillBlank>`.

**Tier 3 (polish):** `<Timer>`, `<QRJoin>`, `<Gate>`, `<ProgressBar>`.

---

## 4. Architecture

```
repo (slides/*.md, components/*.vue)
  └─push→ GitHub Actions ─slidev build→ GitHub Pages ─→ learners + presenter
                                                   └─→ Worker + KV (polls)
```

| Piece | Choice |
|---|---|
| Framework | Slidev (Vue 3, Vite) |
| Hosting | GitHub Pages |
| Poll backend | Cloudflare Worker + KV (~150 lines) |
| Solo persistence | `localStorage` — no accounts, no PII |
| CI | GitHub Actions |

**Short-poll, not websockets.** 500 concurrent sockets breaks every free tier
(Supabase ~200, Firebase 100, Ably/Pusher 100–200). But the traffic is
asymmetric: each learner POSTs **once per question**, and only the **single
presenter** GETs every 2s. A 60-min class, 500 learners, 20 questions =
10,000 writes + 1,800 reads ≈ **12k requests**, against Cloudflare's 100k/day
free tier. No connection cap, and it degrades gracefully on bad venue WiFi.

```
POST /api/room                 → { room }
POST /api/room/:room/response  { qid, answer } → 204
GET  /api/room/:room/results   → { tallies }
```

Rooms expire via KV TTL. Anonymous by construction — no FERPA/GDPR surface.

---

## 5. Phases

| Phase | Outcome |
|---|---|
| **0 Validate** | One real lesson via Google Slides + Pear Deck. Is the *teaching* right, before any code? |
| **1 Skeleton** | Slidev + Actions → Pages. Static lesson live at a URL. |
| **2 Solo widgets** | Tier 1, `localStorage` only. Complete self-paced course, **zero backend**. |
| **3 Live polls** | Worker + KV, room codes, QR join, presenter view. |
| **4 Data widgets** | Tier 2. |
| **5 Scale** | Tier 3, authoring guide, 500-learner load test. |

Phase 2 before Phase 3 on purpose: it ships a genuinely useful course with no
server at all.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Markdown authoring friction vs. R4 | Phase 1 ends with a hands-on authoring test. If it fails, fall back to Pear Deck and drop R5 knowingly. |
| **GitHub Pages is public; Pages from a private repo needs a paid plan** | Decide Q1 below. Cloudflare Pages serves private repos free. |
| 500 phones kill venue WiFi | Short-poll retries; widgets fall back to solo mode |
| Node 18 here, Slidev prefers 20+ | Upgrade before Phase 1 |
| Widget sprawl | Tier 1 only through Phase 2 |

---

## 7. Open questions

1. **Public or private course content?** Decides Pages vs. Cloudflare. **Blocks Phase 1.**
2. Real lesson available for Phase 0, or content written alongside tooling?
3. Cross-device resume needed? `localStorage` is per-browser; cross-device means accounts, which v1 excludes.
4. Results retained after class, or live-only? Changes the KV schema.
5. Custom domain, or is `hheickal.github.io/interactive_slides` fine?
6. Which data sources feed `<LiveChart>`? Affects CORS / Worker proxying.

---

## 8. Next actions

- [ ] Review and correct this doc
- [ ] Answer Q1 — blocks Phase 1
- [ ] Node 20 LTS
- [ ] Phase 1: scaffold Slidev, wire deploy, publish a static lesson
