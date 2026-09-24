import * as THREE from "three";

/* ============================================================================
   MII CHARACTER — single source of truth
   ----------------------------------------------------------------------------
   HOW TO EDIT ANYTHING:
     1. SPEC        every proportion of the body. Change one number, done.
     2. HAIR        per-haircut geometry + where it sits.
     3. FACE        per-eye / brow / mouth shape.
     4. PALETTE     the colours the character creator offers.
     5. WALK        walk-cycle tuning (swing, speed, bob).

   After editing, call  model.userData.rebuild()  to apply instantly, or
   just reload. Every moving part is named in  model.userData.parts
   (e.g. parts.legL.userData.shoe) so you can target it from the console.
   ========================================================================== */

/* ---------------------------------------------------------------- proportions */
export const SPEC = {
  total: 2.0, // overall height, feet to crown

  leg: {
    hipY: 0.58, // pivot height
    hipX: 0.105, // how far apart the legs sit
    len: 0.48,
    topR: 0.075,
    bottomR: 0.062,
  },
  shoe: {
    w: 0.092,
    h: 0.078,
    d: 0.16,
    drop: 0.508, // below the hip pivot
    toeOut: 0.14, // radians
    footFlat: 0.85, // how much the sole counter-rotates while walking
  },

  torso: {
    y: 0.815,
    h: 0.47,
    topR: 0.225,
    bottomR: 0.245,
  },

  arm: {
    shoulderY: 1.0,
    shoulderX: 0.205,
    len: 0.3,
    topR: 0.062,
    bottomR: 0.052,
    restAngle: 0.17, // A-pose, radians out from vertical
    handR: 0.085,
    handDrop: 0.33,
    handOut: 0.028,
  },

  neck: { y: 1.09, h: 0.14, r: 0.08 },
  head: { y: 1.55, rx: 0.335, ry: 0.435, rz: 0.285 },

  ear: { x: 0.315, y: -0.07, z: -0.02, w: 0.05, h: 0.08, d: 0.04 },

  /* face placement, in head-local space */
  face: {
    eyeX: 0.15, // how far out the eyes sit
    eyeY: -0.045,
    eyeR: 0.052, // classic oval
    browY: 0.055,
    browW: 0.12,
    browH: 0.038,
    noseY: -0.12,
    noseH: 0.1,
    noseW: 0.03,
    mouthY: -0.255,
    mouthW: 0.16,
  },

  hair: {
    lift: 1.1, // how far the hair shell sits off the skull.
    //   MUST stay >= 1.06 or the hair sinks into the head.
    crown: 1.12, // top cap depth (radians from the top)
    fringe: 1.36, // fringe band depth — lower value = fringe covers more forehead
    fringeArc: 1.25, // how far the fringe wraps toward the temples
    sideArc: 0.7, // half-gap left open at the front (smaller = hair lower on the sides)
    backDepth: 1.72,
  },
};

/* ------------------------------------------------------------- face variants */
export const FACE = {
  shape: {
    round: [1, 1, 1],
    slim: [0.92, 1.05, 0.96],
    wide: [1.08, 0.95, 0.98],
  },
  eyes: {
    oval: { r: 0.052, stretch: 1.48 },
    dot: { r: 0.04, stretch: 1.15 },
    happy: null, // handled specially (closed arches)
    sleepy: { r: 0.052, stretch: 0.95 },
  },
  brows: {
    classic: { w: 0.12, h: 0.038, y: 0.055, angle: -0.13 },
    angry: { w: 0.135, h: 0.046, y: 0.045, angle: 0.42 },
    soft: { w: 0.1, h: 0.022, y: 0.075, angle: 0.05 },
  },
  mouth: {
    flat: null, // box
    smile: { r: 0.075, tube: 0.016, rise: 0.06 },
    open: { r: 0.05, stretch: [1.2, 1.35] },
  },
};

/* ------------------------------------------------------------ haircut styles */
export const HAIR = {
  // crown + fringe bands come from SPEC.hair; each style adds its own extras
  bowl: {},
  spiky: { spikes: 9, spikeR: 0.055, spikeH: 0.24, ring: 0.72, frontGap: 0.8 },
  bob: { locks: 0.055, lockLen: 0.3, lockX: 0.305, lockY: -0.2 },
  afro: { lift: 1.3, crown: 1.15, depth: 2.05, gap: 0.72 },
  buzz: { cap: 1.68, lift: 1.03 },
  ponytail: { tailR: 0.05, tailLen: 0.28, tailY: -0.26, lift: 1.04 },
  bald: {},
};

