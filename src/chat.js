/* Chat shift: runs one workday of message rounds inside the computer UI.
 * Owns trust + steam effects; main.js owns wallet/days/shop.
 * startDay(rounds, mods) resolves { correct, total } when done. */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl, r, guess) => tpl.replaceAll("{true}", r.trueValue).replaceAll("{guess}", guess);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let trust = 50;
let streak = 0;

const chat = document.querySelector("#chat");
const composer = document.querySelector("#composer");
const slider = document.querySelector("#slider");
const draftValue = document.querySelector("#draft-value");
const draftPrefix = document.querySelector("#draft-prefix");
const draftSuffix = document.querySelector("#draft-suffix");
const tolLabel = document.querySelector("#tol-label");
const sendBtn = document.querySelector("#send");
const tipBtn = document.querySelector("#use-tip");
const roundLabel = document.querySelector("#round-label");
const trustEl = document.querySelector("#m-trust");

slider.addEventListener("input", () => (draftValue.textContent = `${slider.value}%`));

function scrollDown() {
  chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
}
function botBubble(text) {
  const el = document.createElement("div");
  el.className = "msg bot";
  el.innerHTML = `<span class="who-line">MARA · AISLE C</span>`;
  el.append(document.createTextNode(text));
  chat.appendChild(el);
  scrollDown();
  return el;
}
function youBubble(text) {
  const el = document.createElement("div");
  el.className = "msg you";
  el.innerHTML = `<span class="who-line">YOU</span>`;
  el.append(document.createTextNode(text));
  chat.appendChild(el);
  scrollDown();
  return el;
}
function verdictPill(text, good) {
  const el = document.createElement("div");
  el.className = `verdict ${good ? "good" : "bad"}`;
  el.textContent = text;
  chat.appendChild(el);
  scrollDown();
}
function typing() {
  const el = document.createElement("div");
  el.className = "typing";
  el.innerHTML = "<i></i><i></i><i></i>";
  chat.appendChild(el);
  scrollDown();
  return el;
}
async function maraSays(text, thinkMs = 950) {
  const t = typing();
  await wait(thinkMs);
  t.remove();
  botBubble(text);
  await wait(450);
}

