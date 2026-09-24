import "./style.css";
import { createWorld } from "./world.js";
import { initCustomizer, DEFAULT_LOOK } from "./customizer.js";
import { runDecisions } from "./advisor.js";
import { START_STATE } from "./policy.js";
import { startDay, getTrust, puffBurst } from "./chat.js";

/* ------------------------------ question pool -----------------------------
 * Answers are real Irish figures from the CSO / EirGrid / SEAI series in
 * data/BCP Data.xlsx. See data/EXTRACTED-STATS.md for the full tables. */
const POOL = [
  {
    question: "Ireland's grid is getting cleaner fast. What is its carbon intensity now?",
    prefix: "The Irish grid runs at", suffix: "gCO2 per kWh.",
    trueValue: 224, tolerance: 12,
    vindicated: [
      "EirGrid's number. It was 896 in 1990 — we have taken 75% off it.",
      "Correct. Everyone assumes it's dirtier than it is.",
    ],
    liar: [
      "LIAR. it's {true}g, not {guess}g. that's EirGrid's 2024 figure.",
      "LIAR!! {true}g. Check the KPI sheet like everyone else.",
    ],
  },
  {
    question: "what share of ALL of Ireland's electricity did data centres eat last year?",
    prefix: "Data centres took", suffix: "of Ireland's electricity.",
    trueValue: 22, tolerance: 3,
    vindicated: [
      "22%. CSO put us at 6,973 GWh out of 31,903.",
      "Yeah. A fifth of the country's grid.",
    ],
    liar: [
      "LIAR. it's {true}%, not {guess}%. CSO, last year.",
      "LIAR!! {true}% of national electricity. Look it up.",
    ],
  },
  {
    question: "ten years ago we were tiny. what did the whole sector pull in 2015?",
    prefix: "In 2015 the sector used", suffix: "GWh.",
    trueValue: 1240, tolerance: 180,
    vindicated: [
      "1,240 GWh. 5% of the grid. Look how far we have come.",
      "Correct — and it was not always this noisy.",
    ],
    liar: [
      "LIAR. 2015 was {true} GWh, not {guess}. CSO series.",
      "LIAR!! {true} GWh. That's the baseline.",
    ],
  },
  {
    question: "SEAI has a forecast. what does it put the sector at in 2030?",
    prefix: "By 2030 SEAI forecasts", suffix: "GWh.",
    trueValue: 12832, tolerance: 1400,
    vindicated: [
      "12,832. Nearly double 2024. The connection queue is the real problem.",
      "Correct. That is why grid capacity matters.",
    ],
    liar: [
      "LIAR. forecast is {true} GWh, not {guess}. Read the SEAI sheet.",
      "LIAR!! {true} GWh by 2030. It's right there.",
    ],
  },
  {
    question: "grid intensity keeps falling. how far below 1990 are we now?",
    prefix: "We are down", suffix: "% on 1990's intensity.",
    trueValue: 75, tolerance: 5,
    vindicated: [
      "75%. 896 down to 224. That's the real story.",
      "Correct — the grid did the heavy lifting.",
    ],
    liar: [
      "LIAR. it's {true}%, not {guess}%. 896 to 224.",
      "LIAR!! {true}% off 1990. Do the subtraction.",
    ],
  },
  {
    question: "and the growth rate. how much has sector demand multiplied since 2015?",
    prefix: "Demand is up", suffix: "x on 2015.",
    trueValue: 6, tolerance: 1,
    vindicated: [
      "About 6x. 1,240 to 7,663. National demand barely moved.",
      "Correct. Six times the load, same grid.",
    ],
    liar: [
      "LIAR. it's {true}x, not {guess}x. Do the division.",
      "LIAR!! {true}x since 2015.",
    ],
  },
  {
    question: "newer survey, newer numbers. what share is the sector heading towards?",
    prefix: "We are heading for", suffix: "of national electricity.",
    trueValue: 23, tolerance: 3,
    vindicated: [
      "23% last year. That's the sector, not just us.",
      "Right. We are past a fifth of the grid.",
    ],
    liar: [
      "LIAR. it's {true}%, not {guess}%. CSO 2025.",
      "LIAR!! {true}%. Where do you think that came from?",
    ],
  },
  {
    question: "AI training racks — what share of campus load is just the GPU hall?",
    prefix: "AI training eats", suffix: "of campus load.",
    trueValue: 41, tolerance: 6,
    vindicated: [
      "41%. Row D hums day and night. You got it.",
      "Correct — the old models assumed servers, not GPUs.",
    ],
    liar: [
      "LIAR. it's {true}%, not {guess}%. Walk to row D and listen.",
      "LIAR!! {true}%. Go feel the hot aisle.",
    ],
  },
];