/* --------------------------------------------------------------- walk cycle */
export const WALK = {
  speed: 11, // radians per second
  armSwing: 0.5,
  legSwing: 0.42,
  bob: 0.045,
  lean: 0.03,
  smooth: 8, // how fast limbs ease back to rest
};

/* ------------------------------------------------------------------ palette */
export const PALETTE = {
  skin: [
    ["Porcelain", 0xf5cfa5], ["Sand", 0xe8b88a], ["Honey", 0xc98e5f],
    ["Bronze", 0x9a6238], ["Umber", 0x7b4c2d], ["Espresso", 0x4e2f1c],
  ],
  hairColour: [
    ["Black", 0x1c1a18], ["Brown", 0x4a2c14], ["Auburn", 0x7a3a16],
    ["Blond", 0xc99a3c], ["Ginger", 0xb34a2e], ["Grey", 0x9a9a9a],
  ],
  shirt: [
    ["Red", 0xd6503c], ["Blue", 0x2e7dc9], ["Green", 0x1e9e6a],
    ["Purple", 0x7a4fc9], ["Gold", 0xe8a33c], ["Cream", 0xe8e2d4], ["Ink", 0x333945],
  ],
  pants: [
    ["Slate", 0x333945], ["Black", 0x23242a], ["Denim", 0x4a6076],
    ["Khaki", 0x9a7f4e], ["Olive", 0x5a5e33],
  ],
  hairStyle: [
    ["bowl", "Bowl"], ["spiky", "Spiky"], ["bob", "Bob"], ["afro", "Afro"],
    ["buzz", "Buzz"], ["ponytail", "Pony"], ["bald", "Bald"],
  ],
  faceShape: [["round", "Round"], ["slim", "Slim"], ["wide", "Wide"]],
  eyeStyle: [["oval", "Classic"], ["dot", "Dots"], ["happy", "Happy"], ["sleepy", "Sleepy"]],
  browStyle: [["classic", "Classic"], ["angry", "Angry"], ["soft", "Soft"]],
  mouthStyle: [["flat", "Flat"], ["smile", "Smile"], ["open", "Open"]],
};

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

/* ============================================================================
   builder
   ========================================================================== */