/* ------------------------- steam (Canvas 2D, cheap) ------------------------ */
const canvas = document.querySelector("#steam");
const ctx = canvas.getContext("2d");
let puffs = [];
let W = 0, H = 0;
function resize() {
  W = canvas.width = innerWidth;
  H = canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();
function spawn(n, good = null) {
  for (let i = 0; i < n; i++) {
    puffs.push({
      x: Math.random() * W,
      y: H * (0.55 + Math.random() * 0.45),
      r: 20 + Math.random() * 54,
      vy: -(0.25 + Math.random() * 0.6),
      vx: (Math.random() - 0.5) * 0.3,
      life: 1,
      decay: 0.0018 + Math.random() * 0.0032,
      tint: good === true ? "30,158,106" : good === false ? "190,120,100" : "150,140,120",
    });
  }
  if (puffs.length > 90) puffs = puffs.slice(-90);
}
export function puffBurst(good) {
  spawn(good ? 26 : 18, good);
}
(function tick() {
  ctx.clearRect(0, 0, W, H);
  if (puffs.length < 14 && Math.random() < 0.12) spawn(1);
  for (const p of puffs) {
    p.x += p.vx + Math.sin(p.y * 0.01) * 0.3;
    p.y += p.vy;
    p.life -= p.decay;
    p.r += 0.12;
    if (p.life <= 0 || p.y < -120) continue;
    const a = Math.max(0, p.life) * 0.04;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    g.addColorStop(0, `rgba(${p.tint},${a})`);
    g.addColorStop(1, `rgba(${p.tint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  puffs = puffs.filter((p) => p.life > 0 && p.y > -130);
  requestAnimationFrame(tick);
})();
spawn(12);

/* live fake telemetry */
const pueEl = document.querySelector("#m-pue");
const loadEl = document.querySelector("#m-load");
const tempEl = document.querySelector("#m-temp");
setInterval(() => {
  pueEl.textContent = (1.38 + Math.random() * 0.08).toFixed(2);
  loadEl.textContent = `${(37.4 + Math.random() * 2.2).toFixed(1)} MW`;
  tempEl.textContent = `${(23.6 + Math.random() * 1.2).toFixed(1)}°C`;
}, 1800);

/* --------------------------------- day run -------------------------------- */
let day = null; // active day context or null

export function getTrust() {
  return trust;
}

export function resetChatUI() {
  chat.innerHTML = "";
  composer.classList.add("hidden");
}

export async function greeted() {
  trustEl.textContent = trust;
  await maraSays("psst. new hire? i'm mara — I run aisle C. 🌬️", 700);
  await maraSays(
    "management keeps posting headlines about us. tell me what YOU think is true… and don't lie to me.",
    1100
  );
}
let greetedDone = false;

export function startDay(rounds, mods, dayNo) {
  return new Promise((resolve) => {
    day = {
      rounds,
      mods, // { tips, calibration, secondChance, secondChanceUsed }
      dayNo,
      i: 0,
      correct: 0,
      tipUsedThisRound: false,
      resolve,
    };
    resetChatUI();
    if (!greetedDone) {
      greetedDone = true;
      greeted().then(() => nextRound());
    } else {
      maraSays(`day ${dayNo} — fresh headlines just dropped. no lying.`, 800).then(() => nextRound());
    }
  });
}

async function nextRound() {
  if (!day) return;
  const r = day.rounds[day.i];
  const tol = r.tolerance + (day.mods.calibration ? 4 : 0);
  roundLabel.textContent = `DAY ${day.dayNo} · ${day.i + 1} / ${day.rounds.length}`;
  tolLabel.textContent = `±${tol}%${day.mods.calibration ? " (calibrated)" : ""}`;
  draftPrefix.textContent = r.prefix;
  draftSuffix.textContent = r.suffix;
  day.tipUsedThisRound = false;

  await maraSays(r.question);
  if (!day) return; // day could have ended meanwhile (defensive)

  slider.value = 50;
  draftValue.textContent = "50%";
  updateTipBtn();
  composer.classList.remove("hidden");
  sendBtn.disabled = false;
  scrollDown();
}

function updateTipBtn() {
  if (!day) return;
  const n = day.mods.tips;
  tipBtn.textContent = `💡 USE TIP (${n} left)`;
  tipBtn.style.display = n > 0 && !day.tipUsedThisRound ? "" : "none";
}

tipBtn.addEventListener("click", async () => {
  if (!day || day.mods.tips <= 0 || day.tipUsedThisRound) return;
  day.mods.tips -= 1;
  day.tipUsedThisRound = true;
  updateTipBtn();
  const r = day.rounds[day.i];
  const lo = Math.max(0, r.trueValue - 10);
  const hi = Math.min(100, r.trueValue + 10);
  tipBtn.style.display = "none";
  await maraSays(`fine… insider tip: it's somewhere between ${lo}% and ${hi}%. don't waste this. 💡`, 900);
});

sendBtn.addEventListener("click", async () => {
  if (!day || sendBtn.disabled) return;
  const d = day;
  const r = d.rounds[d.i];
  const tol = r.tolerance + (d.mods.calibration ? 4 : 0);
  const guess = Number(slider.value);
  const text = `${r.prefix} ${guess}% ${r.suffix}`;
  sendBtn.disabled = true;
  tipBtn.style.display = "none";
  composer.classList.add("hidden");

  const bubble = youBubble(text);
  await wait(650);

  const good = Math.abs(guess - r.trueValue) <= tol;
  if (good) {
    bubble.classList.add("flash-good");
    streak += 1;
    trust = Math.min(100, trust + 12 + Math.min(streak * 2, 8));
    verdictPill(`✓ TRUE VALUE ${r.trueValue}% — within ±${tol}`, true);
    puffBurst(true);
  } else if (d.mods.secondChance && !d.mods.secondChanceUsed) {
    // mulligan: Mara gives one retry, consumes the buff, round doesn't advance
    d.mods.secondChanceUsed = true;
    bubble.classList.add("flash-bad", "shake");
    verdictPill(`✗ TRUE VALUE ${r.trueValue}% — you said ${guess}%`, false);
    puffBurst(false);
    trustEl.textContent = trust;
    await wait(900);
    await maraSays("…ugh. you look new. ONE mulligan — answer again, and mean it.", 1000);
    if (day !== d) return;
    slider.value = 50;
    draftValue.textContent = "50%";
    updateTipBtn();
    composer.classList.remove("hidden");
    sendBtn.disabled = false;
    return;
  } else {
    bubble.classList.add("flash-bad", "shake");
    streak = 0;
    trust = Math.max(0, trust - 18);
    verdictPill(`✗ TRUE VALUE ${r.trueValue}% — you said ${guess}%`, false);
    puffBurst(false);
  }
  trustEl.textContent = trust;
  await wait(1100);

  if (good) await maraSays(pick(r.vindicated), 800);
  else await maraSays(fill(pick(r.liar), r, guess), 1100);
  if (day !== d) return;

  d.i += 1;
  if (good) d.correct += 1;
  if (d.i < d.rounds.length) {
    nextRound();
  } else {
    const res = { correct: d.correct, total: d.rounds.length };
    day = null;
    composer.classList.add("hidden");
    await maraSays("shift complete — logging you off. see payroll. 💤", 800);
    d.resolve(res);
  }
});
