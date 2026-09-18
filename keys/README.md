# Answer keys

Answer keys live here, **not** in `slides.md`, because anything in the deck is
visible in the page source — a student would just read the key out of devtools.

Nothing in this folder is imported by the deck, so none of it is bundled. The
keys reach the database through `npm run admin polls:sync keys/<file>.json`,
and grading happens inside a Postgres function that never returns the key.

Format, keyed by the poll's `id` in `slides.md`:

```json
{
  "q-collision": {
    "question": "optional, for your own reference",
    "correct": "exact text of the correct option",
    "anonymous": false
  }
}
```

- `correct` — omit for an opinion poll or confidence check. The answer is then
  recorded but not graded.
- `anonymous` — when true the answer is stored with no student id. Use it for
  anything where an honest answer matters more than attribution.

`correct` must match the option's text in `slides.md` exactly.