export function createMii(options = {}) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); // everything that bobs while walking
  g.add(inner);
  g.userData.parts = {};
  g.userData.look = { ...DEFAULT_LOOK, ...options };

  // contact shadow (fake, no shadow maps)
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.36, 16),
    new THREE.MeshBasicMaterial({ color: 0x2b2620, transparent: true, opacity: 0.13 })
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.015;
  g.add(blob);

  const mats = {};
  const lam = (color) => new THREE.MeshLambertMaterial({ color });
  const flat = (color) => new THREE.MeshBasicMaterial({ color });

  /** Rebuild every mesh in place from the current look. Safe to call live. */
  g.userData.rebuild = (next = {}) => {
    Object.assign(g.userData.look, next);
    const L = g.userData.look;

    // dispose old meshes so repeated rebuilds don't leak
    for (let i = inner.children.length - 1; i >= 0; i--) {
      const c = inner.children[i];
      c.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      inner.remove(c);
    }
    g.userData.parts = {};

    // materials for this look
    mats.skin = lam(L.skin);
    mats.shirt = lam(L.shirt);
    mats.pants = lam(L.pants);
    mats.shoes = lam(0x23242a);
    mats.hair = lam(L.hair);
    mats.nose = lam(new THREE.Color(L.skin).multiplyScalar(0.86).getHex());
    mats.ink = flat(0x141210);
    mats.mouth = flat(0x3a2018);
    mats.white = flat(0xffffff);
    mats.shirtLit = mats.shirt;

    const P = g.userData.parts;
    const S = SPEC;

    /* ---- legs: pivot at the hip, shoe is a CHILD so it swings with the leg -- */
    const buildLeg = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(S.leg.hipX * side, S.leg.hipY, 0);
      const limb = new THREE.Mesh(
        new THREE.CylinderGeometry(S.leg.topR, S.leg.bottomR, S.leg.len, 10),
        mats.pants
      );
      limb.position.y = -S.leg.len / 2;
      pivot.add(limb);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.shoes);
      shoe.scale.set(S.shoe.w, S.shoe.h, S.shoe.d);
      shoe.position.set(0, -S.shoe.drop, 0.05);
      shoe.rotation.y = S.shoe.toeOut * side;
      pivot.add(shoe);
      pivot.userData.shoe = shoe;
      inner.add(pivot);
      return pivot;
    };
    P.legL = buildLeg(-1);
    P.legR = buildLeg(1);

    /* ---- torso ---- */
    P.torso = new THREE.Mesh(
      new THREE.CylinderGeometry(S.torso.topR, S.torso.bottomR, S.torso.h, 16),
      mats.shirt
    );
    P.torso.position.y = S.torso.y;
    inner.add(P.torso);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 6, 14), mats.shirt);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = S.arm.shoulderY + 0.045;
    inner.add(collar);

    /* ---- arms ---- */
    const buildArm = (side) => {
      const pivot = new THREE.Group();
      pivot.position.set(S.arm.shoulderX * side, S.arm.shoulderY, 0);
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(S.arm.topR, S.arm.bottomR, S.arm.len, 10),
        mats.shirt
      );
      sleeve.position.y = -S.arm.len / 2;
      pivot.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(S.arm.handR, 12, 10), mats.skin);
      hand.scale.set(1, 0.92, 1);
      hand.position.set(S.arm.handOut * side, -S.arm.handDrop, 0);
      pivot.add(hand);
      pivot.rotation.z = S.arm.restAngle * side;
      pivot.userData.hand = hand;
      inner.add(pivot);
      return pivot;
    };
    P.armL = buildArm(-1);
    P.armR = buildArm(1);

    /* ---- neck ---- */
    P.neck = new THREE.Mesh(
      new THREE.CylinderGeometry(S.neck.r * 0.92, S.neck.r, S.neck.h, 10),
      mats.skin
    );
    P.neck.position.y = S.neck.y;
    inner.add(P.neck);

    /* ---- head ---- */
    P.head = new THREE.Group();
    P.head.position.y = S.head.y;
    P.head.scale.set(...(FACE.shape[L.faceShape] || FACE.shape.round));
    inner.add(P.head);

    P.skull = new THREE.Mesh(new THREE.SphereGeometry(1, 26, 20), mats.skin);
    P.skull.scale.set(S.head.rx, S.head.ry, S.head.rz);
    P.head.add(P.skull);

    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mats.skin);
      ear.scale.set(S.ear.w, S.ear.h, S.ear.d);
      ear.position.set(S.ear.x * s, S.ear.y, S.ear.z);
      P.head.add(ear);
    }

    // surface z of the head at (x, y) so features hug the curve instead of
    // floating off it (this is what stopped the old face sinking in)
    const faceZ = (x, y) =>
      S.head.rz * Math.sqrt(Math.max(0, 1 - (x / S.head.rx) ** 2 - (y / S.head.ry) ** 2));
    P.faceZ = faceZ;

    /* ---- eyes ---- */
    P.eyes = [];
    const eyeCfg = FACE.eyes[L.eyeStyle] ?? FACE.eyes.oval;
    for (const s of [-1, 1]) {
      const x = S.face.eyeX * s;
      if (L.eyeStyle === "happy") {
        const arch = new THREE.Mesh(
          new THREE.TorusGeometry(0.05, 0.016, 6, 14, Math.PI),
          mats.ink
        );
        arch.position.set(x, S.face.eyeY + 0.01, faceZ(x, S.face.eyeY) - 0.004);
        P.head.add(arch);
        continue;
      }
      const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeCfg.r, 14, 12), mats.ink);
      eye.scale.set(1, eyeCfg.stretch, 0.5);
      eye.position.set(x, S.face.eyeY, faceZ(x, S.face.eyeY) - 0.008);
      P.head.add(eye);
      P.eyes.push(eye);

      if (L.eyeStyle === "sleepy") {
        const lid = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, 1.1), mats.skin);
        lid.scale.set(eyeCfg.r * 1.1, eyeCfg.r * 1.1, 0.03);
        lid.position.set(x, S.face.eyeY + 0.02, faceZ(x, S.face.eyeY) - 0.004);
        P.head.add(lid);
      } else {
        const glint = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), mats.white);
        glint.position.set(x + 0.018, S.face.eyeY + 0.032, faceZ(x, S.face.eyeY) + 0.018);
        P.head.add(glint);
      }
    }

    /* ---- brows ---- */
    const browCfg = FACE.brows[L.browStyle] ?? FACE.brows.classic;
    for (const s of [-1, 1]) {
      const x = S.face.eyeX * s;
      const brow = new THREE.Mesh(new THREE.BoxGeometry(browCfg.w, browCfg.h, 0.024), mats.ink);
      brow.position.set(x, browCfg.y, faceZ(x, browCfg.y) - 0.004);
      brow.rotation.z = browCfg.angle * s;
      P.head.add(brow);
    }

    /* ---- nose ---- */
    const nz = faceZ(0.022, S.face.noseY);
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(S.face.noseW, S.face.noseH, 0.028),
      mats.nose
    );
    nose.position.set(0.022, S.face.noseY + 0.02, nz - 0.004);
    P.head.add(nose);
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 8), mats.nose);
    noseTip.position.set(0.022, S.face.noseY - 0.04, nz + 0.006);
    P.head.add(noseTip);

    /* ---- mouth ---- */
    const mz = faceZ(0, S.face.mouthY);
    const mouthCfg = FACE.mouth[L.mouthStyle];
    if (L.mouthStyle === "smile") {
      const smile = new THREE.Mesh(
        new THREE.TorusGeometry(mouthCfg.r, mouthCfg.tube, 6, 16, Math.PI),
        mats.mouth
      );
      smile.rotation.z = Math.PI;
      smile.position.set(0, S.face.mouthY + mouthCfg.rise, mz - 0.004);
      P.head.add(smile);
    } else if (L.mouthStyle === "open") {
      const open = new THREE.Mesh(new THREE.SphereGeometry(mouthCfg.r, 12, 10), mats.mouth);
      open.scale.set(...mouthCfg.stretch, 0.45);
      open.position.set(0, S.face.mouthY, mz - 0.012);
      P.head.add(open);
    } else {
      const line = new THREE.Mesh(
        new THREE.BoxGeometry(S.face.mouthW, 0.024, 0.022),
        mats.mouth
      );
      line.position.set(0, S.face.mouthY, mz - 0.004);
      P.head.add(line);
    }

    /* ---- hair ---- */
    P.hair = new THREE.Group();
    P.head.add(P.hair);
    const H = S.hair;
    const style = L.hairStyle;
    const cfg = HAIR[style] || HAIR.bowl;

    // partial ellipsoid shell — scaled off the skull so it always sits proud
    const shell = (thetaStart, thetaLength, phiStart, phiLength, lift = H.lift) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 22, 14, phiStart, phiLength, thetaStart, thetaLength),
        mats.hair
      );
      m.scale.set(S.head.rx * lift, S.head.ry * lift, S.head.rz * lift);
      return m;
    };
    const FRONT = Math.PI / 2;

    if (style === "bald") {
      // nothing
    } else if (style === "buzz") {
      P.hair.add(shell(0, cfg.cap ?? 1.68, 0, Math.PI * 2, cfg.lift ?? 1.03));
    } else if (style === "afro") {
      // Two pieces, like the bowl: a full cap over the crown (so the top of
      // the head isn't bare) plus big sides/back that leave the face open.
      // A single shell with a front gap bares the whole front of the scalp.
      P.hair.add(shell(0, cfg.crown, 0, Math.PI * 2, cfg.lift));
      P.hair.add(
        shell(
          cfg.crown - 0.15,
          cfg.depth - cfg.crown + 0.15,
          FRONT + cfg.gap,
          Math.PI * 2 - cfg.gap * 2,
          cfg.lift
        )
      );
    } else if (style === "ponytail") {
      P.hair.add(shell(0, H.crown + 0.12, 0, Math.PI * 2, cfg.lift));
      P.hair.add(shell(H.crown - 0.1, 1.1, FRONT + H.sideArc, Math.PI * 2 - H.sideArc * 2, cfg.lift));
      const tie = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), mats.nose);
      tie.position.set(0, 0, -S.head.rz * 1.05);
      P.hair.add(tie);
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(cfg.tailR, cfg.tailLen, 4, 8), mats.hair);
      tail.position.set(0, cfg.tailY, -S.head.rz * 1.0);
      tail.rotation.x = -0.4;
      P.hair.add(tail);
    } else {
      // bowl / spiky / bob all share the crown + fringe + sides/back
      P.hair.add(shell(0, style === "spiky" ? H.crown - 0.16 : H.crown));
      P.hair.add(
        shell(
          H.crown - 0.06,
          H.fringe - H.crown + 0.06 + (style === "spiky" ? 0.3 : 0),
          FRONT - H.fringeArc,
          H.fringeArc * 2
        )
      );
      P.hair.add(
        shell(
          H.crown - 0.14,
          (style === "bob" ? 1.9 : H.backDepth),
          FRONT + (style === "bob" ? 1.35 : H.sideArc),
          style === "bob" ? 2.7 : Math.PI * 2 - H.sideArc * 2,
          style === "bob" ? H.lift * 1.02 : H.lift
        )
      );

      if (style === "spiky") {
        // Ring of spikes around the crown. They sit ON the hair shell and point
        // radially outward along the ellipsoid normal — previously they were
        // placed at rx*0.8 (inside the shell) and bunched at the sides, so only
        // two horn-like tips showed.
        const up = new THREE.Vector3(0, 1, 0);
        const a0 = FRONT + cfg.frontGap;
        const span = Math.PI * 2 - cfg.frontGap * 2;
        for (let i = 0; i < cfg.spikes; i++) {
          const phi = a0 + (i / (cfg.spikes - 1)) * span;
          const th = cfg.ring;
          // three.js sphere convention: phi measured from -X, front is +Z
          const sx = -Math.cos(phi) * Math.sin(th);
          const sy = Math.cos(th);
          const sz = Math.sin(phi) * Math.sin(th);
          const spike = new THREE.Mesh(
            new THREE.ConeGeometry(cfg.spikeR, cfg.spikeH, 6),
            mats.hair
          );
          spike.position.set(
            sx * S.head.rx * H.lift,
            sy * S.head.ry * H.lift,
            sz * S.head.rz * H.lift
          );
          const nrm = new THREE.Vector3(
            sx / S.head.rx,
            sy / S.head.ry,
            sz / S.head.rz
          ).normalize();
          spike.quaternion.setFromUnitVectors(up, nrm);
          P.hair.add(spike);
        }
      }
      if (style === "bob") {
        for (const s of [-1, 1]) {
          const lock = new THREE.Mesh(
            new THREE.CapsuleGeometry(cfg.locks, cfg.lockLen, 4, 8),
            mats.hair
          );
          lock.position.set(cfg.lockX * s, cfg.lockY, 0.07);
          P.hair.add(lock);
        }
      }
    }

    // remember the eye stretch so the blink restores the right shape
    P.eyeStretch = eyeCfg ? eyeCfg.stretch : 0;
    return g;
  };

  g.userData.rebuild();

  /* ------------------------------------------------------------- animation */
  let walkPhase = 0;
  let blinkT = 1.5 + Math.random() * 2;

  g.userData.update = (dt, t, moving) => {
    const P = g.userData.parts;
    if (!P.legL) return;
    if (moving) {
      walkPhase += dt * WALK.speed;
      const s = Math.sin(walkPhase);
      const swing = s * WALK.legSwing;
      P.armL.rotation.x = s * WALK.armSwing;
      P.armR.rotation.x = -s * WALK.armSwing;
      P.legL.rotation.x = -swing;
      P.legR.rotation.x = swing;
      // keep the soles flat instead of tilting with the shin
      P.legL.userData.shoe.rotation.x = swing * SPEC.shoe.footFlat;
      P.legR.userData.shoe.rotation.x = -swing * SPEC.shoe.footFlat;
      P.armL.rotation.z = -SPEC.arm.restAngle;
      P.armR.rotation.z = SPEC.arm.restAngle;
      inner.position.y = Math.abs(Math.cos(walkPhase)) * WALK.bob;
      P.torso.rotation.x = WALK.lean;
      P.head.rotation.x = 0.02;
      P.head.rotation.y = 0;
    } else {
      const k = 1 - Math.exp(-WALK.smooth * dt);
      P.armL.rotation.x += (0 - P.armL.rotation.x) * k;
      P.armR.rotation.x += (0 - P.armR.rotation.x) * k;
      P.legL.rotation.x += (0 - P.legL.rotation.x) * k;
      P.legR.rotation.x += (0 - P.legR.rotation.x) * k;
      P.legL.userData.shoe.rotation.x += (0 - P.legL.userData.shoe.rotation.x) * k;
      P.legR.userData.shoe.rotation.x += (0 - P.legR.userData.shoe.rotation.x) * k;
      P.armL.rotation.z += (-SPEC.arm.restAngle - P.armL.rotation.z) * k;
      P.armR.rotation.z += (SPEC.arm.restAngle - P.armR.rotation.z) * k;
      inner.position.y = Math.sin(t * 1.8) * 0.008;
      P.torso.rotation.x = 0;
      P.head.rotation.x = Math.sin(t * 1.3) * 0.018;
      P.head.rotation.y = Math.sin(t * 0.55) * 0.07;
    }
    if (P.eyes.length) {
      blinkT -= dt;
      if (blinkT <= 0) blinkT = 2.2 + Math.random() * 2.6;
      const sy = blinkT < 0.11 ? 0.12 : P.eyeStretch;
      for (const e of P.eyes) e.scale.y = sy;
    }
  };

  return g;
}
