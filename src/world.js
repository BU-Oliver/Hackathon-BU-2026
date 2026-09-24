import * as THREE from "three";
import { createMii, DEFAULT_LOOK } from "./mii.js";

/* The world outside the computer: an Irish datacenter campus with a village,
 * lake and farmland around it, plus the office interior. One scene, two zones
 * (street + office) toggled by visibility.
 *
 * Perf notes: shared materials, no per-frame allocation, shadow map limited to
 * a tight frustum that follows the player, pixelRatio capped at 1. */

const PALETTES = [
  { // day 1 — soft morning
    sky: [0x9fc4de, 0xe8ecdf], fog: 0xe4e7d8, hemi: [0xf2f6ff, 0x8a8a6a, 1.05],
    sun: 0xfff0d2, sunI: 1.5, sunPos: [-26, 20, 16], ground: 0x86a862,
  },
  { // day 2 — bright midday
    sky: [0x8fc0e8, 0xeef1e2], fog: 0xe9ecdc, hemi: [0xf6f9ff, 0x8f8f6e, 1.15],
    sun: 0xfffaf0, sunI: 1.7, sunPos: [14, 34, 10], ground: 0x8bad68,
  },
  { // day 3 — low evening sun
    sky: [0xf0b98a, 0xf7e3c4], fog: 0xf0dfc4, hemi: [0xfff0e0, 0x8a7a5e, 1.0],
    sun: 0xffd9a0, sunI: 1.45, sunPos: [30, 14, 22], ground: 0x7fa05e,
  },
];

