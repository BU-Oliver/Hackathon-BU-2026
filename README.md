# Grid Truth — datacenter chat game

An Irish-set indie game about working a shift at a datacenter. You walk a
3D campus, sit at your desk, and answer a colleague's questions about the
facility. Get the numbers right and you get paid. Lie and you get fired.

## The loop

1. **Customise** your Mii-style character (skin, hair, face, eyes, brows, mouth, outfit).
2. **Walk in** — a 3D Irish campus: the datacenter halls, car park, village,
   lake, sheep, wind turbines and pylons.
3. **Shop** before you clock in (tips, calibrated meter, second chance).
4. **Work the chat** — three headlines a day. Set X on the slider and send.
   Correct flashes green, wrong flashes red and Mara calls you a liar.
5. **Payday** — base pay + £20 per correct answer − £45 rent.
6. Survive three days. Two bad shifts, or debt, and you're fired.

## Run locally

```bash
npm install
npm run dev
```

Then open the local Vite URL.

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | All screens: HUD, computer chat, customizer, shop, payday |
| `src/main.js` | Game state machine: days, wallet, shop, payday, firing |
| `src/world.js` | Three.js campus + office interior, movement, interaction |
| `src/mii.js` | Customisable Mii character builder + walk/idle animation |
| `src/customizer.js` | Character creator with a live rotating 3D preview |
| `src/chat.js` | The chat shift: bubbles, verdicts, hints, steam |
| `src/style.css` | Cream UI, chat bubbles, overlays, vignette |

## Tuning

Day length, pay and prices live at the top of `src/main.js`:

```js
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY"];
const ROUNDS_PER_DAY = 3;
const BASE_PAY = 50, PER_CORRECT = 20, DEDUCTION = 45;
const PRICES = { tip: 25, calibration: 35, secondChance: 30 };
```

Question pool (fictional figures) is the `POOL` array in `src/main.js` —
replace with verified sources before making real-world claims.

## Dev flags

Append to the URL to jump straight to a state while working on visuals:

- `?skipCustom=1` — skip the character creator
- `&phase=office` — start inside the office
- `&ui=chat` — jump straight into the computer chat
- `&noflash=1` — disable the screen-transition flash

## Notes

Asset-free: every model, texture and sign is generated in code
(canvas textures, primitives, Lambert materials). One directional shadow
map, capped pixel ratio, and the 3D scene pauses entirely while you are
in the chat or a menu.
