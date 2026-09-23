import * as THREE from "three";
import { createMii } from "./mii.js";

/* Lightweight office/street world. One scene, two zones (street + office),
 * cheap materials, no shadows, pixelRatio capped — keeps the 3D part fast
 * so it only handles "outside the computer" (walk in, walk to desk). */

const TINTS = [0xf3ead8, 0xf7f0dd, 0xefdfc8];

export function createWorld(container, opts = {}) {
  const onPrompt = opts.onPrompt || (() => {});
  const onInteract = opts.onInteract || (() => {});

  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1));
  renderer.setSize(innerWidth, innerHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(TINTS[0]);
  scene.fog = new THREE.Fog(TINTS[0], 18, 46);

  scene.add(new THREE.HemisphereLight(0xfff6e3, 0x8a7f6f, 1.15));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.1);
  sun.position.set(6, 10, 6);
  scene.add(sun);

  const lam = (color, emissive = 0x000000, ei = 0) =>
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
  const basic = (color) => new THREE.MeshBasicMaterial({ color });

  function box(w, h, d, mat, x, y, z, parent = scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }

  /* ------------------------------- street ------------------------------- */
  const street = new THREE.Group();
  scene.add(street);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), lam(0xe9dfc9));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 8);
  street.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), lam(0xd8cbaa));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 12);
  street.add(road);

  // office building facade
  const bld = new THREE.Group();
  street.add(bld);
  const bodyMat = lam(0xfbf4e4);
  const body = new THREE.Mesh(new THREE.BoxGeometry(16, 8, 6), bodyMat);
  body.position.set(0, 4, -3);
  bld.add(body);
  const trimMat = lam(0x2f3a33);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.5, 6.4), trimMat);
  trim.position.set(0, 8.2, -3);
  bld.add(trim);
  // windows: cheap emissive grid on the front face (z = 0.02)
  const winMat = new THREE.MeshBasicMaterial({ color: 0x9fd8bb });
  const winOff = new THREE.MeshBasicMaterial({ color: 0xcfc2a4 });
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 6; c++) {
      const lit = (r + c) % 3 !== 0;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), lit ? winMat : winOff);
      w.position.set(-6 + c * 2.4, 3 + r * 1.8, 0.03);
      bld.add(w);
    }
  }
  // door (glowing) + sign
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x1e9e6a });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3), doorMat);
  door.position.set(0, 1.5, 0.04);
  bld.add(door);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1), basic(0x2f3a33));
  sign.position.set(0, 7, 0.04);
  bld.add(sign);

  // lamps + trees (boxes/cones, a handful)
  for (const x of [-9, 9]) {
    box(0.25, 4, 0.25, lam(0x8a7f6f), x, 2, 6, street);
    const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), basic(0xffd36e));
    lampHead.position.set(x, 4.1, 6);
    street.add(lampHead);
    box(0.5, 1.2, 0.5, lam(0x9a6b4f), x * 0.7, 0.6, 9, street);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 7), lam(0x7fae8b));
    tree.position.set(x * 0.7, 2.4, 9);
    street.add(tree);
  }

  /* ------------------------------- office ------------------------------- */
  const office = new THREE.Group();
  office.visible = false;
  scene.add(office);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 14), lam(0xf1e7d2));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -8);
  office.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), lam(0xe4d5b8));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.01, -8);
  office.add(rug);

  const wallMat = lam(0xfbf4e4);
  const back = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 0.4), wallMat);
  back.position.set(0, 2.5, -14.5);
  office.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, 5, 14), wallMat);
    side.position.set(s * 9, 2.5, -8);
    office.add(side);
  }

  // desks with monitors
  const deskMat = lam(0xd9cbae);
  const legMat = lam(0x8a7f6f);
  const screenOn = new THREE.MeshBasicMaterial({ color: 0x9fd8bb });
  const screenOff = new THREE.MeshBasicMaterial({ color: 0x3a4a41 });
  let myScreen;
  function desk(x, z, mine) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    office.add(g);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.2), deskMat);
    top.position.y = 0.95;
    g.add(top);
    for (const [lx, lz] of [[-1.1, -0.45], [1.1, -0.45], [-1.1, 0.45], [1.1, 0.45]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.1), legMat);
      leg.position.set(lx, 0.47, lz);
      g.add(leg);
    }
    const mon = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.1), legMat);
    mon.position.set(0, 1.45, -0.2);
    g.add(mon);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.55), mine ? screenOn : screenOff);
    scr.position.set(0, 1.45, -0.14);
    g.add(scr);
    if (mine) myScreen = scr;
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.7), lam(0x2f3a33));
    chair.position.set(0, 0.55, 0.9);
    g.add(chair);
  }
  desk(-4.5, -10, false);
  desk(0, -10.5, false);
  desk(3.5, -9, true); // your desk
  const MY_DESK = new THREE.Vector3(3.5, 0, -9);

  // server racks along the left wall with blinking LEDs
  const leds = [];
  for (let i = 0; i < 4; i++) {
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 2.2), lam(0x3a4a41));
    rack.position.set(-8.2, 1.3, -12 + i * 2.4);
    office.add(rack);
    for (let j = 0; j < 3; j++) {
      const led = new THREE.Mesh(
        new THREE.PlaneGeometry(0.12, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x7cf2b0 })
      );
      led.position.set(-7.68, 1 + j * 0.6, -12.4 + i * 2.4);
      led.rotation.y = Math.PI / 2;
      led.userData.off = i * 0.7 + j * 1.1;
      office.add(led);
      leds.push(led);
    }
  }

  // ceiling strip lights (emissive planes, no real lights)
  for (const x of [-4, 0, 4]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), basic(0xfff6e3));
    strip.rotation.x = Math.PI / 2;
    strip.position.set(x, 4.6, -8);
    office.add(strip);
  }

  /* --------------------------- markers + player -------------------------- */
  const markerMat = basic(0xc96f2e);
  function marker() {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), markerMat.clone());
    m.rotation.x = Math.PI;
    scene.add(m);
    return m;
  }
  const doorMarker = marker();
  doorMarker.position.set(0, 4.6, 0.6);
  const deskMarker = marker();
  deskMarker.position.set(MY_DESK.x, 2.9, MY_DESK.z);
  deskMarker.visible = false;

  let player = createMii({ skin: 0x7b4c2d, shirt: 0xd6503c, pants: 0x333945, hair: 0x4a2c14, hairStyle: "bowl" });
  scene.add(player);

  function setPlayerOptions(opts) {
    const pos = player.position.clone();
    const rot = player.rotation.y;
    scene.remove(player);
    player = createMii(opts);
    player.position.copy(pos);
    player.rotation.y = rot;
    scene.add(player);
  }

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 120);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* -------------------------------- state -------------------------------- */
  const DOOR_PT = new THREE.Vector3(0, 0, 2.2);
  let phase = "street"; // 'street' | 'office'
  let paused = false;
  const keys = {};
  addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyE") tryInteract();
  });
  addEventListener("keyup", (e) => (keys[e.code] = false));

  function setPhase(p) {
    phase = p;
    street.visible = p === "street";
    office.visible = p === "office";
    doorMarker.visible = p === "street";
    deskMarker.visible = p === "office";
    if (p === "street") player.position.set(0, 0, 8);
    else player.position.set(0, 0, -4);
    onPrompt(null);
  }

  function setDayTint(day) {
    const c = TINTS[(day - 1) % TINTS.length];
    scene.background.setHex(c);
    scene.fog.color.setHex(c);
  }

  function nearestTarget() {
    if (phase === "street") {
      const d = Math.hypot(player.position.x - DOOR_PT.x, player.position.z - DOOR_PT.z);
      if (d < 2.4) return { id: "door", label: "Enter the office" };
    } else {
      const d = Math.hypot(player.position.x - MY_DESK.x, player.position.z - MY_DESK.z);
      if (d < 2.6) return { id: "desk", label: "Sit down & open computer" };
    }
    return null;
  }

  function tryInteract() {
    if (paused) return;
    const t = nearestTarget();
    if (t) onInteract(t.id);
  }

  const camOffsetStreet = new THREE.Vector3(0, 6.5, 9);
  const camOffsetOffice = new THREE.Vector3(0, 8, 6.5);
  const lookTmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let promptShown = "__init__";

  function tick() {
    requestAnimationFrame(tick);
    if (paused) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // movement
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const sp = 5 * dt;
      player.position.x += (mx / len) * sp;
      player.position.z += (mz / len) * sp;
      player.rotation.y = Math.atan2(mx, mz);
      player.userData.update(dt, t, true);
    } else {
      player.userData.update(dt, t, false);
    }
    if (phase === "street") {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -10, 10);
      player.position.z = THREE.MathUtils.clamp(player.position.z, 1.4, 14);
    } else {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -8, 8);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -13, -3);
    }

    // idle animation: markers bob, LEDs blink, door pulses
    doorMarker.position.y = 4.6 + Math.sin(t * 2.4) * 0.25;
    deskMarker.position.y = 2.9 + Math.sin(t * 2.4) * 0.2;
    doorMarker.rotation.y = t;
    deskMarker.rotation.y = t;
    doorMat.color.setHSL(0.42, 0.6, 0.32 + Math.sin(t * 3) * 0.06);
    for (const led of leds) {
      const on = Math.sin(t * 3 + led.userData.off) > -0.2;
      led.material.color.setHex(on ? 0x7cf2b0 : 0x2c3831);
    }
    if (myScreen) myScreen.material.color.setHSL(0.42, 0.45, 0.62 + Math.sin(t * 5) * 0.05);

    // camera follow
    const off = phase === "street" ? camOffsetStreet : camOffsetOffice;
    camera.position.lerp(
      lookTmp.copy(player.position).add(off),
      1 - Math.exp(-4 * dt)
    );
    camera.lookAt(player.position.x, 1.2, player.position.z);

    // prompt
    const near = nearestTarget();
    const key = near ? near.id : null;
    if (key !== promptShown) {
      promptShown = key;
      onPrompt(near);
    }

    renderer.render(scene, camera);
  }

  setPhase("street");
  camera.position.set(0, 6.5, 17);
  tick();

  return {
    setPhase,
    setDayTint,
    tryInteract,
    setPlayerOptions,
    setPaused: (b) => { paused = b; if (!b) clock.getDelta(); },
    setVisible: (b) => { container.style.display = b ? "" : "none"; },
    getPhase: () => phase,
  };
}