export function createWorld(container, opts = {}) {
  const onPrompt = opts.onPrompt || (() => {});
  const onInteract = opts.onInteract || (() => {});

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe4e7d8, 70, 210);

  const hemi = new THREE.HemisphereLight(0xf2f6ff, 0x8a8a6a, 0.72);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 1.85);
  sun.position.set(-26, 20, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -0.0012;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // soft fill from the opposite side so nothing goes muddy
  const fill = new THREE.DirectionalLight(0xdce8ff, 0.35);
  fill.position.set(20, 12, -18);
  scene.add(fill);

  const lam = (color, emissive = 0x000000, ei = 0) =>
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: ei });
  const basic = (color) => new THREE.MeshBasicMaterial({ color });

  const box = (w, h, d, mat, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  /* ---- gradient sky dome (recoloured per day) ---- */
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 8;
  skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(150, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  skyDome.renderOrder = -1;
  scene.add(skyDome);
  function paintSky(zenith, horizon) {
    const x = skyCanvas.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    const z = "#" + zenith.toString(16).padStart(6, "0");
    const h = "#" + horizon.toString(16).padStart(6, "0");
    g.addColorStop(0, z);
    g.addColorStop(0.3, h);
    g.addColorStop(0.47, h);
    g.addColorStop(0.53, h);
    g.addColorStop(1, "#cfcabb");
    x.fillStyle = g;
    x.fillRect(0, 0, 8, 256);
    skyTex.needsUpdate = true;
  }

  /* ---- speckled ground textures so nothing reads as flat plastic ---- */
  function noiseTexture(base, spots, size = 128, count = 900) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    x.fillStyle = base;
    x.fillRect(0, 0, size, size);
    for (let i = 0; i < count; i++) {
      x.fillStyle = spots[(Math.random() * spots.length) | 0];
      x.globalAlpha = 0.25 + Math.random() * 0.45;
      const s = 1 + Math.random() * 3;
      x.fillRect(Math.random() * size, Math.random() * size, s, s);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const grassTex = noiseTexture("#7fa35f", ["#6d9150", "#8fb569", "#628544", "#9dbf74"]);
  const asphaltTex = noiseTexture("#6d6f71", ["#63656a", "#787a7c"], 128, 500);
  asphaltTex.repeat.set(20, 1);
  const paveTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    x.fillStyle = "#b9b7ae";
    x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "rgba(0,0,0,.16)";
    x.lineWidth = 2;
    for (let i = 0; i <= 128; i += 32) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
    }
    for (let i = 0; i < 400; i++) {
      x.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.07)";
      x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 4);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  // shadow helper: only the chunky things cast
  const caster = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  const receiver = (m) => { m.receiveShadow = true; return m; };

  /* ------------------------- street: DC campus + village ------------------------- */
  const street = new THREE.Group();
  scene.add(street);

  const turbineHubs = [];
  const clouds = [];
  const waterPlanes = []; // lake + village pond, shrunk by the world state
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  function cyl(rt, rb, h, mat, x, y, z, parent = street, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function flat(w, d, mat, x, y, z, parent = street) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  function textTexture(text, opts = {}) {
    const { w = 512, h = 128, bg = "#2f3a33", fg = "#f7efdc", font = 64 } = opts;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = fg;
    x.font = `800 ${font}px system-ui, sans-serif`;
    x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, w / 2, h / 2 + 2);
    return new THREE.CanvasTexture(c);
  }

  /* ---- base land ---- */
  const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
  grassTex.repeat.set(46, 46);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(280, 280), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.03, -10);
  receiver(ground);
  street.add(ground);

  const apron = receiver(flat(76, 52, lam(0xb0aea5), 2, 0, -7));
  const forecourt = receiver(flat(17, 11, new THREE.MeshLambertMaterial({ map: paveTex }), 0, 0.012, 4));

  // main road along the south + dashes + spur up to the car park
  const road = receiver(flat(150, 5.5, new THREE.MeshLambertMaterial({ map: asphaltTex }), 0, 0.008, 27));
  const dashMat = basic(0xf2f0e8);
  for (let x = -70; x <= 70; x += 4.5) flat(1.8, 0.2, dashMat, x, 0.022, 27);
  receiver(flat(5.5, 10, new THREE.MeshLambertMaterial({ map: asphaltTex }), 18, 0.012, 21.5));

  // zebra crossing from the car park to the entrance — leads the eye in
  for (let i = 0; i < 7; i++) flat(0.55, 3.4, basic(0xf4f2ea), 9.5 + i * 1.15, 0.03, 8.5);

  /* ---- mown lawn beds either side of the entrance path, with a kerb ---- */
  const lawnMat = lam(0x7ba457);
  const kerbMat = lam(0xbdbab0);
  for (const lx of [-7.4, 7.4]) {
    receiver(flat(4.8, 13.6, kerbMat, lx, 0.008, 4));
    receiver(flat(4.2, 13, lawnMat, lx, 0.016, 4));
  }
  // bollards lining the walk from the crossing to the door
  for (const [bx, bz] of [[-2.7, 2.0], [-2.7, 4.0], [-2.7, 6.0], [2.7, 2.0], [2.7, 4.0], [2.7, 6.0]]) {
    caster(cyl(0.09, 0.11, 0.85, lam(0x4c5552), bx, 0.43, bz, street, 8));
    cyl(0.1, 0.1, 0.07, lam(0xe8e4d8), bx, 0.86, bz, street, 8);
  }
  // bike rack
  for (let i = 0; i < 3; i++) {
    const rx = -10.6, rz = 5.5 + i * 0.9;
    cyl(0.05, 0.05, 0.75, lam(0x6e7375), rx, 0.38, rz, street, 6);
    cyl(0.05, 0.05, 0.75, lam(0x6e7375), rx + 0.7, 0.38, rz, street, 6);
    box(0.75, 0.05, 0.05, lam(0x6e7375), rx + 0.35, 0.74, rz, street);
  }

  /* ---- datacenter halls (the place you enter) ---- */
  const hallMat = lam(0xd3d7d6);      // light metal cladding
  const hallTrim = lam(0xa8aeae);
  const louvreMat = lam(0x939b9c);
  const darkTrim = lam(0x38423f);

  // Hall A: long hall facing the forecourt
  caster(box(38, 6.6, 17, hallMat, -2, 3.3, -15, street));
  // louvre bands, inset so they read as shadow lines
  for (const y of [5.0, 2.6]) {
    caster(box(38.2, 1.0, 0.3, louvreMat, -2, y, -6.4, street));
    box(38.4, 0.12, 0.16, hallTrim, -2, y + 0.55, -6.36, street);
    box(38.4, 0.12, 0.16, hallTrim, -2, y - 0.55, -6.36, street);
  }
  // parapet cap
  caster(box(38.6, 0.55, 0.5, hallTrim, -2, 6.9, -6.6, street));
  // panel joints for scale
  for (let i = -8; i <= 8; i++) box(0.1, 6.4, 0.1, hallTrim, -2 + i * 2.3, 3.3, -6.38, street);
  // roller shutter dock doors on the east end
  for (const dx of [11.5, 15.5]) {
    caster(box(3.0, 3.4, 0.25, darkTrim, dx, 1.7, -6.45, street));
    for (let i = 0; i < 7; i++) box(2.9, 0.08, 0.1, louvreMat, dx, 0.5 + i * 0.42, -6.3, street);
    box(3.3, 0.3, 0.5, hallTrim, dx, 3.55, -6.4, street);
  }
  // downpipes
  for (const dx of [-19, -8, 3, 18]) {
    cyl(0.13, 0.13, 6.4, hallTrim, dx, 3.2, -6.3, street, 8);
  }

  // rooftop plant: AHU rows, vents, skylights, bulkhead, walkway rails
  const ahuMat = lam(0xeef0ef);
  const ahuDark = lam(0xc3c8c7);
  for (let i = 0; i < 7; i++) {
    caster(box(2.4, 1.7, 3.2, ahuMat, -17 + i * 4.8, 7.65, -12.5, street));
    caster(box(2.4, 1.7, 3.2, ahuMat, -17 + i * 4.8, 7.65, -18, street));
    box(2.45, 0.12, 3.25, ahuDark, -17 + i * 4.8, 8.52, -12.5, street);
  }
  for (let i = 0; i < 5; i++) {
    caster(cyl(0.55, 0.55, 1.3, ahuMat, -15 + i * 6.2, 7.25, -9.8, street));
    cyl(0.7, 0.7, 0.18, ahuDark, -15 + i * 6.2, 7.98, -9.8, street);
  }
  // skylight strips
  for (const sx of [-9, 3]) {
    caster(box(9, 0.25, 2.2, lam(0x44555c), sx, 6.75, -15.2, street));
    for (let i = 0; i < 4; i++) box(0.14, 0.3, 2.2, hallTrim, sx - 3.4 + i * 2.3, 6.78, -15.2, street);
  }
  caster(box(4.2, 2.2, 3.2, hallMat, 8.5, 7.7, -17.5, street));
  box(4.6, 0.2, 3.6, ahuDark, 8.5, 8.9, -17.5, street);
  // roof-edge safety rail
  for (let i = -9; i <= 9; i++) cyl(0.05, 0.05, 1.0, hallTrim, -2 + i * 2, 7.5, -6.9, street, 6);
  box(38, 0.07, 0.07, hallTrim, -2, 7.95, -6.9, street);

  // Hall B: second hall behind, forming the L
  caster(box(15, 6.6, 20, hallMat, 17, 3.3, -28, street));
  for (const y of [5.0, 2.6]) {
    caster(box(0.3, 1.0, 20.2, louvreMat, 9.4, y, -28, street));
    box(0.16, 0.12, 20.4, hallTrim, 9.36, y + 0.55, -28, street);
    box(0.16, 0.12, 20.4, hallTrim, 9.36, y - 0.55, -28, street);
  }
  for (let i = 0; i < 4; i++) caster(box(2.4, 1.7, 3.2, ahuMat, 14 + i * 3.6, 7.65, -28, street));
  caster(box(15.4, 0.55, 0.5, hallTrim, 17, 6.9, -17.9, street));

  // glass entrance pavilion (THIS is the door you walk through)
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x2b3d44, transparent: true, opacity: 0.82,
  });
  const frameMat = lam(0xe9ecea);
  caster(box(7.4, 3.8, 4.8, glassMat, 0, 1.9, -2.9, street));
  for (let i = -2; i <= 2; i++) box(0.14, 3.6, 0.14, frameMat, i * 1.4, 1.9, -0.48, street);
  box(7.5, 0.22, 0.2, frameMat, 0, 3.7, -0.48, street);
  // canopy on posts
  caster(box(11, 0.3, 4.2, darkTrim, 0, 4.1, -1.2, street));
  box(11.2, 0.12, 4.4, lam(0x4a5652), 0, 4.28, -1.2, street);
  for (const px of [-5, 5]) caster(cyl(0.13, 0.15, 4.0, frameMat, px, 2.0, 0.6, street, 8));

  const doorMat = new THREE.MeshBasicMaterial({ color: 0x1e9e6a });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.9), doorMat);
  door.position.set(0, 1.45, -0.44);
  street.add(door);
  box(0.1, 2.9, 0.1, frameMat, 0, 1.45, -0.42, street);

  // the one sign that matters, on the canopy
  const canopySign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 0.8),
    new THREE.MeshBasicMaterial({
      map: textTexture("GRID TRUTH · DC-04", { w: 640, h: 80, bg: "#2b3d33", fg: "#f7efdc", font: 54 }),
    })
  );
  canopySign.position.set(0, 3.72, 0.95);
  street.add(canopySign);

  // wayfinding plate bolted to the pavilion glass.
  // NB: sits clear of the mullion (front face z=-0.41) and the sign face sits
  // clear of its own backing plate — coplanar faces here caused z-fighting.
  box(1.72, 0.62, 0.06, frameMat, -2.4, 2.62, -0.36, street);
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.42),
    new THREE.MeshBasicMaterial({ map: textTexture("STAFF ENTRY", { w: 384, h: 108, bg: "#1e9e6a", fg: "#ffffff", font: 62 }) })
  );
  plate.position.set(-2.4, 2.62, -0.31);
  street.add(plate);
  // small standoff brackets so it reads as mounted, not floating
  for (const sx of [-3.05, -1.75]) box(0.07, 0.07, 0.12, frameMat, sx, 2.62, -0.43, street);

  // glass office block to the right (the reference's office wing)
  caster(box(9.5, 5.2, 7.4, hallMat, 13.5, 2.6, -6.5, street));
  caster(box(8.8, 3.5, 0.2, glassMat, 13.5, 2.2, -2.72, street));
  for (let i = -2; i <= 2; i++) box(0.14, 3.5, 0.16, frameMat, 13.5 + i * 1.7, 2.2, -2.66, street);
  box(9.2, 0.16, 0.2, frameMat, 13.5, 3.95, -2.66, street);
  caster(box(10, 0.45, 7.8, darkTrim, 13.5, 5.4, -6.5, street));
  for (let i = 0; i < 3; i++) caster(box(2.2, 1.2, 2.2, ahuMat, 11 + i * 2.6, 6.2, -8.5, street));

  /* ---- car park with painted bays + parked cars ---- */
  function carparkTexture() {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 410;
    const x = c.getContext("2d");
    x.fillStyle = "#a3a49f"; x.fillRect(0, 0, 512, 410);
    x.strokeStyle = "#f2f0e8"; x.lineWidth = 5;
    x.beginPath(); // bay dividers, north + south rows
    for (let i = 0; i <= 11; i++) {
      x.moveTo(i * 46.5, 8); x.lineTo(i * 46.5, 130);
      x.moveTo(i * 46.5, 280); x.lineTo(i * 46.5, 402);
    }
    x.moveTo(8, 130); x.lineTo(504, 130);
    x.moveTo(8, 280); x.lineTo(504, 280);
    x.stroke();
    x.fillStyle = "#f2f0e8"; // centre arrow
    x.beginPath();
    x.moveTo(256, 175); x.lineTo(296, 235); x.lineTo(270, 235);
    x.lineTo(270, 265); x.lineTo(242, 265); x.lineTo(242, 235); x.lineTo(216, 235);
    x.closePath(); x.fill();
    return new THREE.CanvasTexture(c);
  }
  const cp = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 17.6),
    new THREE.MeshLambertMaterial({ map: carparkTexture() })
  );
  cp.rotation.x = -Math.PI / 2;
  cp.position.set(18, 0.02, 10);
  street.add(cp);

  const wheelMat = lam(0x1e2023);
  const glassCar = lam(0x2b343c);
  function car(color, x, z, flip) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = flip ? Math.PI : 0;
    const bm = lam(color);
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.5, 3.7), bm);
    bodyM.position.y = 0.62; caster(bodyM); g.add(bodyM);
    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 3.5), lam(0x3a3d40));
    lower.position.y = 0.42; g.add(lower);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 2.0), glassCar);
    cab.position.set(0, 1.12, -0.15); caster(cab); g.add(cab);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.1, 1.5), bm);
    roof.position.set(0, 1.4, -0.15); g.add(roof);
    for (const [wx, wz] of [[-0.86, 1.2], [0.86, 1.2], [-0.86, -1.2], [0.86, -1.2]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.22, 10), wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 0.33, wz);
      caster(w);
      g.add(w);
    }
    for (const [lx, lz] of [[-0.55, 1.86], [0.55, 1.86]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), basic(0xfff2cf));
      l.position.set(lx, 0.68, lz);
      g.add(l);
    }
    street.add(g);
  }
  const carCols = [0xb03030, 0xdadde0, 0x23262b, 0x2e5dc9, 0x8a9099, 0x7a1f1f, 0xd8d8d8, 0x1f3a5f, 0xb03030, 0x2e7d4f];
  [10.5, 13.5, 16.5, 22.5, 25.5].forEach((x, i) => car(carCols[i], x, 5.4, false));
  [11.5, 14.5, 19.5, 24, 26.5].forEach((x, i) => car(carCols[i + 5], x, 14.6, true));

  // car-park + forecourt lamp posts
  function lamp(x, z, h = 5) {
    caster(cyl(0.07, 0.1, h, lam(0x6e7375), x, h / 2, z, street, 8));
    box(0.5, 0.1, 0.5, lam(0x6e7375), x, h - 0.05, z, street);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), basic(0xffeeb0));
    head.scale.set(1, 0.6, 1);
    head.position.set(x, h - 0.18, z);
    street.add(head);
  }
  lamp(9, 10); lamp(18, 10); lamp(27, 10);
  lamp(-7.5, 1, 4.0); lamp(7.5, 9, 4.0);

  // security hut + barrier by the spur road
  caster(box(2.6, 2.8, 2.6, lam(0xd8dad6), 13.5, 1.4, 21, street));
  caster(box(2.9, 0.25, 2.9, lam(0x8e9490), 13.5, 2.9, 21, street));
  box(2.3, 0.9, 0.12, lam(0x2b3d44), 13.5, 1.8, 22.32, street);
  box(2.3, 0.8, 0.12, lam(0x2b3d44), 13.5, 1.8, 19.68, street);
  // boom barrier. The beam and its white stripes live in one group so they
  // tilt together — building the stripes in world space left them floating
  // above the raised end of the beam.
  const boom = new THREE.Group();
  boom.position.set(20.5, 1.05, 21.5);
  boom.rotation.z = 0.08;
  street.add(boom);
  caster(box(4.2, 0.16, 0.16, lam(0xc23b2e), 0, 0, 0, boom));
  for (let i = 0; i < 5; i++) {
    box(0.42, 0.18, 0.18, lam(0xf2f0e8), -1.6 + i * 0.85, 0, 0, boom);
  }
  caster(cyl(0.11, 0.13, 1.1, lam(0x6e7375), 18.4, 0.55, 21.5, street, 8));
  box(0.3, 0.24, 0.3, lam(0xc23b2e), 18.4, 1.12, 21.5, street);

  // low perimeter fence (gap at the spur entrance)
  const fenceMat = lam(0x777d7f);
  for (const [x0, x1] of [[-24, 14], [22, 32]]) {
    for (let x = x0; x <= x1; x += 4) caster(box(0.1, 1.25, 0.1, fenceMat, x, 0.62, 24, street));
    box(x1 - x0, 0.07, 0.07, fenceMat, (x0 + x1) / 2, 1.1, 24, street);
    box(x1 - x0, 0.07, 0.07, fenceMat, (x0 + x1) / 2, 0.62, 24, street);
  }

  // tricolour flag by the forecourt
  cyl(0.06, 0.08, 7, lam(0xd8d8d8), -6.5, 3.5, 4, street, 8);
  function flagTexture() {
    const c = document.createElement("canvas");
    c.width = 180; c.height = 120;
    const x = c.getContext("2d");
    x.fillStyle = "#169b62"; x.fillRect(0, 0, 60, 120);
    x.fillStyle = "#ffffff"; x.fillRect(60, 0, 60, 120);
    x.fillStyle = "#ff883e"; x.fillRect(120, 0, 60, 120);
    return new THREE.CanvasTexture(c);
  }
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.0),
    new THREE.MeshBasicMaterial({ map: flagTexture(), side: THREE.DoubleSide })
  );
  flag.position.set(-5.75, 6.1, 4);
  street.add(flag);

  // forecourt planters with rounded shrubs (no more gem blobs)
  function planter(x, z) {
    caster(box(1.0, 0.5, 1.0, lam(0xa8a49a), x, 0.25, z, street));
    box(1.1, 0.1, 1.1, lam(0x8e8a80), x, 0.52, z, street);
    const shrub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lam(0x5d8a48));
    shrub.scale.set(1, 0.85, 1);
    shrub.position.set(x, 0.85, z);
    caster(shrub);
    const shrub2 = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), lam(0x6d9a52));
    shrub2.position.set(x + 0.22, 1.12, z - 0.12);
    caster(shrub2);
  }
  planter(-6, 1.5); planter(6, 1.5); planter(-6, 8.5); planter(6, 8.5);
  // hedge + trees along the south edge, framing the forecourt
  const shrubRowMat = lam(0x4d7a3f);
  for (const [hx, hz, hw] of [[-8.5, 12, 7], [8.5, 12, 7]]) {
    caster(box(hw, 1.1, 0.9, shrubRowMat, hx, 0.55, hz, street));
    for (let i = 0; i < 5; i++) {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.62, 8, 6), lam(i % 2 ? 0x5d8a48 : 0x4f7c3f));
      bump.scale.set(1.1, 0.75, 0.8);
      bump.position.set(hx - hw / 2 + 1 + i * ((hw - 2) / 4), 1.15, hz);
      caster(bump);
    }
  }
  function bench(x, z) {
    caster(box(1.8, 0.09, 0.48, lam(0x8a6541), x, 0.5, z, street));
    for (const lx of [-0.7, 0.7]) box(0.1, 0.5, 0.42, lam(0x5a5e60), x + lx, 0.25, z, street);
  }
  bench(-4.5, 5); bench(4.5, 5);

  /* ---- the Irish village (west, along the lane) ---- */
  flat(30, 4.5, lam(0x6f7072), -34, 0.008, 10); // village lane
  const slateMat = lam(0x4a4f55);
  const warmMat = basic(0xffd98a);
  function cottage(x, z, wallColor, faceNorth) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (faceNorth) g.rotation.y = Math.PI;
    street.add(g);
    const walls = caster(new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 4), lam(wallColor)));
    walls.position.y = 1.3; g.add(walls);
    const roof = caster(new THREE.Mesh(new THREE.ConeGeometry(4.1, 2, 4), slateMat));
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.82);
    roof.position.y = 3.6; g.add(roof);
    const chim = caster(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.5), lam(0x8a7f74)));
    chim.position.set(1.2, 4.2, 0); g.add(chim);
    const doorM = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.8), lam(0x3a4a3a));
    doorM.position.set(-0.8, 0.95, 2.02); g.add(doorM);
    for (const wx of [0.7, 1.7]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 0.08), lam(0xf7f2e6));
      frame.position.set(wx, 1.5, 2.0); g.add(frame);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), warmMat);
      win.position.set(wx, 1.5, 2.05); g.add(win);
      box(0.06, 0.9, 0.02, lam(0xf7f2e6), wx, 1.5, 2.07, g);
    }
    return g;
  }
  cottage(-44, 3.5, 0xf2ede2, false);
  cottage(-37, 3.2, 0xe8d9b8, false);
  cottage(-30, 3.5, 0xdfe4da, false);
  cottage(-40, 16.5, 0xe6cfa8, true);
  cottage(-27, 16.5, 0xd8e0e4, true);

  // the pub: dark green front + hanging sign
  const pub = cottage(-33.5, 3.2, 0xf2ede2, false);
  const shopfront = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.0), lam(0x24402e));
  shopfront.position.set(0.4, 1.05, 2.04);
  pub.add(shopfront);
  const pubSign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.62),
    new THREE.MeshBasicMaterial({ map: textTexture("THE TURBINE & TROUT", { w: 512, h: 96, bg: "#1e2c22", fg: "#ffd36e", font: 52 }) })
  );
  pubSign.position.set(0.4, 2.35, 2.06);
  pub.add(pubSign);

  // church with spire + tiny graveyard, set back behind the lane
  const churchMat = lam(0xcfc8b8);
  box(6, 3.5, 9, churchMat, -33, 1.75, -8, street);
  const naveRoof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.2, 4), slateMat);
  naveRoof.rotation.y = Math.PI / 4;
  naveRoof.scale.set(0.72, 1, 1.05);
  naveRoof.position.set(-33, 4.6, -8);
  street.add(naveRoof);
  box(2.6, 7, 2.6, churchMat, -33, 3.5, -2.2, street);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(1.9, 3.4, 8), slateMat);
  spire.position.set(-33, 8.7, -2.2);
  street.add(spire);
  for (const [gx, gz] of [[-36, -11], [-34.5, -11.5], [-33, -11], [-31.5, -11.5]]) {
    box(0.5, 0.7, 0.12, lam(0x9a968c), gx, 0.35, gz, street);
  }

  // village green: old tree + benches + pond.
  // Parked between the cottages (which end at x≈-24.5) and the road
  // (which starts at z≈24.25) so no wall corner or kerb ends up in the water.
  cyl(0.3, 0.4, 2.2, lam(0x6a4a2e), -33, 1.1, 18, street, 8);
  const oldTree = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), lam(0x4d7a3f));
  oldTree.position.set(-33, 3.4, 18);
  street.add(oldTree);
  bench(-36, 18); bench(-30, 18);
  flat(8.0, 5.8, lam(0x8a7a5a), -19.5, 0.008, 20.5); // muddy rim
  const pondWater = flat(6.6, 4.4, lam(0x6fb3c8), -19.5, 0.02, 20.5); // pond
  waterPlanes.push(pondWater);
  for (let i = 0; i < 6; i++) {
    const rx = -22.5 + i * 1.2;
    const rz = 18.4 + Math.sin(i * 1.7) * 0.4;
    cyl(0.05, 0.06, 0.9 + (i % 3) * 0.3, lam(0x5d8a48), rx, 0.5, rz, street, 5);
  }

  // stone walls edging the lane
  const stoneMat = lam(0x9a968c);
  for (const [x, z, len] of [[-46, 6.8, 8], [-24, 6.8, 6], [-44, 13.2, 10], [-28, 13.2, 8]]) {
    box(len, 0.6, 0.4, stoneMat, x, 0.3, z, street);
  }

  /* ---- lake (far east, clear of the car park) with a proper jetty ---- */
  flat(23, 17, lam(0x8a7a5a), 44, 0.005, 2);
  const lakeWater = flat(19, 13, lam(0x6fb3c8), 44, 0.04, 2);
  waterPlanes.push(lakeWater);
  // jetty: deck resting on posts that actually stand in the water
  const jettyX = 34.5;
  box(5.0, 0.14, 1.5, lam(0x7a5a3a), jettyX, 0.42, 2, street);
  for (let i = 0; i < 5; i++) {
    box(5.0, 0.06, 0.22, lam(0x8a6a48), jettyX, 0.52, 1.45 + i * 0.28, street);
  }
  for (const jx of [32.4, 36.6]) {
    for (const jz of [1.5, 2.5]) cyl(0.1, 0.1, 1.1, lam(0x5a422c), jx, 0.1, jz, street, 7);
  }
  // little rowing boat tied to the end
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 8), lam(0x8a4a3a));
  hull.rotation.z = Math.PI / 2;
  hull.position.set(37.6, 0.16, 3.4);
  hull.scale.set(1, 1, 0.55);
  caster(hull);

  /* ---- sheep paddock (south-east, in view of the forecourt) ---- */
  const padMat = lam(0x7a5a3a);
  for (let x = 24; x <= 36; x += 3) { box(0.12, 1.0, 0.12, padMat, x, 0.5, 12, street); box(0.12, 1.0, 0.12, padMat, x, 0.5, 20, street); }
  box(12.2, 0.08, 0.08, padMat, 30, 0.85, 12, street);
  box(12.2, 0.08, 0.08, padMat, 30, 0.85, 20, street);
  function sheep(x, z, black, graze) {
    const wool = lam(black ? 0x2b2620 : 0xece7da);
    const dark = lam(0x2b2620);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.85), wool);
    b.position.set(x, 0.52, z); street.add(b);
    for (const [lx, lz] of [[-0.18, 0.28], [0.18, 0.28], [-0.18, -0.28], [0.18, -0.28]]) {
      cyl(0.05, 0.05, 0.35, dark, x + lx, 0.18, z + lz, street, 6);
    }
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, graze ? 0.4 : 0.26, 0.24), dark);
    head.position.set(x, graze ? 0.35 : 0.62, z + (graze ? 0.55 : 0.5));
    if (graze) head.rotation.x = 0.5;
    street.add(head);
  }
  sheep(26, 14, false, false); sheep(28.5, 17, false, true); sheep(31, 14.5, false, false);
  sheep(33, 17.5, true, false); sheep(29.5, 15.5, false, false); sheep(26.5, 18.5, false, true);

  /* ---- fields, hedges, drystone walls (south + far north) ---- */
  const fieldCols = [0x86a860, 0x74985a, 0x93b268];
  [[-30, 38, 40, 22], [12, 40, 44, 22], [-8, 62, 60, 20]].forEach(([fx, fz, fw, fd], i) => {
    flat(fw, fd, lam(fieldCols[i % 3]), fx, -0.01, fz);
  });
  flat(120, 30, lam(0x74985a), -10, -0.015, -48);
  const hedgeMat = lam(0x4d7a3f);
  for (const [hx, hz, len] of [[-30, 28.5, 38], [12, 30, 42], [-8, 52, 56]]) {
    box(len, 1.0, 0.8, hedgeMat, hx, 0.5, hz, street);
  }
  box(20, 0.6, 0.4, stoneMat, -2, 0.3, 29.5, street);

  /* ---- scattered trees: layered canopy instead of gem blobs ---- */
  const leafMats = [lam(0x4f7a3c), lam(0x5d8a48), lam(0x446b34)];
  const barkMat = lam(0x6a4a2e);
  function roundTree(x, z, s = 1, variant = 0) {
    caster(cyl(0.13 * s, 0.19 * s, 1.5 * s, barkMat, x, 0.75 * s, z, street, 7));
    const lm = leafMats[variant % 3];
    const blobs = [
      [0, 2.05, 0, 1.15], [-0.55, 1.75, 0.2, 0.78], [0.6, 1.8, -0.15, 0.72], [0.1, 2.45, -0.3, 0.7],
    ];
    for (const [bx, by, bz, r] of blobs) {
      const top = new THREE.Mesh(new THREE.SphereGeometry(r * s, 10, 8), lm);
      top.position.set(x + bx * s, by * s, z + bz * s);
      top.scale.y = 0.85;
      caster(top);
    }
  }
  function pineTree(x, z, s = 1) {
    caster(cyl(0.1 * s, 0.15 * s, 1.1 * s, barkMat, x, 0.55 * s, z, street, 7));
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry((1.15 - i * 0.22) * s, 1.3 * s, 9), lam(0x3f6b38));
      c.position.set(x, (1.35 + i * 0.72) * s, z);
      caster(c);
    }
  }
  for (let i = 0; i < 26; i++) {
    const x = -55 + rnd() * 110;
    const z = rnd() < 0.5 ? -34 - rnd() * 14 : 30 + rnd() * 26;
    if (x > -50 && x < -20 && z > -2 && z < 24) continue; // keep village clear
    if (x > 30 && x < 58 && z > -10 && z < 26) continue;   // keep lake clear
    if (x > -24 && x < 32) continue;                      // keep campus clear
    if (x > -24 && x < -4 && z > 8 && z < 18) continue;   // keep forecourt clear
    if (rnd() < 0.55) roundTree(x, z, 0.9 + rnd() * 1.1, (rnd() * 3) | 0);
    else pineTree(x, z, 0.9 + rnd() * 1.1);
  }
  roundTree(-15, 5, 1.25, 0); roundTree(6.5, 13, 1.05, 1);
  roundTree(-16.5, 16, 0.95, 2); roundTree(12.5, 4, 0.9, 0);
  pineTree(-28, 22, 1.3);

  /* ---- distant hills (hazed by fog) ---- */
  function hill(x, z, r, col) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), lam(col));
    h.scale.y = 0.2;
    h.position.set(x, 0, z);
    street.add(h);
  }
  hill(-55, -85, 30, 0x6d9a58);
  hill(20, -95, 36, 0x75995c);
  hill(75, -45, 26, 0x6d9a58);
  hill(-85, -10, 30, 0x75995c);

  /* ---- wind turbines on the horizon (the renewable story) ---- */
  function turbine(x, z, s = 1) {
    cyl(0.14 * s, 0.22 * s, 11 * s, lam(0xe8eae8), x, 5.5 * s, z, street, 8);
    const hub = new THREE.Group();
    hub.position.set(x, 11 * s, z + 0.3 * s);
    street.add(hub);
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 4.2 * s, 0.08 * s), lam(0xf2f3f1));
      blade.position.y = 2.1 * s;
      const pivot = new THREE.Group();
      pivot.rotation.z = (i * Math.PI * 2) / 3;
      pivot.add(blade);
      hub.add(pivot);
    }
    turbineHubs.push(hub);
  }
  turbine(-32, -36, 1.1);
  turbine(-43, -24, 0.9);
  turbine(36, -34, 1.2);

  /* ---- ESB-style pylons marching past the campus ---- */
  const pylonMat = lam(0x4a4e52);
  function pylon(x, z) {
    box(0.9, 15, 0.9, pylonMat, x, 7.5, z, street);
    for (const ay of [10.5, 12.3, 14]) box(7, 0.45, 0.45, pylonMat, x, ay, z, street);
  }
  pylon(-24, 34);
  pylon(24, 36);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3a3f44 });
  for (const dy of [-3, 3]) {
    for (const ay of [10.5, 12.3, 14]) {
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-24 + dy, ay, 34),
        new THREE.Vector3(0, ay - 2.2, 35),
        new THREE.Vector3(24 + dy, ay, 36)
      );
      street.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(12)), lineMat));
    }
  }

  /* ---- smoke plume off Hall A, shown when reliability collapses ---- */
  const smokeMat = new THREE.MeshLambertMaterial({
    color: 0x4a4a48, transparent: true, opacity: 0,
  });
  const smokeGroup = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8 + i * 0.22, 8, 6), smokeMat);
    puff.position.set(-7 + i * 0.7, 9.2 + i * 1.25, -13);
    smokeGroup.add(puff);
  }
  smokeGroup.visible = false;
  street.add(smokeGroup);

  /* ---- references that the world state drives ---- */
  /* ---- community opposition: appears on the approach road and at the pub
   * when acceptance collapses ---- */
  const protestMat = lam(0xf4f0e6);
  const protestGroup = new THREE.Group();
  function sign(x, z, text) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = 0.35;
    box(1.5, 0.85, 0.06, protestMat, 0, 1.3, 0, g);
    box(0.08, 0.9, 0.08, lam(0x7a5a3a), 0, 0.45, 0, g);
    const t = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 0.7),
      new THREE.MeshBasicMaterial({
        map: textTexture(text, { w: 384, h: 200, bg: "#f4f0e6", fg: "#a8321f", font: 74 }),
      })
    );
    t.position.set(0, 1.3, 0.04);
    g.add(t);
    protestGroup.add(g);
  }
  sign(-13, 20, "NO MORE");
  sign(-15.5, 20.6, "TALK TO US");
  sign(9, 19, "GO HOME");
  protestGroup.visible = false;
  street.add(protestGroup);
  // boarded-up pub windows when the village has given up on the campus
  const boards = new THREE.Group();
  for (const [bx, bz, ry] of [[-35.9, 3.6, 0], [-30.6, 16.4, Math.PI]]) {
    const g = new THREE.Group();
    g.position.set(bx, 1.5, bz);
    g.rotation.y = ry;
    for (let i = 0; i < 3; i++) box(0.95, 0.16, 0.05, lam(0x8a6f4e), 0, -0.3 + i * 0.3, 2.1, g);
    boards.add(g);
  }
  boards.visible = false;
  street.add(boards);

  const stateRefs = { leafMats, grassMat: groundMat, waterPlanes, smokeGroup, turbineHubs, protestGroup, boards };

  /* ---- drifting clouds ---- */
  const cloudMat = basic(0xf6f4ec);
  for (let i = 0; i < 5; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(2.4 - j * 0.5, 8, 6), cloudMat);
      s.position.set(j * 2.6 - 2.6, j * 0.5, 0);
      s.scale.y = 0.55;
      cl.add(s);
    }
    cl.position.set(-70 + i * 30 + rnd() * 10, 27 + rnd() * 7, -45 + rnd() * 55);
    street.add(cl);
    clouds.push(cl);
  }

  /* ------------------------------- office ------------------------------- */
  /* Cutaway room: back + side walls, no wall on the camera side, and a
   * ceiling that faces downward so the 3/4 camera can see inside. */
  const office = new THREE.Group();
  office.visible = false;
  scene.add(office);

  const WALL_H = 3.4;
  const carpetTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#d3c6ac"; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 260; i++) {
      x.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.08)";
      x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    x.strokeStyle = "rgba(0,0,0,.13)"; x.lineWidth = 1;
    x.strokeRect(0.5, 0.5, 63, 63);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(9, 7);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const oFloor = receiver(new THREE.Mesh(new THREE.PlaneGeometry(18, 14), new THREE.MeshLambertMaterial({ map: carpetTex })));
  oFloor.rotation.x = -Math.PI / 2;
  oFloor.position.set(0, 0, -8);
  office.add(oFloor);
  const oVinylTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "#a8a396"; x.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 200; i++) {
      x.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,.10)" : "rgba(0,0,0,.10)";
      x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    x.strokeStyle = "rgba(0,0,0,.18)"; x.lineWidth = 2;
    x.strokeRect(1, 1, 62, 62);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(10, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  // vinyl entrance strip inside the room
  const oVinyl = receiver(new THREE.Mesh(new THREE.PlaneGeometry(18, 2.6), new THREE.MeshLambertMaterial({ map: oVinylTex })));
  oVinyl.rotation.x = -Math.PI / 2;
  oVinyl.position.set(0, 0.012, -2.3);
  office.add(oVinyl);
  // threshold strip so carpet -> vinyl -> concrete reads as deliberate
  box(18, 0.05, 0.16, lam(0x8d9295), 0, 0.025, -0.98, office);
  box(18, 0.05, 0.1, lam(0x8d9295), 0, 0.02, -3.62, office);

  const wallMat = lam(0xf2ece0);
  const wallLower = lam(0xd9d2c2);
  const trimMat = lam(0xc7c0b0);
  const metalMat = lam(0x8d9295);
  const chairMat = lam(0x39423f);

  // back wall with a dado rail + skirting
  caster(box(18, WALL_H, 0.3, wallMat, 0, WALL_H / 2, -14.85, office));
  box(18, 0.9, 0.34, wallLower, 0, 0.45, -14.8, office);
  box(18, 0.07, 0.4, trimMat, 0, 0.92, -14.78, office);
  box(18, 0.12, 0.38, trimMat, 0, 0.06, -14.78, office);
  // side walls
  for (const s of [-1, 1]) {
    caster(box(0.3, WALL_H, 14, wallMat, s * 8.85, WALL_H / 2, -8, office));
    box(0.34, 0.9, 14, wallLower, s * 8.8, 0.45, -8, office);
    box(0.4, 0.12, 14, trimMat, s * 8.8, 0.06, -8, office);
    // cornice so the room reads as enclosed from the 3/4 camera
    caster(box(0.5, 0.35, 14, trimMat, s * 8.7, WALL_H - 0.15, -8, office));
  }
  caster(box(18, 0.35, 0.5, trimMat, 0, WALL_H - 0.15, -14.6, office));

  // suspended ceiling: a light T-bar grid over the back of the room reads as
  // "there is a ceiling" without hiding the space from the 3/4 camera
  const gridMat = lam(0xcac4b6);
  for (let gx = -9; gx <= 9; gx += 2.2) box(0.045, 0.045, 8, gridMat, gx, WALL_H, -11, office);
  for (let gz = -15; gz <= -7; gz += 2.2) box(18, 0.045, 0.045, gridMat, 0, WALL_H, gz, office);
  // enclosing shell so the room never opens onto empty sky
  const shellMat = new THREE.MeshLambertMaterial({ color: 0x39423f, side: THREE.BackSide });
  const shell = new THREE.Mesh(new THREE.BoxGeometry(34, 9, 30), shellMat);
  shell.position.set(0, 4.4, -8);
  office.add(shell);
  const concreteTex = noiseTexture("#8d8a82", ["#7f7c75", "#98958c", "#6f6c66"], 128, 700);
  concreteTex.repeat.set(10, 9);
  const shellFloor = receiver(new THREE.Mesh(new THREE.PlaneGeometry(34, 30), new THREE.MeshLambertMaterial({ map: concreteTex })));
  shellFloor.rotation.x = -Math.PI / 2;
  shellFloor.position.set(0, -0.02, -8);
  office.add(shellFloor);
  // expansion joints so the concrete isn't one flat expanse
  for (let jz = -20; jz <= 4; jz += 4) box(34, 0.01, 0.06, lam(0x6f6c66), 0, 0.001, jz, office);
  for (let jx = -16; jx <= 16; jx += 4) box(0.06, 0.01, 30, lam(0x6f6c66), jx, 0.001, -8, office);
  // lockers against the east wall by the entrance (kept clear of the camera)
  const lockerMat = lam(0x9aa39c);
  for (let i = 0; i < 4; i++) {
    const lz = -2.0 - i * 0.62;
    caster(box(0.5, 1.8, 0.58, lockerMat, 8.3, 0.9, lz, office));
    box(0.04, 0.02, 0.5, lam(0x6e7671), 8.04, 1.2, lz, office);
    box(0.04, 0.08, 0.04, lam(0x4a5250), 8.02, 1.0, lz - 0.2, office);
  }
  const mat = receiver(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.4), lam(0x7d8a80)));
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(0, 0.016, -1.1);
  office.add(mat);
  // light panels + cable tray hanging below the ceiling (read from above)
  for (const [lx, lz] of [[-4.5, -5.5], [0, -5.5], [4.5, -5.5], [-4.5, -11], [0, -11], [4.5, -11]]) {
    caster(box(2.3, 0.12, 1.1, lam(0xffffff), lx, WALL_H - 0.22, lz, office));
    box(2.5, 0.16, 1.3, lam(0xd8d2c4), lx, WALL_H - 0.12, lz, office);
  }
  const trayMat = lam(0x9aa0a0);
  box(15, 0.12, 0.5, trayMat, 0, WALL_H - 0.45, -8, office);
  for (let i = -6; i <= 6; i++) box(0.1, 0.3, 0.1, trayMat, i * 1.2, WALL_H - 0.3, -8, office);

  /* ---- windows in the back wall: bright daylight panels ---- */
  const dayMat = new THREE.MeshBasicMaterial({ color: 0xdcecf4 });
  for (const wx of [-5.5, 0, 5.5]) {
    box(3.4, 1.7, 0.12, dayMat, wx, 2.0, -14.66, office);
    box(3.6, 0.12, 0.2, trimMat, wx, 2.88, -14.64, office);
    box(3.6, 0.12, 0.2, trimMat, wx, 1.12, -14.64, office);
    for (const mx of [-1.1, 0, 1.1]) box(0.09, 1.7, 0.16, trimMat, wx + mx, 2.0, -14.64, office);
    box(3.6, 0.16, 0.5, lam(0xe8e2d4), wx, 1.02, -14.55, office);
  }
  // framed pictures between the windows
  for (const [px, pcol] of [[-2.6, 0x3c72c4], [2.6, 0xd97b2b]]) {
    box(0.9, 0.7, 0.06, lam(0x8a7f6f), px, 2.1, -14.6, office);
    box(0.78, 0.58, 0.03, lam(pcol), px, 2.1, -14.55, office);
  }

  /* ---- glazed server room on the west side ---- */
  const partitionGlass = new THREE.MeshLambertMaterial({
    color: 0x9fc0bd, transparent: true, opacity: 0.3,
  });
  box(0.12, WALL_H - 0.4, 6.4, partitionGlass, -5.2, (WALL_H - 0.4) / 2, -11.2, office);
  for (const fz of [-14.2, -11.2, -8.2]) box(0.16, WALL_H - 0.4, 0.12, trimMat, -5.2, (WALL_H - 0.4) / 2, fz, office);
  box(0.18, 0.14, 6.4, trimMat, -5.2, WALL_H - 0.45, -11.2, office);
  caster(box(0.14, 2.2, 1.0, lam(0x33474a), -5.2, 1.1, -8.9, office));
  box(0.18, 0.1, 1.1, trimMat, -5.2, 2.24, -8.9, office);
  const rackGlassSign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.5),
    new THREE.MeshBasicMaterial({ map: textTexture("HALL B · AUTHORISED", { w: 512, h: 96, bg: "#1e9e6a", fg: "#ffffff", font: 56 }) })
  );
  rackGlassSign.rotation.y = Math.PI / 2;
  rackGlassSign.position.set(-5.1, 2.6, -10.4);
  office.add(rackGlassSign);
  const coldFloor = receiver(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 6.2), lam(0x6f7a80)));
  coldFloor.rotation.x = -Math.PI / 2;
  coldFloor.position.set(-7, 0.014, -11.2);
  office.add(coldFloor);

  /* ---- server racks inside the glazed room ---- */
  const leds = [];
  const rackBody = lam(0x2f3a37);
  const rackTrim = lam(0x4a5652);
  for (let i = 0; i < 4; i++) {
    const rz = -13.6 + i * 1.5;
    caster(box(2.4, 2.3, 1.1, rackBody, -7.1, 1.15, rz, office));
    box(2.5, 0.12, 1.2, rackTrim, -7.1, 2.33, rz, office);
    box(2.5, 0.14, 1.2, rackTrim, -7.1, 0.07, rz, office);
    for (let j = 0; j < 5; j++) {
      box(2.2, 0.34, 0.06, lam(0x222927), -7.1, 0.4 + j * 0.42, rz + 0.56, office);
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ color: 0x7cf2b0 }));
      led.position.set(-8.05, 0.4 + j * 0.42, rz + 0.6);
      led.rotation.y = Math.PI / 2;
      led.userData.off = i * 0.7 + j * 1.1;
      office.add(led);
      leds.push(led);
    }
  }
  // cold-aisle containment
  for (const cx of [-8.6, -5.6]) box(0.1, 0.5, 3.0, rackTrim, cx, 2.45, -12.3, office);
  box(3.2, 0.08, 3.0, partitionGlass, -7.1, 2.7, -12.3, office);
  for (const cz of [-13.6, -11]) box(3.2, 0.1, 0.14, rackTrim, -7.1, 2.5, cz, office);

  /* ---- desks along the back wall ---- */
  const deskMat = lam(0xcdbfa4);
  const deskEdge = lam(0xa89a80);
  const screenOn = new THREE.MeshBasicMaterial({ color: 0x9fd8bb });
  const screenIdle = new THREE.MeshBasicMaterial({ color: 0x4a5a60 });
  let myScreen;
  function desk(x, z, mine) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    office.add(g);
    const top = caster(new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 1.3), deskMat));
    top.position.y = 0.76; g.add(top);
    box(2.8, 0.45, 0.06, deskEdge, 0, 0.5, 0.6, g);
    // pedestal drawers
    const ped = caster(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.6), lam(0xe4ddcd)));
    ped.position.set(-1.05, 0.38, 0); g.add(ped);
    for (let i = 0; i < 3; i++) box(0.42, 0.02, 0.02, metalMat, -1.05, 0.2 + i * 0.2, 0.31, g);
    // right-hand leg frame
    for (const lz of [-0.55, 0.55]) box(0.07, 0.72, 0.07, metalMat, 1.15, 0.36, lz, g);
    box(0.07, 0.07, 1.2, metalMat, 1.15, 0.06, 0, g);
    // monitor
    const stand = caster(box(0.32, 0.05, 0.22, metalMat, 0, 0.83, -0.35, g));
    box(0.08, 0.22, 0.08, metalMat, 0, 0.92, -0.35, g);
    caster(box(1.25, 0.75, 0.07, lam(0x2c3236), 0, 1.36, -0.38, g));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 0.62), mine ? screenOn : screenIdle);
    scr.position.set(0, 1.36, -0.33);
    g.add(scr);
    if (mine) myScreen = scr;
    // desk clutter
    box(0.85, 0.03, 0.28, lam(0x3c4245), 0, 0.82, 0.22, g);
    box(0.16, 0.06, 0.22, lam(0x3c4245), 0.6, 0.83, 0.22, g);
    cyl(0.07, 0.06, 0.12, lam(mine ? 0xd97b2b : 0x7fa8c9), 0.95, 0.87, 0.1, g, 8);
    box(0.5, 0.02, 0.36, lam(0xf4f0e6), -0.75, 0.82, 0.15, g);
    // task chair
    const chair = new THREE.Group();
    chair.position.set(0, 0, 1.05);
    g.add(chair);
    const seat = caster(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.6), chairMat));
    seat.position.y = 0.46; chair.add(seat);
    caster(box(0.6, 0.62, 0.09, chairMat, 0, 0.8, 0.26, chair));
    cyl(0.06, 0.06, 0.4, metalMat, 0, 0.24, 0, chair, 8);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spoke = box(0.3, 0.05, 0.07, metalMat, Math.sin(a) * 0.15, 0.05, Math.cos(a) * 0.15, chair);
      spoke.rotation.y = a;
      const cas = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), lam(0x2a2f31));
      cas.position.set(Math.sin(a) * 0.3, 0.05, Math.cos(a) * 0.3);
      chair.add(cas);
    }
    return g;
  }
  desk(-2.4, -12.8, false);
  desk(0.6, -12.8, false);
  desk(3.6, -12.8, true); // your desk
  const MY_DESK = new THREE.Vector3(3.6, 0, -11.4);

  /* ---- kitchen corner (east) ---- */
  const counterMat = lam(0xcfc6b4);
  caster(box(3.4, 0.9, 0.7, counterMat, 6.6, 0.45, -13.6, office));
  box(3.5, 0.08, 0.78, metalMat, 6.6, 0.93, -13.6, office);
  caster(box(0.7, 0.9, 0.6, lam(0x39423f), 5.3, 1.36, -13.6, office));
  box(0.5, 0.3, 0.1, lam(0x222827), 5.3, 1.2, -13.32, office);
  const coffeeLed = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.08), basic(0xff9d5c));
  coffeeLed.position.set(5.3, 1.68, -13.3);
  office.add(coffeeLed);
  caster(box(0.9, 1.9, 0.8, lam(0xe8e4d8), 8.2, 0.95, -12.8, office));
  box(0.04, 0.5, 0.06, metalMat, 7.78, 1.2, -12.8, office);
  for (let i = 0; i < 4; i++) {
    cyl(0.06, 0.05, 0.1, lam([0xd97b2b, 0x7fa8c9, 0x8fbf7f, 0xf0e6d2][i]), 6.0 + i * 0.3, 1.56, -13.8, office, 8);
  }
  box(1.3, 0.05, 0.3, lam(0xa89a80), 6.45, 1.5, -13.8, office);
  const soupSign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 1.0),
    new THREE.MeshBasicMaterial({ map: textTexture("SOUP", { w: 256, h: 256, bg: "#d97b2b", fg: "#fff6e6", font: 96 }) })
  );
  soupSign.position.set(7.8, 2.3, -14.66);
  office.add(soupSign);
  // water cooler + bins
  caster(box(0.45, 1.1, 0.45, lam(0xe4e4e0), 8.2, 0.55, -10.4, office));
  const bottle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.2, 0.5, 10),
    new THREE.MeshLambertMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.75 })
  );
  bottle.position.set(8.2, 1.35, -10.4);
  office.add(bottle);
  for (let i = 0; i < 2; i++) {
    caster(box(0.42, 0.7, 0.42, lam(i ? 0x4a7f5a : 0x3c4245), 8.2, 0.35, -8.8 - i * 0.7, office));
    box(0.46, 0.08, 0.46, lam(0x222827), 8.2, 0.72, -8.8 - i * 0.7, office);
  }

  /* ---- whiteboard on the east wall ---- */
  box(0.16, 1.6, 3.1, metalMat, 8.76, 1.9, -6.8, office);
  box(0.12, 1.5, 3.0, lam(0xfdfdfb), 8.7, 1.9, -6.8, office);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.3),
    new THREE.MeshBasicMaterial({
      map: textTexture("TRUST BOARD", { w: 560, h: 260, bg: "#fdfdfb", fg: "#2b2620", font: 84 }),
    })
  );
  board.rotation.y = -Math.PI / 2;
  board.position.set(8.63, 1.95, -6.8);
  office.add(board);
  for (let i = 0; i < 3; i++) {
    box(0.08, 0.04, 0.14, lam([0xd64545, 0x3c72c4, 0x2f9e6a][i]), 8.6, 1.35, -7.7 + i * 0.5, office);
  }

  /* ---- meeting table ---- */
  caster(box(2.6, 0.09, 1.3, lam(0xd2c3a6), -1.4, 0.74, -5.8, office));
  for (const [lx, lz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) {
    box(0.08, 0.7, 0.08, metalMat, -1.4 + lx, 0.36, -5.8 + lz, office);
  }
  function taskChair(x, z, ry) {
    const ch = caster(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.08, 0.55), chairMat));
    ch.position.set(x, 0.45, z);
    ch.rotation.y = ry;
    const bk = caster(box(0.55, 0.5, 0.08, chairMat, x, 0.72, z, office));
    bk.position.set(x - Math.sin(ry) * 0.24, 0.72, z - Math.cos(ry) * 0.24);
    bk.rotation.y = ry;
    cyl(0.05, 0.05, 0.4, metalMat, x, 0.24, z, office, 6);
  }
  taskChair(-1.4, -4.75, 0);
  taskChair(-1.4, -6.85, Math.PI);
  taskChair(-2.95, -5.8, Math.PI / 2);
  taskChair(0.15, -5.8, -Math.PI / 2);

  /* ---- breakout corner (south-west) ---- */
  const sofaMat = lam(0x7d9184);
  caster(box(2.2, 0.42, 0.9, sofaMat, -6.6, 0.32, -3.6, office));
  caster(box(2.2, 0.6, 0.24, sofaMat, -6.6, 0.72, -4.02, office));
  for (const sx of [-7.6, -5.6]) caster(box(0.24, 0.5, 0.9, sofaMat, sx, 0.5, -3.6, office));
  caster(box(1.1, 0.08, 0.6, lam(0x8a6f4e), -6.6, 0.42, -2.6, office));
  for (const [lx, lz] of [[-0.45, -0.2], [0.45, -0.2], [-0.45, 0.2], [0.45, 0.2]]) {
    box(0.06, 0.4, 0.06, metalMat, -6.6 + lx, 0.2, -2.6 + lz, office);
  }
  const officeRug = receiver(new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.2), lam(0xbfae90)));
  officeRug.rotation.x = -Math.PI / 2;
  officeRug.position.set(-6.2, 0.016, -3.7);
  office.add(officeRug);

  /* ---- plants, extinguisher, first aid ---- */
  function indoorPlant(x, z, s = 1) {
    caster(cyl(0.24 * s, 0.19 * s, 0.42 * s, lam(0xb5714f), x, 0.21 * s, z, office, 10));
    cyl(0.025, 0.025, 0.5 * s, lam(0x4a6b3a), x, 0.6 * s, z, office, 5);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 8, 6), lam(i % 2 ? 0x4f7a3c : 0x5d8a48));
      leaf.scale.set(0.55, 1.3, 0.55);
      leaf.position.set(x + Math.sin(a) * 0.2 * s, (0.8 + (i % 2) * 0.28) * s, z + Math.cos(a) * 0.2 * s);
      leaf.rotation.z = Math.sin(a) * 0.4;
      leaf.rotation.x = Math.cos(a) * 0.4;
      caster(leaf);
    }
  }
  indoorPlant(8.2, -4.6, 1.1);
  indoorPlant(-8.2, -13.6, 1.0);
  indoorPlant(0.2, -13.9, 0.9);
  caster(cyl(0.1, 0.1, 0.5, lam(0xc23b2e), -8.5, 0.7, -10.5, office, 8));
  box(0.3, 0.36, 0.1, lam(0xfdfdfb), -8.5, 1.7, -10.5, office);
  box(0.18, 0.06, 0.04, lam(0x2f9e6a), -8.5, 1.7, -10.43, office);
  box(0.06, 0.18, 0.04, lam(0x2f9e6a), -8.5, 1.7, -10.43, office);

  /* ================================ world state ==============================
   * Decisions taken in the policy phase push these numbers, and the campus
   * physically responds: grass and foliage dry out, the lake shrinks, the sky
   * hazes over, smoke appears, and the turbines spin harder under load. */

  const HEALTHY_GRASS = new THREE.Color(0x86a862);
  const DEAD_GRASS = new THREE.Color(0x9a8a54);
  const HEALTHY_LEAF = [0x4f7a3c, 0x5d8a48, 0x446b34].map((h) => new THREE.Color(h));
  const DEAD_LEAF = new THREE.Color(0x7d6a3c);
  const CLEAR_SKY = new THREE.Color(0x9fc4de);
  const HAZE_SKY = new THREE.Color(0xc9b79a);
  const tmpColour = new THREE.Color();

  function setWorldState(s) {
    if (!s) return;
    const env = THREE.MathUtils.clamp(s.environment ?? 68, 0, 100) / 100;

    // grass + foliage dry out as the environment drops
    tmpColour.copy(DEAD_GRASS).lerp(HEALTHY_GRASS, env);
    stateRefs.grassMat.color.copy(tmpColour);
    for (const m of stateRefs.leafMats) m.color.copy(DEAD_LEAF).lerp(HEALTHY_LEAF[env > 0.5 ? 0 : 1], 0.25 + env * 0.75);

    // the sky follows the environment: clear blue -> smoggy tan.
    // NB: Color.lerp takes (color, alpha) — exactly two args. Passing three
    // made the fog colour NaN and blacked out the whole render.
    paintSky(
      CLEAR_SKY.clone().lerp(HAZE_SKY, 1 - env).getHex(),
      new THREE.Color(0xe8ecdf).lerp(new THREE.Color(0xd6c3a4), 1 - env).getHex()
    );
    scene.fog.color.lerp(new THREE.Color(0xd8c8ad), 1 - env);

    // the lake and pond shrink as water is drawn down
    const w = 0.35 + (THREE.MathUtils.clamp(s.water ?? 100, 0, 100) / 100) * 0.65;
    for (const p of stateRefs.waterPlanes) p.scale.set(w, w, 1);

    // smoke when the facility is in trouble
    const bad = 1 - THREE.MathUtils.clamp(s.reliability ?? 86, 0, 100) / 100;
    const smoke = THREE.MathUtils.clamp((bad - 0.35) / 0.5, 0, 1);
    stateRefs.smokeGroup.visible = smoke > 0.01;
    smokeMat.opacity = smoke * 0.55;
    smokeGroup.scale.setScalar(0.7 + smoke * 0.6);

    // grid load drives the turbines
    const load = THREE.MathUtils.clamp(s.load ?? 42, 0, 100) / 100;
    stateRefs.turbineSpeed = 0.5 + load * 2.6;

    // the village turns: protest signs, then boarded-up buildings
    const acc = THREE.MathUtils.clamp(s.acceptance ?? 52, 0, 100) / 100;
    stateRefs.protestGroup.visible = acc < 0.42;
    stateRefs.boards.visible = acc < 0.24;
  }

  /* --------------------------- markers + player -------------------------- */
  const markerMat = basic(0xd97b2b);
  function marker() {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), markerMat.clone());
    m.rotation.x = Math.PI;
    scene.add(m);
    return m;
  }
  const doorMarker = marker();
  doorMarker.position.set(0, 4.9, 2.6);
  const deskMarker = marker();
  deskMarker.position.set(MY_DESK.x, 2.9, MY_DESK.z);
  deskMarker.visible = false;

  let player = createMii({ ...DEFAULT_LOOK });
  scene.add(player);

  function setPlayerOptions(opts) {
    // rebuild in place — same group, same animation state, no disposal dance
    player.userData.rebuild(opts);
  }

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 260);
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  /* -------------------------------- state -------------------------------- */
  const DOOR_PT = new THREE.Vector3(0, 0, 1.8);
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
    if (p === "street") player.position.set(0, 0, 7.5);
    else player.position.set(0, 0, -4);
    onPrompt(null);
  }

  function setDayTint(day) {
    const p = PALETTES[(day - 1) % PALETTES.length];
    paintSky(p.sky[0], p.sky[1]);
    scene.fog.color.setHex(p.fog);
    hemi.color.setHex(p.hemi[0]);
    hemi.groundColor.setHex(p.hemi[1]);
    hemi.intensity = p.hemi[2] * 0.68;
    sun.color.setHex(p.sun);
    sun.intensity = p.sunI;
    sunOffset.set(p.sunPos[0], p.sunPos[1], p.sunPos[2]);
    groundMat.color.setHex(p.ground);
  }

  function nearestTarget() {
    if (phase === "street") {
      const d = Math.hypot(player.position.x - DOOR_PT.x, player.position.z - DOOR_PT.z);
      if (d < 2.4) return { id: "door", label: "Enter the datacenter" };
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

  const camOffsetStreet = new THREE.Vector3(0, 5.8, 13.2);
  const camOffsetOffice = new THREE.Vector3(0, 7.0, 7.4);
  const lookTmp = new THREE.Vector3();
  const sunOffset = new THREE.Vector3(-26, 20, 16);
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
      player.position.x = THREE.MathUtils.clamp(player.position.x, -20, 20);
      player.position.z = THREE.MathUtils.clamp(player.position.z, 0.8, 24);
    } else {
      player.position.x = THREE.MathUtils.clamp(player.position.x, -8, 8);
      player.position.z = THREE.MathUtils.clamp(player.position.z, -11.5, -3);
    }

    // idle animation: markers bob, LEDs blink, door pulses, turbines + clouds drift
    doorMarker.position.y = 4.9 + Math.sin(t * 2.4) * 0.2;
    deskMarker.position.y = 2.9 + Math.sin(t * 2.4) * 0.2;
    doorMarker.rotation.y = t;
    deskMarker.rotation.y = t;
    doorMat.color.setHSL(0.42, 0.6, 0.32 + Math.sin(t * 3) * 0.06);
    for (const led of leds) {
      const on = Math.sin(t * 3 + led.userData.off) > -0.2;
      led.material.color.setHex(on ? 0x7cf2b0 : 0x2c3831);
    }
    if (myScreen) myScreen.material.color.setHSL(0.42, 0.45, 0.62 + Math.sin(t * 5) * 0.05);
    for (const h of turbineHubs) h.rotation.z += dt * (stateRefs.turbineSpeed ?? 1.5);
    for (const c of clouds) {
      c.position.x += dt * 0.5;
      if (c.position.x > 95) c.position.x = -95;
    }

    // camera follow — shallow 3/4 angle so the horizon and backdrop stay in frame
    const off = phase === "street" ? camOffsetStreet : camOffsetOffice;
    camera.position.lerp(
      lookTmp.copy(player.position).add(off),
      1 - Math.exp(-4 * dt)
    );
    camera.lookAt(player.position.x, phase === "office" ? 1.4 : 3.2, player.position.z);
    // keep the sky dome centred on the camera and the shadow box on the player
    skyDome.position.copy(camera.position);
    sun.position.copy(player.position).add(sunOffset);
    sun.target.position.set(player.position.x, 0, player.position.z);
    sun.target.updateMatrixWorld();

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
  setDayTint(1);
  camera.position.set(0, 6.4, 20.5);
  tick();

  return {
    setPhase,
    setDayTint,
    setWorldState,
    tryInteract,
    setPlayerOptions,
    teleport: (x, z) => player.position.set(x, 0, z),
    setPaused: (b) => { paused = b; if (!b) clock.getDelta(); },
    setVisible: (b) => { container.style.display = b ? "" : "none"; },
    getPhase: () => phase,
  };
}
