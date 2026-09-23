import * as THREE from "three";

/* Mii-style character. Proportions are derived from the reference art at a
 * fixed scale of 2.10 units tall (reference figure ≈163px):
 *
 *   head   0.90 tall × 0.62 wide  → tall oval, NOT a ball
 *   torso  0.47 tall, 0.46 wide  → slim, straight shirt
 *   arms   reach to hip height, ~8° out from vertical
 *   legs   0.44 long, slim, rounded shoes
 *
 * Fully customizable:
 *   skin, shirt, pants, shoes, hair          (hex colours)
 *   hairStyle  'bowl' | 'bob' | 'afro' | 'buzz' | 'ponytail' | 'bald'
 *   faceShape 'round' | 'slim' | 'wide'      (scales the whole head)
 *   eyeStyle  'oval' | 'dot' | 'happy' | 'sleepy'
 *   browStyle 'classic' | 'angry' | 'soft'
 *   mouthStyle 'flat' | 'smile' | 'open'
 *
 * Cheap Lambert/Basic materials and grouped pivots so world.js can swing
 * the limbs. Returns a THREE.Group with userData.update(dt, t, moving).
 */

export function createMii(options = {}) {
  const {
    skin = 0x7b4c2d,
    shirt = 0xd6503c,
    pants = 0x333945,
    shoes = 0x23242a,
    hair = 0x4a2c14,
    hairStyle = "bowl",
    faceShape = "round",
    eyeStyle = "oval",
    browStyle = "classic",
    mouthStyle = "flat",
  } = options;

  const lam = (color) => new THREE.MeshLambertMaterial({ color });
  const flat = (color) => new THREE.MeshBasicMaterial({ color });
  const skinMat = lam(skin);
  const shirtMat = lam(shirt);
  const pantsMat = lam(pants);
  const shoesMat = lam(shoes);
  const hairMat = lam(hair);
  const noseMat = lam(new THREE.Color(skin).multiplyScalar(0.86).getHex());
  const inkMat = flat(0x141210);
  const mouthMat = flat(0x3a2018);

  /* ---- head metrics (single source of truth) ---- */
  const HEAD_Y = 1.55;
  const RX = 0.31, RY = 0.45, RZ = 0.27;
  // surface z of the head at a given (x, y) so features hug the curve
  const faceZ = (x, y) =>
    RZ * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2 - (y / RY) ** 2));

  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);

  /* ---- contact shadow (fake, no shadow maps) ---- */
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 16),
    new THREE.MeshBasicMaterial({ color: 0x2b2620, transparent: true, opacity: 0.13 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.015;
  g.add(blob);

  /* ---- shoes: rounded, toe pointing forward ---- */
  for (const s of [-1, 1]) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), shoesMat);
    shoe.scale.set(0.09, 0.075, 0.155);
    shoe.position.set(0.105 * s, 0.072, 0.045);
    shoe.rotation.y = 0.14 * s; // toes out a touch
    inner.add(shoe);
  }

  /* ---- legs: pivot at the hip (y 0.58) ---- */
  const HIP_Y = 0.58;
  function leg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.105 * side, HIP_Y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.42, 10), pantsMat);
    limb.position.y = -0.21;
    pivot.add(limb);
    inner.add(pivot);
    return pivot;
  }
  const legL = leg(-1);
  const legR = leg(1);

  /* ---- torso: slim straight shirt, slight A-line ---- */
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.245, 0.47, 16), shirtMat);
  torso.position.y = 0.815;
  inner.add(torso);
  // collar hint so the neck doesn't look like a peg
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 6, 14), shirtMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.045;
  inner.add(collar);

  /* ---- arms: hang to hip height, angled slightly out ---- */
  const REST_Z = 0.17;
  const SHOULDER_Y = 1.0;
  const SHOULDER_X = 0.205;
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(SHOULDER_X * side, SHOULDER_Y, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, 0.3, 10), shirtMat);
    sleeve.position.y = -0.15;
    pivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skinMat);
    hand.scale.set(1, 0.92, 1);
    hand.position.set(0.028 * side, -0.33, 0);
    pivot.add(hand);
    pivot.rotation.z = REST_Z * side;
    inner.add(pivot);
    return pivot;
  }
  const armL = arm(-1);
  const armR = arm(1);

  /* ---- neck (mostly tucked under the big head) ---- */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 10), skinMat);
  neck.position.y = 1.09;
  inner.add(neck);

  /* ---- head ---- */
  const SHAPES = {
    round: [1, 1, 1],
    slim: [0.92, 1.05, 0.96],
    wide: [1.08, 0.95, 0.98],
  };
  const headG = new THREE.Group();
  headG.position.y = HEAD_Y;
  headG.scale.set(...(SHAPES[faceShape] || SHAPES.round));
  inner.add(headG);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), skinMat);
  skull.scale.set(RX, RY, RZ);
  headG.add(skull);

  // ears: small, tucked at the head edge, mostly framed by hair
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), skinMat);
    ear.scale.set(0.05, 0.08, 0.04);
    ear.position.set(0.292 * s, -0.07, -0.02);
    headG.add(ear);
  }

  /* ---- eyes: big Mii ovals, wide apart, just below centre ---- */
  const EYE_X = 0.142, EYE_Y = -0.05;
  const eyes = [];
  if (eyeStyle === "happy") {
    for (const s of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 6, 14, Math.PI), inkMat);
      arch.position.set(EYE_X * s, EYE_Y + 0.01, faceZ(EYE_X * s, EYE_Y) - 0.004);
      headG.add(arch);
    }
  } else if (eyeStyle === "dot") {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), inkMat);
      eye.scale.set(1, 1.15, 0.5);
      eye.position.set(EYE_X * s, EYE_Y + 0.01, faceZ(EYE_X * s, EYE_Y) - 0.006);
      headG.add(eye);
      eyes.push(eye);
    }
  } else if (eyeStyle === "sleepy") {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 12), inkMat);
      eye.scale.set(1, 0.95, 0.5);
      eye.position.set(EYE_X * s, EYE_Y - 0.005, faceZ(EYE_X * s, EYE_Y) - 0.006);
      headG.add(eye);
      eyes.push(eye);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.1), skinMat);
      lid.scale.set(0.058, 0.058, 0.03);
      lid.position.set(EYE_X * s, EYE_Y + 0.02, faceZ(EYE_X * s, EYE_Y) - 0.004);
      headG.add(lid);
    }
  } else {
    for (const s of [-1, 1]) {
      const x = EYE_X * s;
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 12), inkMat);
      eye.scale.set(1, 1.48, 0.5);
      eye.position.set(x, EYE_Y, faceZ(x, EYE_Y) - 0.008);
      headG.add(eye);
      eyes.push(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), flat(0xffffff));
      glint.position.set(x + 0.018, EYE_Y + 0.032, faceZ(x, EYE_Y) + 0.018);
      headG.add(glint);
    }
  }

  /* ---- brows: thick slashes just above the eyes ---- */
  if (browStyle !== "none") {
    const cfg = {
      classic: { w: 0.115, h: 0.038, y: 0.062, a: -0.13 },
      angry: { w: 0.13, h: 0.046, y: 0.05, a: 0.42 },
      soft: { w: 0.095, h: 0.022, y: 0.082, a: 0.05 },
    }[browStyle] || { w: 0.115, h: 0.038, y: 0.062, a: -0.13 };
    for (const s of [-1, 1]) {
      const x = EYE_X * s;
      const brow = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, 0.024), inkMat);
      brow.position.set(x, cfg.y, faceZ(x, cfg.y) - 0.004);
      brow.rotation.z = cfg.a * s;
      headG.add(brow);
    }
  }

  /* ---- nose: small vertical nub, off-centre like the reference ---- */
  const NOSE_Y = -0.12;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.028), noseMat);
  nose.position.set(0.022, NOSE_Y + 0.02, faceZ(0.022, NOSE_Y) - 0.004);
  headG.add(nose);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 8), noseMat);
  noseTip.position.set(0.022, NOSE_Y - 0.04, faceZ(0.022, NOSE_Y) + 0.006);
  headG.add(noseTip);

  /* ---- mouth: straight line low on the face ---- */
  const MOUTH_Y = -0.268;
  if (mouthStyle === "smile") {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 16, Math.PI), mouthMat);
    smile.rotation.z = Math.PI;
    smile.position.set(0, MOUTH_Y + 0.06, faceZ(0, MOUTH_Y + 0.06) - 0.004);
    headG.add(smile);
  } else if (mouthStyle === "open") {
    const open = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), mouthMat);
    open.scale.set(1.2, 1.35, 0.45);
    open.position.set(0, MOUTH_Y, faceZ(0, MOUTH_Y) - 0.012);
    headG.add(open);
  } else {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.024, 0.022), mouthMat);
    mouth.position.set(0, MOUTH_Y, faceZ(0, MOUTH_Y) - 0.004);
    headG.add(mouth);
  }

  /* ---- hair: ellipsoid shells so every style hugs the oval head ---- */
  const HS = 1.055; // hair sits just proud of the skull
  function shell(thetaStart, thetaLength, phiStart = 0, phiLength = Math.PI * 2, r = HS) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 14, phiStart, phiLength, thetaStart, thetaLength), hairMat);
    m.scale.set(RX * r, RY * r, RZ * r);
    return m;
  }
  // crown sits high, then a separate fringe band sweeps down over the
  // forehead to just above the brows — that's the Mii bowl silhouette.
  const CROWN = 1.12;          // y ≈ 0.21
  const FRINGE_END = 1.43;     // y ≈ 0.07, just above the brows
  const FRONT = Math.PI / 2;   // +Z
  const FRINGE_ARC = 1.25;     // how far the fringe wraps toward the temples
  const BACK_PHI = Math.PI;
  const BACK_LEN = Math.PI;

  if (hairStyle === "bowl") {
    headG.add(shell(0, CROWN));
    headG.add(shell(CROWN - 0.06, FRINGE_END - CROWN + 0.06, FRONT - FRINGE_ARC, FRINGE_ARC * 2));
    headG.add(shell(CROWN - 0.14, 1.72, BACK_PHI, BACK_LEN));
    // sideburns hide the ears, in front of them
    for (const s of [-1, 1]) {
      const burn = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.27, 0.17), hairMat);
      burn.position.set(0.278 * s, -0.1, 0.055);
      headG.add(burn);
    }
  } else if (hairStyle === "bob") {
    headG.add(shell(0, CROWN));
    headG.add(shell(CROWN - 0.06, FRINGE_END + 0.24 - CROWN, FRONT - FRINGE_ARC - 0.2, (FRINGE_ARC + 0.2) * 2));
    headG.add(shell(CROWN - 0.14, 1.9, Math.PI / 2 - 0.55, Math.PI + 1.1, HS * 1.02));
    for (const s of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), hairMat);
      lock.position.set(0.275 * s, -0.2, 0.07);
      headG.add(lock);
    }
  } else if (hairStyle === "afro") {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), hairMat);
    puff.scale.set(RX * 1.3, RY * 1.14, RZ * 1.3);
    puff.position.y = 0.1;
    headG.add(puff);
    headG.add(shell(1.6, 0.45, 0, Math.PI * 2, 1.02));
  } else if (hairStyle === "buzz") {
    headG.add(shell(0, 1.68, 0, Math.PI * 2, 1.03));
  } else if (hairStyle === "ponytail") {
    headG.add(shell(0, CROWN + 0.12, 0, Math.PI * 2, 1.04));
    headG.add(shell(CROWN - 0.1, 1.1, BACK_PHI, BACK_LEN, 1.04));
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), noseMat);
    tie.position.set(0, 0.0, -RZ * 1.05);
    headG.add(tie);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.28, 4, 8), hairMat);
    tail.position.set(0, -0.26, -RZ * 1.0);
    tail.rotation.x = -0.4;
    headG.add(tail);
  } else if (hairStyle === "spiky") {
    headG.add(shell(0, CROWN - 0.16));
    headG.add(shell(CROWN - 0.22, 0.3, FRONT - 1.4, 2.8));
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + i * 0.45;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.19, 6), hairMat);
      spike.position.set(Math.sin(a) * RX * 0.8, RY * 0.88, Math.cos(a) * RZ * 0.8 - 0.02);
      spike.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
      headG.add(spike);
    }
  }
  // 'bald' adds nothing

  /* ---- animation ---- */
  let walkPhase = 0;
  let blinkT = 1.5 + Math.random() * 2;
  const eyeBaseY = eyeStyle === "sleepy" ? 0.95 : eyeStyle === "dot" ? 1.15 : 1.48;

  g.userData.update = (dt, t, moving) => {
    if (moving) {
      walkPhase += dt * 11;
      const s = Math.sin(walkPhase);
      armL.rotation.x = s * 0.5;
      armR.rotation.x = -s * 0.5;
      legL.rotation.x = -s * 0.42;
      legR.rotation.x = s * 0.42;
      armL.rotation.z = REST_Z * -1;
      armR.rotation.z = REST_Z * 1;
      inner.position.y = Math.abs(Math.cos(walkPhase)) * 0.045;
      torso.rotation.x = 0.03;
      headG.rotation.x = 0.02;
      headG.rotation.y = 0;
    } else {
      const k = 1 - Math.exp(-8 * dt);
      armL.rotation.x += (0 - armL.rotation.x) * k;
      armR.rotation.x += (0 - armR.rotation.x) * k;
      legL.rotation.x += (0 - legL.rotation.x) * k;
      legR.rotation.x += (0 - legR.rotation.x) * k;
      armL.rotation.z += (REST_Z * -1 - armL.rotation.z) * k;
      armR.rotation.z += (REST_Z * 1 - armR.rotation.z) * k;
      inner.position.y = Math.sin(t * 1.8) * 0.008;
      torso.rotation.x = 0;
      // gentle idle head drift keeps him from looking frozen
      headG.rotation.x = Math.sin(t * 1.3) * 0.018;
      headG.rotation.y = Math.sin(t * 0.55) * 0.07;
    }
    if (eyes.length) {
      blinkT -= dt;
      if (blinkT <= 0) blinkT = 2.2 + Math.random() * 2.6;
      for (const e of eyes) e.scale.y = blinkT < 0.11 ? 0.12 : eyeBaseY;
    }
  };

  return g;
}
