import * as THREE from "three";
import "./style.css";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07110e);
scene.fog = new THREE.Fog(0x07110e, 12, 42);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.7, 7);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
document.querySelector("#game").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9fd8bb, 0x13231c, 1.7));
const key = new THREE.DirectionalLight(0xb8ffd2, 2.2);
key.position.set(5, 9, 4);
key.castShadow = true;
scene.add(key);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(70, 70),
  new THREE.MeshStandardMaterial({ color: 0x0c1814, roughness: 0.92 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(70, 70, 0x18352a, 0x10231b);
grid.position.y = 0.01;
scene.add(grid);

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: .65 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

// Stylised data-centre buildings.
for (let i = -2; i <= 2; i++) {
  box(4.2, 3.6, 5, 0x172720, i * 5.4, 1.8, -5);
  for (let row = 0; row < 3; row++) {
    box(0.16, 0.16, 4.2, 0x8be9b1, i * 5.4 - 1.2 + row * 1.2, 2.2, -2.42);
  }
}

// Wind turbines: deliberately simple so the template has no external assets.
function turbine(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(.09, .15, 3.8, 12),
    new THREE.MeshStandardMaterial({ color: 0xc4d9d0 })
  );
  pole.position.set(x, 1.9, z);
  scene.add(pole);
  const hub = new THREE.Group();
  hub.position.set(x, 3.8, z);
  scene.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(.12, 1.4, .08),
      new THREE.MeshStandardMaterial({ color: 0x8be9b1 })
    );
    blade.position.y = .65;
    blade.rotation.z = i * Math.PI * 2 / 3;
    hub.add(blade);
  }
  hub.userData.spin = true;
  return hub;
}
const turbines = [turbine(-11, -10), turbine(12, -12), turbine(9, 2)];

const terminal = new THREE.Group();
terminal.position.set(0, 0, 1);
terminal.add(box(.02, .02, .02, 0x000000, 0, 0, 0)); // placeholder removed visually
const body = new THREE.Mesh(
  new THREE.BoxGeometry(1.6, 1.25, .75),
  new THREE.MeshStandardMaterial({ color: 0x1c2b25, roughness: .45 })
);
body.position.y = .8;
body.castShadow = true;
terminal.add(body);
const screen = new THREE.Mesh(
  new THREE.BoxGeometry(1.28, .72, .06),
  new THREE.MeshStandardMaterial({ color: 0x07110e, emissive: 0x174d35, emissiveIntensity: .8 })
);
screen.position.set(0, 1.08, -.4);
terminal.add(screen);
scene.add(terminal);

function makeNpc() {
  const npc = new THREE.Group();
  npc.position.set(-3.8, 0, 3.2);
  const coat = new THREE.Mesh(
    new THREE.CylinderGeometry(.48, .62, 1.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x28332f })
  );
  coat.position.y = .82;
  npc.add(coat);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.38, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x111714 })
  );
  head.position.y = 1.75;
  npc.add(head);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(.5, .5),
    new THREE.MeshBasicMaterial({ color: 0x020403 })
  );
  face.position.set(0, 1.75, -.34);
  npc.add(face);
  npc.userData.target = new THREE.Vector3(0, 0, 1);
  return npc;
}
const npc = makeNpc();
scene.add(npc);

const headlines = [
  {
    text: "Datacenters in Ireland do not use enough renewable energy.",
    truePercent: 72,
    evidence: "The facility's electricity mix is 72% renewable in this fictional scenario. The nearby wind farms are supplying a substantial share of demand."
  },
  {
    text: "The server campus is powered entirely by fossil fuels.",
    truePercent: 31,
    evidence: "Only 31% of the electricity mix is fossil generation in this fictional scenario; the remainder comes from renewable sources."
  },
  {
    text: "Wind generation provides less than a quarter of the site's electricity.",
    truePercent: 64,
    evidence: "Wind is the dominant renewable source here, contributing to a 64% renewable electricity share in this fictional scenario."
  }
];

let current = 0;
let terminalOpen = false;
let gameLocked = false;

const ui = document.querySelector("#terminal-ui");
const headlineEl = document.querySelector("#headline");
const slider = document.querySelector("#renewable-slider");
const guess = document.querySelector("#guess");
const result = document.querySelector("#result");
const submit = document.querySelector("#submit");
const next = document.querySelector("#next");

function loadHeadline() {
  headlineEl.textContent = headlines[current].text;
  slider.value = 50;
  guess.textContent = "50%";
  result.textContent = "";
  submit.classList.remove("hidden");
  next.classList.add("hidden");
}
loadHeadline();

slider.addEventListener("input", () => guess.textContent = slider.value + "%");

submit.addEventListener("click", () => {
  const actual = headlines[current].truePercent;
  const chosen = Number(slider.value);
  const delta = Math.abs(chosen - actual);
  const verdict = delta <= 5 ? "Close call." : chosen < actual ? "You underestimated the renewable share." : "You overestimated the renewable share.";
  result.innerHTML = `<strong>TRUE VALUE: ${actual}% renewable</strong><br>${verdict} Your estimate was ${chosen}%.<br><br>${headlines[current].evidence}`;
  submit.classList.add("hidden");
  next.classList.remove("hidden");
});

next.addEventListener("click", () => {
  current = (current + 1) % headlines.length;
  loadHeadline();
});

function openTerminal() {
  terminalOpen = true;
  gameLocked = true;
  ui.classList.remove("hidden");
}
function closeTerminal() {
  terminalOpen = false;
  gameLocked = false;
  ui.classList.add("hidden");
}
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyE" && !terminalOpen) openTerminal();
  if (e.code === "Escape" && terminalOpen) closeTerminal();
});

// Minimal first-person movement.
const keys = {};
addEventListener("keydown", e => keys[e.code] = true);
addEventListener("keyup", e => keys[e.code] = false);

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .05);

  turbines.forEach(t => t.rotation.z += dt * 1.8);

  npc.lookAt(camera.position.x, npc.position.y + 1.2, camera.position.z);
  const dx = camera.position.x - npc.position.x;
  const dz = camera.position.z - npc.position.z;
  if (!gameLocked && Math.hypot(dx, dz) < 5) {
    // The NPC walks to the terminal, not the player.
    const target = npc.userData.target;
    const distance = npc.position.distanceTo(target);
    if (distance > 1.4) {
      npc.position.lerp(target, Math.min(1, dt * .5));
    } else {
      npc.lookAt(0, 1.2, 1);
    }
  }

  if (!gameLocked) {
    const speed = 4 * dt;
    if (keys.KeyW) camera.translateZ(-speed);
    if (keys.KeyS) camera.translateZ(speed);
    if (keys.KeyA) camera.translateX(-speed);
    if (keys.KeyD) camera.translateX(speed);
    camera.position.y = 1.7;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -18, 18);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -17, 17);

    if (camera.position.distanceTo(new THREE.Vector3(0, 1.7, 1)) < 2.5 && keys.KeyE) {
      openTerminal();
    }
  }

  renderer.render(scene, camera);
}
animate();

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
