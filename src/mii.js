import * as THREE from "three";

/* Mii-style character, matched to the reference proportions:
 * giant round head, big oval eyes, angled brows, tiny nose nub,
 * straight-line mouth, bowl-cut fringe, A-angled arms with ball
 * hands, slim dark legs, rounded shoes.
 *
 * Fully customizable:
 *   skin, shirt, pants, shoes, hair (colours as hex)
 *   hairStyle: 'bowl' | 'bob' | 'afro' | 'buzz' | 'ponytail' | 'bald'
 *   faceShape: 'round' | 'slim' | 'wide'
 *   eyeStyle:  'oval' | 'dot' | 'happy' | 'sleepy'
 *   browStyle: 'classic' | 'angry' | 'soft'
 *   mouthStyle:'flat' | 'smile' | 'open'
 *
 * Cheap Lambert/Basic materials, grouped pivots for walk animation.
 * Returns THREE.Group with userData.update(dt, t, moving).
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
  const shadeMat = lam(new THREE.Color(skin).multiplyScalar(0.72).getHex());
  const inkMat = flat(0x141210);

  // Head metrics: skull r=0.45, z-squashed → front surface z ≈ 0.4275.
  // Every face piece sits proud of this so nothing sinks in.
  const HEAD_Y = 1.68;
  const HEAD_R = 0.45;
  const HEAD_Z = HEAD_R * 0.95;

  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);

  /* ---- soft blob shadow (no real shadow maps) ---- */
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  g.add(blob);

  /* ---- legs (pivot at hip) ---- */
  const HIP_Y = 0.66;
  function leg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.14 * side, HIP_Y, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.095, 0.46, 10), pantsMat);
    thigh.position.y = -0.23;
    pivot.add(thigh);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), shoesMat);
    shoe.scale.set(1, 0.7, 1.4);
    shoe.position.set(0, -0.5, 0.06);
    pivot.add(shoe);
    inner.add(pivot);
    return pivot;
  }
  const legL = leg(-1);
  const legR = leg(1);

  /* ---- torso ---- */
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.33, 0.6, 14), shirtMat);
  torso.position.y = 1.0;
  inner.add(torso);

  /* ---- arms ---- */
  const REST_Z = 0.28;
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(0.34 * side, 1.24, 0);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.09, 0.5, 10), shirtMat);
    sleeve.position.y = -0.25;
    pivot.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skinMat);
    hand.position.y = -0.55;
    pivot.add(hand);
    pivot.rotation.z = REST_Z * side;
    inner.add(pivot);
    return pivot;
  }
  const armL = arm(-1);
  const armR = arm(1);

  /* ---- head (scaled by face shape; hair rides along) ---- */
  const SHAPES = {
    round: [1, 1, 1],
    slim: [0.9, 1.07, 0.93],
    wide: [1.09, 0.94, 0.97],
  };
  const headG = new THREE.Group();
  headG.position.y = HEAD_Y;
  headG.scale.set(...(SHAPES[faceShape] || SHAPES.round));
  inner.add(headG);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 24, 18), skinMat);
  skull.scale.set(1, 1.02, 0.95);
  headG.add(skull);

  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), skinMat);
    ear.position.set(0.43 * s, -0.03, -0.01);
    headG.add(ear);
  }

  /* ---- eyes ---- */
  const eyes = [];
  const glints = [];
  if (eyeStyle === "happy") {
    // closed happy arches (∩)
    for (const s of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.018, 6, 12, Math.PI), inkMat);
      arch.position.set(0.165 * s, 0.0, HEAD_Z - 0.008);
      headG.add(arch);
    }
  } else if (eyeStyle === "dot") {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), inkMat);
      eye.scale.set(1, 1.1, 0.5);
      eye.position.set(0.165 * s, 0.02, HEAD_Z - 0.012);
      headG.add(eye);
      eyes.push(eye);
    }
  } else if (eyeStyle === "sleepy") {
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), inkMat);
      eye.scale.set(1, 0.9, 0.5);
      eye.position.set(0.165 * s, -0.01, HEAD_Z - 0.012);
      headG.add(eye);
      eyes.push(eye);
      // lid drooping over the top half
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.075, 0.04), skinMat);
      lid.position.set(0.165 * s, 0.045, HEAD_Z + 0.005);
      headG.add(lid);
    }
  } else {
    // oval: big vertical Mii ovals + glints
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 12), inkMat);
      eye.scale.set(1, 1.5, 0.5);
      eye.position.set(0.165 * s, 0.02, HEAD_Z - 0.012);
      headG.add(eye);
      eyes.push(eye);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), flat(0xffffff));
      glint.position.set(0.165 * s + 0.02, 0.055, HEAD_Z + 0.028);
      headG.add(glint);
      glints.push(glint);
    }
  }

  /* ---- brows ---- */
  if (browStyle !== "none") {
    const cfg = {
      classic: { w: 0.14, h: 0.032, y: 0.225, a: -0.14 },
      angry: { w: 0.155, h: 0.042, y: 0.21, a: 0.4 },
      soft: { w: 0.11, h: 0.02, y: 0.245, a: 0 },
    }[browStyle] || { w: 0.14, h: 0.032, y: 0.225, a: -0.14 };
    for (const s of [-1, 1]) {
      const brow = new THREE.Mesh(new THREE.BoxGeometry(cfg.w, cfg.h, 0.025), inkMat);
      brow.position.set(0.165 * s, cfg.y, HEAD_Z - 0.01);
      brow.rotation.z = cfg.a * s;
      headG.add(brow);
    }
  }

  /* ---- nose: tiny nub just off-centre ---- */
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.095, 0.035), shadeMat);
  nose.position.set(0.035, -0.055, HEAD_Z - 0.005);
  headG.add(nose);

  /* ---- mouth ---- */
  if (mouthStyle === "smile") {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14, Math.PI), inkMat);
    smile.rotation.z = Math.PI; // ∪
    smile.position.set(0, -0.16, HEAD_Z - 0.005);
    headG.add(smile);
  } else if (mouthStyle === "open") {
    const open = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), flat(0x2a1a14));
    open.scale.set(1, 1.3, 0.4);
    open.position.set(0, -0.21, HEAD_Z - 0.015);
    headG.add(open);
  } else {
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.026, 0.025), flat(0x2a1a14));
    mouth.position.set(0, -0.225, HEAD_Z - 0.008);
    headG.add(mouth);
  }

  /* ---- hair ---- */
  if (hairStyle === "bob") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.478, 20, 12, 0, Math.PI * 2, 0, 1.12),
      hairMat
    );
    cap.position.y = 0.055;
    headG.add(cap);
    const curtain = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.52, 0.24), hairMat);
    curtain.position.set(0, -0.2, -0.3);
    headG.add(curtain);
    for (const s of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.3, 4, 8), hairMat);
      lock.position.set(0.4 * s, -0.16, 0.04);
      headG.add(lock);
    }
  } else if (hairStyle === "afro") {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), hairMat);
    puff.position.set(0, 0.42, -0.03);
    puff.scale.set(1.08, 0.95, 1.05);
    headG.add(puff);
    for (const s of [-1, 1]) {
      const burn = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.2, 0.14), hairMat);
      burn.position.set(0.415 * s, -0.14, 0.06);
      headG.add(burn);
    }
  } else if (hairStyle === "buzz") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.459, 18, 12, 0, Math.PI * 2, 0, 1.25),
      hairMat
    );
    cap.position.y = 0.04;
    headG.add(cap);
  } else if (hairStyle === "ponytail") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.462, 18, 12, 0, Math.PI * 2, 0, 1.0),
      hairMat
    );
    cap.position.y = 0.05;
    headG.add(cap);
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.34, 4, 8), hairMat);
    tail.position.set(0, -0.08, -0.53);
    tail.rotation.x = -0.45;
    headG.add(tail);
    const tie = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), shadeMat);
    tie.position.set(0, 0.16, -0.44);
    headG.add(tie);
  } else if (hairStyle !== "bald") {
    // bowl (default): fringe cap ending above the brows + back cover + sideburns
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.478, 20, 12, 0, Math.PI * 2, 0, 1.12),
      hairMat
    );
    cap.position.y = 0.055;
    headG.add(cap);
    const back = new THREE.Mesh(
      new THREE.SphereGeometry(0.47, 18, 10, Math.PI * 0.62, Math.PI * 1.76, 1.0, 1.25),
      hairMat
    );
    back.position.y = 0.02;
    headG.add(back);
    for (const s of [-1, 1]) {
      const burn = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.24, 0.14), hairMat);
      burn.position.set(0.415 * s, -0.14, 0.06);
      headG.add(burn);
    }
  }

  /* ---- animation ---- */
  let walkPhase = 0;
  let blinkT = 2 + Math.random() * 2;
  const eyeBaseY = eyeStyle === "sleepy" ? 0.9 : eyeStyle === "dot" ? 1.1 : 1.5;

  g.userData.update = (dt, t, moving) => {
    if (moving) {
      walkPhase += dt * 10;
      const s = Math.sin(walkPhase);
      armL.rotation.x = s * 0.55;
      armR.rotation.x = -s * 0.55;
      legL.rotation.x = -s * 0.5;
      legR.rotation.x = s * 0.5;
      armL.rotation.z = REST_Z * -1;
      armR.rotation.z = REST_Z * 1;
      inner.position.y = Math.abs(Math.cos(walkPhase)) * 0.055;
      headG.rotation.x = 0.04;
      headG.rotation.y = 0;
    } else {
      const k = 1 - Math.exp(-8 * dt);
      armL.rotation.x += (0 - armL.rotation.x) * k;
      armR.rotation.x += (0 - armR.rotation.x) * k;
      legL.rotation.x += (0 - legL.rotation.x) * k;
      legR.rotation.x += (0 - legR.rotation.x) * k;
      armL.rotation.z += (REST_Z * -1 - armL.rotation.z) * k;
      armR.rotation.z += (REST_Z * 1 - armR.rotation.z) * k;
      inner.position.y = Math.sin(t * 2) * 0.012;
      headG.rotation.x = Math.sin(t * 1.4) * 0.02;
      headG.rotation.y = Math.sin(t * 0.6) * 0.06;
    }
    if (eyes.length) {
      blinkT -= dt;
      if (blinkT <= 0) blinkT = 2.4 + Math.random() * 2.4;
      const sy = blinkT < 0.12 ? 0.12 : eyeBaseY;
      for (const e of eyes) e.scale.y = sy;
    }
  };

  return g;
}
