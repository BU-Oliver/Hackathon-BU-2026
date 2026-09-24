/* Decision phase: PRISM (a fake assistant) messages you a policy nudge, you
 * pick an option, and the choice is graded against what actually happened in
 * the real industry. Returns a summary the payday screen uses.
 *
 * Deliberately NOT a chatbot — the messages are authored, so the tone is
 * consistent and every nudge is tied to a real policy decision.
 */

import {
  POLICIES, ADVICE, AXES, applyDecision, scoreOption, prismStance, describeWorld,
} from "./policy.js";

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function meterHtml(s) {
  return AXES.map((a) => {
    const v = Math.round(s[a.key]);
    // load is "lower is better", so colour it the other way round
    const good = a.good === "high" ? v : 100 - v;
    const cls = good > 66 ? "ok" : good > 33 ? "warn" : "bad";
    return `<div class="wmeter">
      <div class="wlabel"><span>${a.label}</span><b>${v}</b></div>
      <div class="wbar"><i class="${cls}" style="width:${v}%"></i></div>
    </div>`;
  }).join("");
}

export function runDecisions({ state, dayNo, onWorldChange }) {
  return new Promise((resolve) => {
    const wrap = $("#decision");
    const thread = $("#dec-thread");
    const optionsEl = $("#dec-options");
    const realityEl = $("#dec-reality");
    const nextBtn = $("#dec-next");
    const metersEl = $("#world-meters");

    $("#dec-day").textContent = `DAY ${dayNo} — operations review`;
    thread.innerHTML = "";
    optionsEl.innerHTML = "";
    realityEl.classList.add("hidden");
    nextBtn.classList.add("hidden");

    let world = { ...state };
    let followedNaive = 0;
    let followedSound = 0;
    let score = 0;
    const picks = [];
    const queue = [...POLICIES].sort(() => Math.random() - 0.5).slice(0, 2);
    let i = 0;

    const paintMeters = () => {
      metersEl.innerHTML = meterHtml(world);
      onWorldChange?.(world);
    };

    function bubble(who, text, cls = "") {
      const el = document.createElement("div");
      el.className = `msg ${who} ${cls}`;
      el.textContent = text;
      thread.appendChild(el);
      thread.scrollTop = thread.scrollHeight;
      return el;
    }

    async function typing() {
      const t = document.createElement("div");
      t.className = "typing";
      t.innerHTML = "<i></i><i></i><i></i>";
      thread.appendChild(t);
      thread.scrollTop = thread.scrollHeight;
      await wait(700);
      t.remove();
    }

    async function showPolicy() {
      const p = queue[i];
      const stance = prismStance(followedNaive, followedSound);
      optionsEl.innerHTML =
        `<div class="dec-q">${p.title}</div>` +
        `<p class="dec-brief">${p.brief}</p>` +
        `<div class="dec-ask">If the community got this, <b>${p.pick}%</b> of the 200 people we surveyed said it would make them more likely to accept a data centre.</div>`;

      await typing();
      bubble("bot", p.brief, "prism");
      await wait(350);
      await typing();
      bubble("bot", ADVICE[p.id]?.[stance] ?? "Proceeding with the recommended approach.", "prism");
      await wait(400);

      // the actual choices
      for (const opt of p.options) {
        const b = document.createElement("button");
        b.className = "opt";
        b.innerHTML = `<strong>${opt.label}</strong><span>${opt.sub}</span>`;
        b.addEventListener("click", () => choose(p, opt, stance, b));
        optionsEl.appendChild(b);
      }
    }

    function choose(p, opt, stance, btn) {
      for (const b of optionsEl.querySelectorAll(".opt")) {
        b.disabled = true;
        if (b === btn) b.classList.add("picked");
      }
      const s = scoreOption(opt);
      score += s;
      picks.push({ policy: p.title, label: opt.label, tone: s });
      if (opt.tone === 2) followedSound++;
      else if (opt.tone === 0) followedNaive++;

      world = applyDecision(world, opt);
      paintMeters();

      bubble("you", opt.label);
      bubble(
        "bot",
        s === 2
          ? "Logged. That lines up with where the industry is heading — good call."
          : s === 1
          ? "Logged. It's a trade-off, not a free win. Noted."
          : "Logged. No further comment.",
        "prism"
      );

      realityEl.classList.remove("hidden");
      realityEl.innerHTML =
        `<div class="reality-head">WHAT ACTUALLY HAPPENED</div>` +
        `<p>${opt.reality}</p>` +
        `<div class="verdict ${s === 2 ? "good" : s === 0 ? "bad" : ""}">${
          s === 2 ? "✓ Defensible" : s === 0 ? "✗ Costly in the long run" : "– Mixed"
        }</div>`;

      nextBtn.classList.remove("hidden");
      nextBtn.textContent = i < queue.length - 1 ? "NEXT DECISION →" : "SEE THE DAMAGE →";
    }

    nextBtn.onclick = () => {
      i += 1;
      realityEl.classList.add("hidden");
      if (i < queue.length) {
        showPolicy();
      } else {
        const notes = describeWorld(world);
        wrap.classList.add("hidden");
        resolve({ score, max: queue.length * 2, picks, state: world, notes });
      }
    };

    paintMeters();
    wrap.classList.remove("hidden");
    showPolicy();
  });
}
