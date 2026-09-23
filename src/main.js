import "./style.css";

/* ---------------------------------- data ---------------------------------- */

const ROUNDS = [
  {
    question: "be honest… how much electricity running datacenters here is actually renewable?",
    prefix: "The electricity running this datacenter is",
    suffix: "renewable.",
    trueValue: 68,
    tolerance: 6,
    vindicated: [
      "ok ok… receipts checked. ✅ you actually know the grid mix.",
      "fine. the wind farm telemetry backs you up.",
    ],
    liar: [
      "LIAR. 🤨 the meter says {true}% — not {guess}%. who sent you, gas lobby?",
      "LIAR!! I literally watch the turbines spin. it's {true}%, not {guess}%.",
    ],
  },
  {
    question: "quick one — what % of site power gets wasted just on cooling?",
    prefix: "Cooling wastes",
    suffix: "of site power.",
    trueValue: 32,
    tolerance: 6,
    vindicated: ["yep. chillers are thirsty beasts. ❄️", "correct — that's why the aisles feel like a fridge."],
    liar: [
      "LIAR. it's {true}% on cooling, not {guess}%. touch a hot aisle and try again.",
      "LIAR!! the BMS logs say {true}%. stop cooling the truth.",
    ],
  },
  {
    question: "and water? what % of our cooling water is recycled?",
    prefix: "We recycle",
    suffix: "of cooling water.",
    trueValue: 54,
    tolerance: 7,
    vindicated: ["damn, you read the sustainability report. 💧", "right — closed-loop for the win."],
    liar: [
      "LIAR. recycling is {true}%, not {guess}%. the steam outside is literally recycled.",
      "LIAR!! {true}% recycled. the cooling towers saw what you said.",
    ],
  },
  {
    question: "peak demand… what % of the campus load is just AI training racks?",
    prefix: "AI training eats",
    suffix: "of campus load.",
    trueValue: 41,
    tolerance: 6,
    vindicated: ["yeah… row D hums day and night. you got it.", "bingo. GPUs are hungry. 🤖"],
    liar: [
      "LIAR. AI racks pull {true}%, not {guess}%. listen to them hum.",
      "LIAR!! {true}% — go stand next to row D and feel it.",
    ],
  },
  {
    question: "last one. what % of our waste heat gets reused by the district?",
    prefix: "We reuse",
    suffix: "of waste heat.",
    trueValue: 23,
    tolerance: 6,
    vindicated: ["nailed it. the neighbourhood showers thank us. 🚿", "correct — heat network pipes don't lie."],
    liar: [
      "LIAR. heat reuse is {true}%, not {guess}%. the pipes are warm, your take is cold.",
      "LIAR!! it's {true}%. ask the houses across the road.",
    ],
  },
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl, r, guess) => tpl.replaceAll("{true}", r.trueValue).replaceAll("{guess}", guess);

/* --------------------------------- state ---------------------------------- */

let roundIndex = 0;
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
const roundLabel = document.querySelector("#round-label");
const gameoverBox = document.querySelector("#gameover");
const trustEl = document.querySelector("#m-trust");

slider.addEventListener("input", () => (draftValue.textContent = `${slider.value}%`));
document.querySelector("#restart").addEventListener("click", () => location.reload());

/* ------------------------------ chat helpers ------------------------------ */

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

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function maraSays(text, thinkMs = 950) {
  const t = typing();
  await wait(thinkMs);
  t.remove();
  botBubble(text);
  await wait(450);
}

/* -------------------------------- game flow ------------------------------- */

async function playRound() {
  const r = ROUNDS[roundIndex];
  roundLabel.textContent = `${roundIndex + 1} / ${ROUNDS.length}`;
  tolLabel.textContent = `±${r.tolerance}%`;
  draftPrefix.textContent = r.prefix;
  draftSuffix.textContent = r.suffix;

  await maraSays(r.question);

  // show composer as "your draft reply"
  slider.value = 50;
  draftValue.textContent = "50%";
  composer.classList.remove("hidden");
  sendBtn.disabled = false;
  scrollDown();
}

