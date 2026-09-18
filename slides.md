---
theme: default
title: Interactive Slides — Demo Lecture
info: Demo lecture showing live polls with a visualized tally.
class: text-center
transition: slide-left
mdc: true
---

# Interactive Slides

A demo lecture with live polls

<div class="pt-8 opacity-60 text-sm">

Press <kbd>space</kbd> to advance · add `?room=CS101` to the URL to present live

</div>

---
layout: center
---

# Join the poll

<JoinInfo />

---

# Why hashing?

A hash function maps arbitrary input to a fixed-size digest.

- Same input, always the same digest
- Tiny change in input, completely different digest
- You cannot run it backwards

The interesting failure is when two *different* inputs land on the same digest.

---
layout: center
---

<Poll
  id="q-collision"
  question="What is a hash collision?"
  :options="[
    { text: 'Two different inputs producing the same digest' },
    { text: 'A digest longer than the input' },
    { text: 'A hash function that runs too slowly' },
    { text: 'Two hash functions with the same name' },
  ]"
/>

---

# Why collisions are unavoidable

The input space is infinite. The output space is fixed — SHA-256 has
2<sup>256</sup> possible digests.

Infinite inputs, finite outputs, so some inputs must share. The pigeonhole
principle guarantees it.

The design goal is not *avoiding* collisions. It is making them
**infeasible to find on purpose**.

---
layout: center
---

<Poll
  id="q-birthday"
  question="Roughly how many random digests before a 50% chance of a collision, for an n-bit hash?"
  :options="[
    { text: 'About 2^(n/2)' },
    { text: 'About 2^n' },
    { text: 'About n^2' },
    { text: 'About n / 2' },
  ]"
/>

---
layout: center
---

<Poll
  id="q-confidence"
  question="How well are you following so far?"
  anonymous
  :options="[
    { text: 'Comfortable' },
    { text: 'Mostly, with gaps' },
    { text: 'Lost' },
  ]"
/>

---
layout: center
---

# Recap

Collisions are guaranteed, findable in ~2<sup>n/2</sup> tries,
and that square root is why 128-bit hashes are retired.

<div class="pt-8 opacity-60 text-sm">

Want to review alone? Open this deck without `?room=` — every poll
gives instant feedback, and a signed-in student picks up where they
left off on any device.

</div>
