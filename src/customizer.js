import * as THREE from "three";
import { createMii, PALETTE, DEFAULT_LOOK } from "./mii.js";

/* Start-of-game character creator.
 * All option lists + defaults come from mii.js (PALETTE / DEFAULT_LOOK) so the
 * character is defined in exactly one place.
 *
 * The preview model is rebuilt IN PLACE via userData.rebuild(), so clicking
 * options is instant and doesn't leak geometry.
 */

export { DEFAULT_LOOK };

export function initCustomizer({ initial = DEFAULT_LOOK, onConfirm }) {
  const state = { ...initial };
  // dev: ?look=hairStyle:bob,eyeStyle:happy  — preset options for visual checks
  const lookParam = new URLSearchParams(location.search).get("look");
  if (lookParam) {
    for (const pair of lookParam.split(",")) {
      const [k, v] = pair.split(":");
      if (k && v) state[k.trim()] = /^\d+$/.test(v.trim()) ? parseInt(v.trim(), 10) : v.trim();
    }
  }
  const overlay = document.querySelector("#customizer");
  overlay.classList.remove("hidden");

  /* --------------------------------------------------------- 3D preview */
  const canvas = document.querySelector("#cust-canvas");
  const PREVIEW_W = 300, PREVIEW_H = 360;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(PREVIEW_W, PREVIEW_H, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x9a8f7a, 1.45));
  const key = new THREE.DirectionalLight(0xfff3dc, 1.35);
  key.position.set(2.2, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfefff, 0.5);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, PREVIEW_W / PREVIEW_H, 0.1, 50);
  camera.position.set(0, 1.12, 3.3);
  camera.lookAt(0, 1.0, 0);

  const model = createMii(state);
  scene.add(model);

  let raf = 0;
  const clock = new THREE.Clock();
  (function spin() {
    raf = requestAnimationFrame(spin);
    const dt = Math.min(clock.getDelta(), 0.05);
    model.rotation.y += dt * 0.6;
    model.userData.update(dt, clock.elapsedTime, false);
    renderer.render(scene, camera);
  })();

  /* --------------------------------------------------------- option rows */
  const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

  function apply() {
    // pass the whole look through — rebuild() merges it into the model's own
    // copy. Calling rebuild() with no args silently keeps the previous look.
    model.userData.rebuild(state);
  }

  function swatchRow(elId, list, key) {
    const el = document.querySelector(elId);
    el.innerHTML = "";
    for (const [name, value] of list) {
      const b = document.createElement("button");
      b.className = "sw" + (state[key] === value ? " sel" : "");
      b.title = name;
      b.style.background = hex(value);
      b.setAttribute("aria-label", name);
      b.addEventListener("click", () => {
        state[key] = value;
        el.querySelectorAll(".sw").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel");
        apply();
      });
      el.appendChild(b);
    }
  }

  function pickRow(elId, list, key) {
    const el = document.querySelector(elId);
    el.innerHTML = "";
    for (const [value, label] of list) {
      const b = document.createElement("button");
      b.className = "pick" + (state[key] === value ? " sel" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        state[key] = value;
        el.querySelectorAll(".pick").forEach((x) => x.classList.remove("sel"));
        b.classList.add("sel");
        apply();
      });
      el.appendChild(b);
    }
  }

  swatchRow("#cg-skin", PALETTE.skin, "skin");
  pickRow("#cg-haircut", PALETTE.hairStyle, "hairStyle");
  swatchRow("#cg-haircol", PALETTE.hairColour, "hair");
  pickRow("#cg-face", PALETTE.faceShape, "faceShape");
  pickRow("#cg-eyes", PALETTE.eyeStyle, "eyeStyle");
  pickRow("#cg-brows", PALETTE.browStyle, "browStyle");
  pickRow("#cg-mouth", PALETTE.mouthStyle, "mouthStyle");
  swatchRow("#cg-shirt", PALETTE.shirt, "shirt");
  swatchRow("#cg-pants", PALETTE.pants, "pants");

  document.querySelector("#cust-done").addEventListener(
    "click",
    () => {
      cancelAnimationFrame(raf);
      overlay.classList.add("hidden");
      onConfirm({ ...state });
    },
    { once: true }
  );
}