sendBtn.addEventListener("click", async () => {
  const r = ROUNDS[roundIndex];
  const guess = Number(slider.value);
  const text = `${r.prefix} ${guess}% ${r.suffix}`;
  sendBtn.disabled = true;
  composer.classList.add("hidden");

  const bubble = youBubble(text);
  await wait(650);

  const good = Math.abs(guess - r.trueValue) <= r.tolerance;
  if (good) {
    bubble.classList.add("flash-good");
    streak += 1;
    trust = Math.min(100, trust + 12 + Math.min(streak * 2, 8));
    verdictPill(`✓ TRUE VALUE ${r.trueValue}% — within ±${r.tolerance}`, true);
    puffBurst(true);
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

  roundIndex += 1;
  if (roundIndex < ROUNDS.length) {
    playRound();
  } else {
    endGame();
  }
});

async function endGame() {
  const grade =
    trust >= 80 ? "GRID WHISPERER 🏆" : trust >= 55 ? "CREDIBLE OPERATOR ✔" : trust >= 30 ? "SUSPECTED SPIN DOCTOR ⚠" : "CERTIFIED LIAR 🚨";
  gameoverBox.classList.remove("hidden");
  gameoverBox.innerHTML = `<h2>${grade}</h2><p>Final trust: <b>${trust}</b> / 100 across ${ROUNDS.length} claims.<br>Mara has logged your answers in the shift report.</p><button id="again">PLAY AGAIN</button>`;
  document.querySelector("#again").addEventListener("click", () => location.reload());
  scrollDown();
}

/* --------------------------- live fake telemetry --------------------------- */

const pueEl = document.querySelector("#m-pue");
const loadEl = document.querySelector("#m-load");
const tempEl = document.querySelector("#m-temp");
setInterval(() => {
  pueEl.textContent = (1.38 + Math.random() * 0.08).toFixed(2);
  loadEl.textContent = `${(37.4 + Math.random() * 2.2).toFixed(1)} MW`;
  tempEl.textContent = `${(23.6 + Math.random() * 1.2).toFixed(1)}°C`;
}, 1800);

/* ------------------------- cream steam (Canvas 2D) ------------------------- */
/* Zero-dependency particle vapour: cheap, 60fps, no WebGL needed. */

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
      r: 24 + Math.random() * 70,
      vy: -(0.25 + Math.random() * 0.6),
      vx: (Math.random() - 0.5) * 0.3,
      life: 1,
      decay: 0.0016 + Math.random() * 0.003,
      // green-tinted vapour on success, warm grey-red on fail, neutral otherwise
      tint: good === true ? "30,158,106" : good === false ? "190,120,100" : "150,140,120",
    });
  }
  if (puffs.length > 220) puffs = puffs.slice(-220);
}

function puffBurst(good) {
  spawn(good ? 26 : 18, good);
}

function tick() {
  ctx.clearRect(0, 0, W, H);
  if (puffs.length < 60 && Math.random() < 0.25) spawn(1);
  for (const p of puffs) {
    p.x += p.vx + Math.sin(p.y * 0.01) * 0.3;
    p.y += p.vy;
    p.life -= p.decay;
    p.r += 0.12;
    if (p.life <= 0 || p.y < -120) continue;
    const a = Math.max(0, p.life) * 0.10;
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
}
spawn(50);
tick();

/* ---------------------------------- boot ----------------------------------- */

(async function boot() {
  trustEl.textContent = trust;
  await wait(400);
  await maraSays("psst. new shift? i'm mara — I run aisle C. 🌬️", 700);
  await maraSays("management keeps posting headlines about us. tell me what YOU think is true… and don't lie to me.", 1100);
  playRound();
})();
