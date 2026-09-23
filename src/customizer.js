import * as THREE from "three";
import { createMii } from "./mii.js";

/* Start-of-game character creator. Row-based Mii studio with a live
 * rotating 3D preview; confirm → options go straight into world.js. */

export const DEFAULT_LOOK = {
  skin: 0x7b4c2d,
  hairStyle: "bowl",
  hair: 0x4a2c14,
  faceShape: "round",
  eyeStyle: "oval",
  browStyle: "classic",
  mouthStyle: "flat",
  shirt: 0xd6503c,
  pants: 0x333945,
};

const SKINS = [
  ["Porcelain", 0xf5cfa5], ["Sand", 0xe8b88a], ["Honey", 0xc98e5f],
  ["Bronze", 0x9a6238], ["Umber", 0x7b4c2d], ["Espresso", 0x4e2f1c],
];
const HAIR_COLOURS = [
  ["Black", 0x1c1a18], ["Brown", 0x4a2c14], ["Auburn", 0x7a3a16],
  ["Blond", 0xc99a3c], ["Ginger", 0xb34a2e], ["Grey", 0x9a9a9a],
];
const SHIRTS = [
  ["Red", 0xd6503c], ["Blue", 0x2e7dc9], ["Green", 0x1e9e6a],
  ["Purple", 0x7a4fc9], ["Gold", 0xe8a33c], ["Cream", 0xe8e2d4], ["Ink", 0x333945],
];
const PANTS = [
  ["Slate", 0x333945], ["Black", 0x23242a], ["Denim", 0x4a6076],
  ["Khaki", 0x9a7f4e], ["Olive", 0x5a5e33],
];
const HAIRCUTS = [
  ["bowl", "Bowl"], ["spiky", "Spiky"], ["bob", "Bob"], ["afro", "Afro"],
  ["buzz", "Buzz"], ["ponytail", "Pony"], ["bald", "Bald"],
];
const FACES = [["round", "Round"], ["slim", "Slim"], ["wide", "Wide"]];
const EYES = [["oval", "Classic"], ["dot", "Dots"], ["happy", "Happy"], ["sleepy", "Sleepy"]];
const BROWS = [["classic", "Classic"], ["angry", "Angry"], ["soft", "Soft"]];
const MOUTHS = [["flat", "Flat"], ["smile", "Smile"], ["open", "Open"]];

const hex = (n) => `#${n.toString(16).padStart(6, "0")}`;

export function initCustomizer({ initial = DEFAULT_LOOK, onConfirm }) {
  const state = { ...initial };
  const overlay = document.querySelector("#customizer");
  overlay.classList.remove("hidden");

  /* ---------- live 3D preview ---------- */
  const canvas = document.querySelector("#cust-canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(240, 280, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x9a8f7a, 1.45));
  const key = new THREE.DirectionalLight(0xfff3dc, 1.35);
  key.position.set(2.2, 4, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfefff, 0.5);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const camera = new THREE.PerspectiveCamera(34, 240 / 280, 0.1, 50);
  camera.position.set(0, 1.15, 3.35);
  camera.lookAt(0, 1.0, 0);

  let model = null;
  function disposeModel() {
    if (!model) return;
    model.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    scene.remove(model);
  }
  function rebuild() {
    disposeModel();
    model = createMii(state);
    scene.add(model);
  }
  rebuild();

  let raf = 0;
  const clock = new THREE.Clock();
  (function spin() {
    raf = requestAnimationFrame(spin);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (model) {
      model.rotation.y += dt * 0.6;
      model.userData.update(dt, clock.elapsedTime, false);
    }
    renderer.render(scene, camera);
  })();

  /* ---------- option rows ---------- */
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
        rebuild();
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
        rebuild();
      });
      el.appendChild(b);
    }
  }

  swatchRow("#cg-skin", SKINS, "skin");
  pickRow("#cg-haircut", HAIRCUTS, "hairStyle");
  swatchRow("#cg-haircol", HAIR_COLOURS, "hair");
  pickRow("#cg-face", FACES, "faceShape");
  pickRow("#cg-eyes", EYES, "eyeStyle");
  pickRow("#cg-brows", BROWS, "browStyle");
  pickRow("#cg-mouth", MOUTHS, "mouthStyle");
  swatchRow("#cg-shirt", SHIRTS, "shirt");
  swatchRow("#cg-pants", PANTS, "pants");

  document.querySelector("#cust-done").addEventListener(
    "click",
    () => {
      cancelAnimationFrame(raf);
      disposeModel();
      renderer.dispose();
      overlay.classList.add("hidden");
      onConfirm({ ...state });
    },
    { once: true }
  );
}
