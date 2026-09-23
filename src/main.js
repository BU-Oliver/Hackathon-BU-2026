import "./style.css";
import { createWorld } from "./world.js";
import { initCustomizer, DEFAULT_LOOK } from "./customizer.js";
import { startDay, getTrust, puffBurst } from "./chat.js";

/* ------------------------------ question pool ----------------------------- */
const POOL = [
  {
    question: "be honest… how much electricity running datacenters here is actually renewable?",
    prefix: "The electricity running this datacenter is", suffix: "renewable.",
    trueValue: 68, tolerance: 6,
    vindicated: ["ok ok… receipts checked. ✅ you actually know the grid mix.", "fine. the wind farm telemetry backs you up."],
    liar: ["LIAR. 🤨 the meter says {true}% — not {guess}%. who sent you, gas lobby?", "LIAR!! I literally watch the turbines spin. it's {true}%, not {guess}%."],
  },
  {
    question: "quick one — what % of site power gets wasted just on cooling?",
    prefix: "Cooling wastes", suffix: "of site power.",
    trueValue: 32, tolerance: 6,
    vindicated: ["yep. chillers are thirsty beasts. ❄️", "correct — that's why the aisles feel like a fridge."],
    liar: ["LIAR. it's {true}% on cooling, not {guess}%. touch a hot aisle and try again.", "LIAR!! the BMS logs say {true}%. stop cooling the truth."],
  },
  {
    question: "and water? what % of our cooling water is recycled?",
    prefix: "We recycle", suffix: "of cooling water.",
    trueValue: 54, tolerance: 7,
    vindicated: ["damn, you read the sustainability report. 💧", "right — closed-loop for the win."],
    liar: ["LIAR. recycling is {true}%, not {guess}%. the steam outside is literally recycled.", "LIAR!! {true}% recycled. the cooling towers saw what you said."],
  },
  {
    question: "peak demand… what % of the campus load is just AI training racks?",
    prefix: "AI training eats", suffix: "of campus load.",
    trueValue: 41, tolerance: 6,
    vindicated: ["yeah… row D hums day and night. you got it.", "bingo. GPUs are hungry. 🤖"],
    liar: ["LIAR. AI racks pull {true}%, not {guess}%. listen to them hum.", "LIAR!! {true}% — go stand next to row D and feel it."],
  },
  {
    question: "last one. what % of our waste heat gets reused by the district?",
    prefix: "We reuse", suffix: "of waste heat.",
    trueValue: 23, tolerance: 6,
    vindicated: ["nailed it. the neighbourhood showers thank us. 🚿", "correct — heat network pipes don't lie."],
    liar: ["LIAR. heat reuse is {true}%, not {guess}%. the pipes are warm, your take is cold.", "LIAR!! it's {true}%. ask the houses across the road."],
  },
  {
    question: "on a windy day, what % of grid power is just wind?",
    prefix: "Wind covers", suffix: "of grid power.",
    trueValue: 47, tolerance: 7,
    vindicated: ["yep — when it blows, it blows. 🌬️", "correct. check the turbine app sometime."],
    liar: ["LIAR. wind is {true}%, not {guess}%. look out the window.", "LIAR!! {true}% — the blades don't lie."],
  },
  {
    question: "what % of retired servers get refurbished instead of scrapped?",
    prefix: "We refurbish", suffix: "of retired servers.",
    trueValue: 61, tolerance: 7,
    vindicated: ["correct — the refurb bench is always busy. 🔧", "yep. waste not."],
    liar: ["LIAR. refurb rate is {true}%, not {guess}%. visit the bench.", "LIAR!! {true}% — the screws remember."],
  },
  {
    question: "at night, what % of load is covered by battery storage?",
    prefix: "Batteries cover", suffix: "of night load.",
    trueValue: 18, tolerance: 6,
    vindicated: ["right — batteries only stretch so far. 🔋", "correct. the container hums till ~3am."],
    liar: ["LIAR. batteries cover {true}%, not {guess}%.", "LIAR!! {true}% — go hug the battery container."],
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
  doFlash();
  await wait(350);
  computer.classList.add("hidden");
  world.setVisible(true);
  world.setPaused(false);
  hud3d.classList.remove("hidden");
  inComputer = false;
  showPayday(res);
}

/* --------------------------------- payday --------------------------------- */
function showPayday(res) {
  const earned = BASE_PAY + res.correct * PER_CORRECT;
  const net = earned - DEDUCTION;
  balance += net;
  const bad = res.correct <= 1;
  if (bad) warnings += 1;
  // reset daily buffs; tips persist (already synced)
  shop = { tips: shop.tips, calibration: false, secondChance: false };

  const fired = warnings >= 2 || balance < -20;
  const lastDay = dayNo >= DAYS.length;

  $("#pay-title").textContent = `DAY ${dayNo} PAYCHECK`;
  $("#pay-rows").innerHTML =
    `<div class="prow"><span>Base pay</span><b>+£${BASE_PAY}</b></div>` +
    `<div class="prow"><span>Correct answers (${res.correct}/${res.total})</span><b>+£${res.correct * PER_CORRECT}</b></div>` +
    `<div class="prow"><span>Rent & noodles</span><b>−£${DEDUCTION}</b></div>` +
    `<div class="prow total"><span>Net</span><b>${net >= 0 ? "+" : ""}£${net}</b></div>` +
    `<div class="prow"><span>Balance</span><b>£${balance}</b></div>` +
    `<div class="prow"><span>Trust</span><b>${getTrust()}</b></div>` +
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

// dev: ?ui=chat drops straight into the computer UI
if (DEV.get("ui") === "chat") enterComputer();