/* --------------------------------- economy -------------------------------- */
const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY"];
const ROUNDS_PER_DAY = 3;
const BASE_PAY = 50, PER_CORRECT = 20, DEDUCTION = 45;
const PRICES = { tip: 25, calibration: 35, secondChance: 30 };

let dayNo = 1;           // 1-based
let balance = 40;
let warnings = 0;
let totalCorrect = 0, totalAsked = 0;
let shop = { tips: 0, calibration: false, secondChance: false }; // for the upcoming day
let inComputer = false;
let worldState = { ...START_STATE };

const $ = (s) => document.querySelector(s);
const sceneEl = $("#scene"), hud3d = $("#hud3d"), promptEl = $("#prompt"),
  promptText = $("#prompt-text"), interactBtn = $("#interact-btn"),
  dayPill = $("#day-pill"), balTop = $("#bal-top"), warnTop = $("#warn-top"),
  dayBanner = $("#day-banner"), flash = $("#flash"),
  computer = $("#computer"), shopEl = $("#shop"), paydayEl = $("#payday"), firedEl = $("#fired");

function refreshHud() {
  dayPill.textContent = `DAY ${dayNo} · ${DAYS[dayNo - 1]}`;
  balTop.textContent = balance;
  warnTop.textContent = warnings ? ` · ⚠${warnings}/2` : "";
  $("#bal-shop").textContent = balance;
}
function banner(text, ms = 1600) {
  dayBanner.textContent = text;
  dayBanner.classList.remove("hidden");
  dayBanner.classList.remove("show");
  void dayBanner.offsetWidth;
  dayBanner.classList.add("show");
  clearTimeout(banner._t);
  banner._t = setTimeout(() => dayBanner.classList.add("hidden"), ms);
}
function doFlash() {
  if (new URLSearchParams(location.search).has("noflash")) return;
  flash.classList.remove("go");
  void flash.offsetWidth;
  flash.classList.add("go");
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------- world --------------------------------- */
const world = createWorld(sceneEl, {
  onPrompt: (near) => {
    if (!near || inComputer || !shopEl.classList.contains("hidden") ||
        !paydayEl.classList.contains("hidden") || !firedEl.classList.contains("hidden")) {
      promptEl.classList.add("hidden");
      return;
    }
    promptText.textContent = near.label;
    interactBtn.textContent = "E";
    promptEl.classList.remove("hidden");
  },
  onInteract: (id) => {
    if (inComputer) return;
    if (id === "door") {
      world.setPhase("office");
      banner("Find your desk — follow the orange marker");
      puffBurst(true);
    } else if (id === "desk") {
      openShop();
    }
  },
});
interactBtn.addEventListener("click", () => world.tryInteract());
world.setDayTint(1);
world.setWorldState(worldState);
refreshHud();

// Character creator runs before day 1: world stays frozen behind it,
// then the chosen look is applied to the walker and the shift begins.
// Dev flags (for visual checks): ?skipCustom=1 &phase=office &ui=chat
const DEV = new URLSearchParams(location.search);
world.setPaused(true);
if (DEV.has("skipCustom")) {
  world.setPlayerOptions(DEFAULT_LOOK);
  world.setPaused(false);
  if (DEV.get("phase") === "office") world.setPhase("office");
} else {
  initCustomizer({
    initial: DEFAULT_LOOK,
    onConfirm: (look) => {
      world.setPlayerOptions(look);
      world.setPaused(false);
      banner("Walk to the glowing door to start work");
    },
  });
}

/* ---------------------------------- shop ---------------------------------- */
function renderShop() {
  $("#own-tip").textContent = `Owned: ${shop.tips} (use in chat via 💡 button)`;
  $("#own-cal").textContent = shop.calibration ? "Owned ✓ (+4% tolerance today)" : "Not owned";
  $("#own-sec").textContent = shop.secondChance ? "Owned ✓ (one mulligan today)" : "Not owned";
  for (const [key, btn] of [["tip", "#buy-tip"], ["calibration", "#buy-cal"], ["secondChance", "#buy-sec"]]) {
    const b = $(btn);
    const owned = key === "tip" ? false : shop[key];
    b.disabled = owned || balance < PRICES[key];
    b.textContent = owned ? "OWNED" : `BUY £${PRICES[key]}`;
  }
  refreshHud();
}
function buy(key) {
  if (balance < PRICES[key]) return;
  if (key !== "tip" && shop[key]) return;
  balance -= PRICES[key];
  if (key === "tip") shop.tips += 1;
  else shop[key] = true;
  renderShop();
}
$("#buy-tip").addEventListener("click", () => buy("tip"));
$("#buy-cal").addEventListener("click", () => buy("calibration"));
$("#buy-sec").addEventListener("click", () => buy("secondChance"));

function openShop() {
  world.setPaused(true);
  renderShop();
  $("#shop-day").textContent = `DAY ${dayNo} · ${DAYS[dayNo - 1]} — buy before you clock in`;
  shopEl.classList.remove("hidden");
}

$("#clockin").addEventListener("click", async () => {
  shopEl.classList.add("hidden");
  await enterComputer();
});

/* -------------------------------- computer -------------------------------- */
async function enterComputer() {
  inComputer = true;
  doFlash();
  await wait(350);
  world.setPaused(true);
  world.setVisible(false);
  hud3d.classList.add("hidden");
  promptEl.classList.add("hidden");
  computer.classList.remove("hidden");

  const rounds = [...POOL].sort(() => Math.random() - 0.5).slice(0, ROUNDS_PER_DAY);
  const mods = {
    tips: shop.tips,
    calibration: shop.calibration,
    secondChance: shop.secondChance,
    secondChanceUsed: false,
  };
  const res = await startDay(rounds, mods, dayNo);
  shop.tips = mods.tips; // persist unused tips
  await exitComputer(res);
}

async function exitComputer(res) {
  totalCorrect += res.correct;
  totalAsked += res.total;

  // policy phase — PRISM messages you, you decide, the world reacts.
  // Put the campus back on screen BEFORE the policy phase so the player
  // watches the world react to each decision rather than reading about it.
  computer.classList.add("hidden");
  world.setVisible(true);
  world.setPaused(false);
  inComputer = false;
  promptEl.classList.add("hidden");

  const decisions = await runDecisions({
    state: worldState,
    dayNo,
    onWorldChange: (s) => {
      worldState = s;
      world.setWorldState(s);
    },
  });

  hud3d.classList.remove("hidden");
  showPayday(res, decisions);
}

/* --------------------------------- payday --------------------------------- */
const DECISION_BONUS = 18; // per full "defensible" point

function showPayday(res, decisions) {
  const decBonus = (decisions?.score ?? 0) * DECISION_BONUS;
  const earned = BASE_PAY + res.correct * PER_CORRECT + decBonus;
  const net = earned - DEDUCTION;
  balance += net;
  const bad = res.correct <= 1;
  if (bad) warnings += 1;
  // reset daily buffs; tips persist (already synced)
  shop = { tips: shop.tips, calibration: false, secondChance: false };

  const fired = warnings >= 2 || balance < -20;
  const lastDay = dayNo >= DAYS.length;
  const ws = worldState;
  const collab = () => {
    const q = (v) => `<div class="prow"><span>${v}</span><b>${ws[v]}</b></div>`;
    return q("environment") + q("water") + q("reliability") + q("load");
  };

  $("#pay-title").textContent = `DAY ${dayNo} PAYCHECK`;
  $("#pay-rows").innerHTML =
    `<div class="prow"><span>Base pay</span><b>+£${BASE_PAY}</b></div>` +
    `<div class="prow"><span>Correct answers (${res.correct}/${res.total})</span><b>+£${res.correct * PER_CORRECT}</b></div>` +
    `<div class="prow"><span>Operational decisions (${decisions?.score ?? 0}/${decisions?.max ?? 0})</span><b>+£${decBonus}</b></div>` +
    `<div class="prow"><span>Rent & noodles</span><b>−£${DEDUCTION}</b></div>` +
    `<div class="prow total"><span>Net</span><b>${net >= 0 ? "+" : ""}£${net}</b></div>` +
    `<div class="prow"><span>Balance</span><b>£${balance}</b></div>` +
    `<div class="prow"><span>Trust</span><b>${getTrust()}</b></div>` +
    `<div class="prow-sub">THE CAMPUS &amp; THE LAND</div>` +
    collab() +
    (decisions?.notes?.length
      ? `<p class="warnline">${decisions.notes.join(" ")}</p>`
      : `<p class="niceline">The site and the valley around it are holding up. ✅</p>`) +
    (bad ? `<p class="warnline">⚠ Bad shift (${res.correct}/${res.total} right). Warning ${warnings}/2 — two strikes and you're fired.</p>`
         : `<p class="niceline">Solid shift. Mara vouched for you. ✅</p>`);
  const nextBtn = $("#next-day");
  if (fired) {
    nextBtn.textContent = "FACE THE CONSEQUENCES →";
  } else if (lastDay) {
    nextBtn.textContent = "FINISH CONTRACT →";
  } else {
    nextBtn.textContent = `START DAY ${dayNo + 1} →`;
  }
  nextBtn.onclick = () => {
    paydayEl.classList.add("hidden");
    if (fired) return showFired(false);
    if (lastDay) return showFired(true);
    dayNo += 1;
    world.setDayTint(dayNo);
    world.setPhase("street");
    refreshHud();
    banner(`DAY ${dayNo} · ${DAYS[dayNo - 1]} — walk in again`);
  };
  paydayEl.classList.remove("hidden");
  refreshHud();
}

/* ------------------------------- fired / win ------------------------------ */
function showFired(finished) {
  world.setPaused(true);
  const won = finished && warnings < 2 && balance >= -20;
  $("#fired-title").textContent = won ? "CONTRACT COMPLETE 🎉" : "YOU'RE FIRED 🚨";
  $("#fired-body").innerHTML = won
    ? `3 days survived. Score: <b>${totalCorrect}/${totalAsked}</b> correct.<br>Final balance: <b>£${balance}</b> · Trust: <b>${getTrust()}</b><br>Mara recommends you for floor manager.`
    : (balance < -20
      ? `Debt collectors (and Mara) found you.<br>Balance: <b>£${balance}</b> · Score: <b>${totalCorrect}/${totalAsked}</b>.`
      : `Two bad shifts. Security escorted you past the turbines.<br>Score: <b>${totalCorrect}/${totalAsked}</b> · Balance: <b>£${balance}</b>.`);
  firedEl.classList.remove("hidden");
}
$("#again").addEventListener("click", () => location.reload());
$("#restart").addEventListener("click", () => location.reload());

// dev: ?at=x,z teleports the player (visual checks)
if (DEV.has("at")) {
  const [x, z] = DEV.get("at").split(",").map(Number);
  if (Number.isFinite(x) && Number.isFinite(z)) world.teleport(x, z);
}

// dev: ?ui=chat drops straight into the computer UI
if (DEV.get("ui") === "chat") enterComputer();
// dev: ?ui=decisions jumps straight to the policy phase (world stays visible)
if (DEV.get("ui") === "decisions") {
  world.setVisible(true);
  world.setPaused(false);
  hud3d.classList.add("hidden");
  runDecisions({
    state: worldState,
    dayNo,
    onWorldChange: (s) => {
      worldState = s;
      world.setWorldState(s);
    },
  });
}
// dev: ?world=env,water,reliability,load forces a world state
if (DEV.has("world")) {
  const [e, w, r, l] = DEV.get("world").split(",").map(Number);
  worldState = {
    environment: e ?? worldState.environment,
    water: w ?? worldState.water,
    reliability: r ?? worldState.reliability,
    load: l ?? worldState.load,
  };
  world.setWorldState(worldState);
}
