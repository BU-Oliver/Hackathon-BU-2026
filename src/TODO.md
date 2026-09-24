# TODO

## Bugs

### Slider can't express the real answers — CRITICAL
The chat slider is hard-coded `min=0 max=100` (`index.html`) and `chat.js`
hard-codes `%` in nine places (draft bubble, tolerance label, tip range,
verdict pill, and the `0%/100%` end labels).

The question pool now mixes units, so most questions are unanswerable:

| Question | True value | Slider |
| --- | --- | --- |
| Irish grid carbon intensity | 224 gCO₂/kWh | max 100 — impossible |
| DC share of national electricity | 22% | ok |
| Sector consumption 2015 | 1,240 GWh | max 100 — impossible |
| SEAI 2030 forecast | 12,832 GWh | max 100 — impossible |
| Reduction on 1990 intensity | 75% | ok |
| Growth since 2015 | 6× | displays as "100×" |
| Sector heading for | 23% | ok |

Produces `TRUE VALUE 12832% — you said 100%`.

**Fix:** give every question its own `min` / `max` / `step` / `unit` in the
`POOL` in `main.js`, and drive the slider + labels from it in `chat.js`
instead of assuming 0–100 percent. Suggested shape:

```js
{ id, question, prefix, suffix, trueValue, tolerance,
  min: 0, max: 100, step: 1, unit: "%" }
```

Then in `chat.js`, per round:
- `slider.min = r.min; slider.max = r.max; slider.step = r.step`
- update the two end labels (`0%` / `100%` are hard-coded in the HTML)
- `draftValue.textContent = r.step < 1 ? value.toFixed(1) : value + r.unit`
- verdict pill uses `r.unit` instead of a literal `%`
- the tip helper should use `r.unit` too
- start the slider at the midpoint, not a hard-coded `50`

### Verdict pill overflows
`.verdict` is `align-self: center` with no max-width, so long strings
(`TRUE VALUE 12832% — you said 100%`) run the full width and look broken.
Needs `max-width: 85%` and to wrap the value onto its own line, e.g.
`✓ TRUE VALUE 12,832 GWh` / `you said 100 GWh`.

### One invented figure in the pool
> "what did this campus cost the grid last year?" — 766 GWh

Not in the dataset. 7,663 GWh is the **national** 2025 figure (CSO);
766 is me assuming ~10 campuses. Either delete the question or relabel it
explicitly as a scenario figure, otherwise the game is citing a number the
research doesn't support. `data/EXTRACTED-STATS.md` is the source of truth.

### The acceptance meter has no teeth
`acceptance` can fall to 0 and the payday still only counts chat accuracy
(`res.correct <= 1`) for warnings. The survey's real finding is that 22.3%
of the public are *already* opposed — losing the community should be a
firing offence independent of quiz scores.

Suggested: `acceptance < 20` for a full day → warning; `acceptance <= 0`
→ fired regardless of payday. Add it to `showPayday()` in `main.js`.

---

## Content

- **Duplicate brief** — PRISM sends the policy brief as a chat bubble *and*
  the same text renders in the options panel. Pick one; probably keep the
  bubble and shorten the panel copy to just the question.
- **Near-identical questions** — "what share of all Ireland's electricity"
  (22%) and "where is the sector heading" (23%) test the same number a day
  apart. Differentiate or drop one.
- **Derived figures need labelling** — the 6× growth and the 25% reduction
  are calculated from the series, not quoted. Fine, but say so in the
  evidence line.
- **Decisions are sampled 2 from 7** so most policies never appear in a
  3-day run. Consider rotating a fixed sequence so the arc is designed.

## UI

- **Decision panel can overflow** — 3 options + reality card + button inside
  `.card.wide` exceeds the viewport on shorter screens. The options column
  needs its own scroll or the card needs to shrink.
- **Payday meter block** — the four world numbers print as plain rows with
  no colour, so a critical 18/100 looks the same as a healthy 86/100. Reuse
  the `.wbar` styling from the decision panel.
- **`describeWorld` notes** — all notes get concatenated into one
  `<p class="warnline">`. Three notes = an unreadable red wall. Make it a
  list.
- **Small screens** — `.dec-layout` stacks, but the thread is capped at
  26vh and the options below it may push the confirm button off-screen.

## Housekeeping

- Dev flags are still in `main.js` / `world.js` / `customizer.js`:
  `?skipCustom=1`, `&phase=office`, `&ui=chat`, `&ui=decisions`,
  `&noflash=1`, `&at=x,z`, `&world=env,water,reliability,load`,
  `?look=hairStyle:bob,eyeStyle:happy`. Keep them (they're genuinely useful)
  or strip them before presenting.
- `data/Segregated media review with references.docx` is committed but
  unused by the game. Decide whether it belongs in the repo.
- README still describes the pre-policy loop — needs the decision phase,
  the PRISM app and the acceptance meter added.
- `src/mii.js` still exports `WALK` and `HAIR` tables that the world no
  longer reads; dead config that will drift.

---

# Ideas

Terrain changes depending on choices
less true / fact
questions determine the outcome

Messaging replacement with ai chat (fake obviously) that gives you ideas (some good some bad) based off the data
e.g "We should use less renewable energy! It's slow and not enough. We should set it down." or "We should probably use some more renewable energy! It'll be good for the enviornment! Think of the next generation"

these choices given affect the data center and the world arround you. Compares your choices to the real world.
E.g Enviornment degrades / repairs, data center goes on fire, water drains all around etc etc
