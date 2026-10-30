import * as THREE from '../vendor/three.module.js';

/* =========================================================================
   ROADSTER // ROCKET — endless night highway
   ========================================================================= */

export const LANE_X = [-3.25, 0, 3.25];
export const ROAD_WIDTH = 11.4;
export const SPAWN_Z = -235;
const TAU = Math.PI * 2;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeRoadTexture(renderer) {
  const texture = canvasTexture(512, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#17181d';
    ctx.fillRect(0, 0, w, h);

    // Aggregate noise.
    for (let i = 0; i < 16000; i += 1) {
      const shade = 18 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgba(${shade},${shade + 1},${shade + 4},${Math.random() * 0.22})`;
      const size = Math.random() < 0.93 ? 1 : 2;
      ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }

    // Tire polish bands.
    const band = ctx.createLinearGradient(0, 0, w, 0);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(0.28, 'rgba(9,10,13,.25)');
    band.addColorStop(0.4, 'rgba(0,0,0,0)');
    band.addColorStop(0.6, 'rgba(0,0,0,0)');
    band.addColorStop(0.72, 'rgba(9,10,13,.25)');
    band.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = band;
    ctx.fillRect(0, 0, w, h);

    // Shoulder edge lines.
    ctx.fillStyle = 'rgba(220,232,238,.75)';
    ctx.fillRect(24, 0, 4, h);
    ctx.fillRect(w - 28, 0, 4, h);
    ctx.fillStyle = 'rgba(83,220,255,.22)';
    ctx.fillRect(15, 0, 2, h);
    ctx.fillRect(w - 17, 0, 2, h);

    // Dashed lane dividers.
    const dashHeight = 104;
    const gap = 168;
    for (let y = -dashHeight; y < h + gap; y += gap) {
      ctx.fillStyle = 'rgba(214,228,236,.62)';
      ctx.fillRect(w * 0.333 - 2, y, 4, dashHeight);
      ctx.fillRect(w * 0.667 - 2, y, 4, dashHeight);
      ctx.fillStyle = 'rgba(77,209,255,.13)';
      ctx.fillRect(w * 0.333 - 4, y + 8, 8, dashHeight - 16);
      ctx.fillRect(w * 0.667 - 4, y + 8, 8, dashHeight - 16);
    }

    // Fine expansion seams.
    ctx.strokeStyle = 'rgba(4,5,8,.36)';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 256) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y + 1);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 18);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function makeGroundTexture() {
  const texture = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#171319';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 13000; i += 1) {
      const warm = Math.random() > 0.75;
      ctx.fillStyle = warm
        ? `rgba(${40 + Math.random() * 20},${29 + Math.random() * 12},${31 + Math.random() * 10},${Math.random() * 0.18})`
        : `rgba(${16 + Math.random() * 10},${14 + Math.random() * 8},${20 + Math.random() * 10},${Math.random() * 0.3})`;
      const size = 1 + Math.random() * 3;
      ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }
    // Dune striations.
    ctx.strokeStyle = 'rgba(105,67,57,.06)';
    for (let i = 0; i < 20; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, i * 29 + Math.random() * 10);
      ctx.bezierCurveTo(w * 0.3, i * 29 + 20, w * 0.65, i * 29 - 12, w, i * 29 + 14);
      ctx.stroke();
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(12, 12);
  return texture;
}

function makeHazardTexture(dark = false) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = dark ? '#16130f' : '#d9d6ca';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-0.42);
    for (let x = -w; x < w; x += 76) {
      ctx.fillStyle = dark ? '#f3a53b' : '#d7492c';
      ctx.fillRect(x, -h, 40, h * 2.4);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(20,18,15,.7)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i < 180; i += 1) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

function makeGateSignTexture() {
  return canvasTexture(1024, 192, (ctx, w, h) => {
    ctx.fillStyle = '#0c0c10';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ff3447';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#ff3447';
    ctx.fillRect(28, 28, 8, h - 56);
    ctx.fillRect(w - 36, 28, 8, h - 56);
    ctx.fillStyle = '#f6eef0';
    ctx.font = '700 78px Oxanium, Arial Narrow, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '6px';
    ctx.fillText('FULL ROAD BLOCK', w / 2, 82);
    ctx.fillStyle = 'rgba(255,112,122,.9)';
    ctx.font = '500 21px Oxanium, Arial, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('COLD-GAS LIFT REQUIRED  //  冷气推进', w / 2, 143);
  });
}

function makeBillboardTexture(title, sub, accent = '#55e6ff') {
  return canvasTexture(768, 320, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#0b1118');
    gradient.addColorStop(1, '#15101a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(185,219,235,.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(13, 13, w - 26, h - 26);
    ctx.fillStyle = accent;
    ctx.fillRect(32, 36, 8, h - 72);
    ctx.fillStyle = accent;
    ctx.font = '600 22px Oxanium, Arial, sans-serif';
    ctx.letterSpacing = '8px';
    ctx.fillText('CAPE CANAVERAL  /  SECTOR 09', 66, 78);
    ctx.fillStyle = '#f0f5f8';
    ctx.font = '700 88px Oxanium, Arial Narrow, sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(title, 62, 176);
    ctx.fillStyle = 'rgba(206,221,229,.56)';
    ctx.font = '400 27px Oxanium, Arial, sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText(sub, 66, 232);
    ctx.fillStyle = accent;
    ctx.fillRect(66, 260, 112, 4);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    for (let x = w - 190; x < w - 54; x += 17) {
      ctx.fillRect(x, 40, 5, h - 80);
    }
  });
}

function makeRidge(z, baseHeight, variance, color, seedOffset = 0) {
  const segments = 72;
  const span = 1300;
  const positions = [];
  const heights = [];
  for (let i = 0; i <= segments; i += 1) {
    const x = -span / 2 + (i / segments) * span;
    const wave =
      Math.sin(i * 0.53 + seedOffset) * 0.28 +
      Math.sin(i * 0.19 + 1.7 + seedOffset) * 0.46 +
      Math.sin(i * 1.13 + 0.4) * 0.12;
    const peak = baseHeight + wave * variance + Math.max(0, Math.sin(i * 0.11 + seedOffset)) * variance * 0.5;
    positions.push(x, -8, z);
    positions.push(x, peak, z);
    heights.push(peak);
  }
  const vertices = [];
  for (let i = 0; i < segments; i += 1) {
    const x0 = -span / 2 + (i / segments) * span;
    const x1 = -span / 2 + ((i + 1) / segments) * span;
    const y0 = heights[i];
    const y1 = heights[i + 1];
    vertices.push(x0, -8, z, x1, -8, z, x0, y0, z);
    vertices.push(x1, -8, z, x1, y1, z, x0, y0, z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const material = new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide });
  return new THREE.Mesh(geometry, material);
}

function makeRocketTower() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1620, metalness: 0.65, roughness: 0.55 });
  const darker = new THREE.MeshStandardMaterial({ color: 0x0c0a10, metalness: 0.5, roughness: 0.75 });
  const redLight = new THREE.MeshBasicMaterial({ color: 0xff263d, toneMapped: false });

  const towerHeight = 54;
  const column = new THREE.Mesh(new THREE.BoxGeometry(2.2, towerHeight, 2.2), metal);
  column.position.y = towerHeight / 2;
  group.add(column);

  for (let i = 1; i < 8; i += 1) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.35, 0.35), darker);
    beam.position.set(0, i * 6.5, 0);
    group.add(beam);
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.24, 8.2, 0.24), metal);
    brace.position.set(3.1, i * 6.5 + 2.8, 0);
    brace.rotation.z = -0.68;
    group.add(brace);
  }

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 18, 6), metal);
  mast.position.y = towerHeight + 8;
  group.add(mast);

  for (let i = 0; i < 4; i += 1) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 6), redLight);
    lamp.position.set(0, 12 + i * 13, 1.25);
    group.add(lamp);
  }

  const beacon = new THREE.PointLight(0xff2338, 8, 48, 2);
  beacon.position.set(0, towerHeight + 15, 0);
  group.add(beacon);

  group.position.set(104, -2, -380);
  group.scale.setScalar(1.25);
  return group;
}

function makeGroundSigns() {
  const group = new THREE.Group();

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    metalness: 0.75,
    roughness: 0.5,
  });
  const smallLight = new THREE.MeshBasicMaterial({ color: 0xff3349, toneMapped: false });
  const cyanLight = new THREE.MeshBasicMaterial({ color: 0x62eeff, toneMapped: false });

  const signs = [
    { x: 13.8, z: -40, title: 'MARS', sub: 'AHEAD / 225,000,000 KM', accent: '#ff5468', rot: -0.9 },
    { x: -14.7, z: -152, title: 'COLD GAS', sub: 'PRESSURE 10,000 PSI', accent: '#55e6ff', rot: 0.9 },
    { x: 16.2, z: -272, title: 'RANGE', sub: 'FULL THROTTLE ONLY', accent: '#ffb155', rot: -1.04 },
  ];

  signs.forEach((sign) => {
    const signGroup = new THREE.Group();
    signGroup.position.set(sign.x, 0, sign.z);
    signGroup.rotation.y = sign.rot;

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(6.9, 2.9),
      new THREE.MeshBasicMaterial({ map: makeBillboardTexture(sign.title, sign.sub, sign.accent), toneMapped: false }),
    );
    board.position.y = 4.3;
    signGroup.add(board);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(7.1, 3.1, 0.14),
      new THREE.MeshStandardMaterial({ color: 0x101318, metalness: 0.75, roughness: 0.45 }),
    );
    frame.position.set(0, 4.3, -0.1);
    signGroup.add(frame);

    [-2.55, 2.55].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.4, 0.16), postMaterial);
      post.position.set(x, 2.2, -0.13);
      signGroup.add(post);
    });

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), smallLight);
    beacon.position.set(2.65, 5.8, 0);
    signGroup.add(beacon);

    const lowerLight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.035, 0.03), cyanLight);
    lowerLight.position.set(0, 2.74, 0.02);
    signGroup.add(lowerLight);

    group.add(signGroup);
  });

  return group;
}

function makeOverheadGantries() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x1d2026, metalness: 0.7, roughness: 0.48 });
  const light = new THREE.MeshBasicMaterial({ color: 0x69e9ff, toneMapped: false });
  const red = new THREE.MeshBasicMaterial({ color: 0xff344c, toneMapped: false });

  for (let i = 0; i < 3; i += 1) {
    const arch = new THREE.Group();
    [-1, 1].forEach((side) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.35, 0.18), metal);
      post.position.set(side * 7.35, 2.67, 0);
      arch.add(post);

      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.18, 0.75), metal);
      foot.position.set(side * 7.35, 0.08, 0);
      arch.add(foot);

      const redLamp = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 6), red);
      redLamp.position.set(side * 7.35, 5.35, 0.1);
      arch.add(redLamp);
    });

    const beam = new THREE.Mesh(new THREE.BoxGeometry(14.9, 0.18, 0.18), metal);
    beam.position.y = 5.37;
    arch.add(beam);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.025, 0.04), light);
    strip.position.set(0, 5.25, 0.1);
    arch.add(strip);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(14.5, 0.035, 0.03), light);
    stripe.position.set(0, 4.9, 0.1);
    arch.add(stripe);

    arch.position.z = -i * 166;
    group.add(arch);
  }

  return group;
}

function makeTrafficCar(color) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.7,
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x090b0e, metalness: 0.3, roughness: 0.72 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x070d13,
    metalness: 0.6,
    roughness: 0.1,
    clearcoat: 1,
  });
  const tire = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.95 });
  const tail = new THREE.MeshStandardMaterial({
    color: 0xff293a,
    emissive: 0xff172d,
    emissiveIntensity: 2.5,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xdaf4ff,
    emissive: 0xc5ecff,
    emissiveIntensity: 1.8,
  });

  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.42, 3.82), bodyMaterial);
  lower.position.y = 0.55;
  lower.castShadow = true;
  lower.receiveShadow = true;
  group.add(lower);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.22, 1.04), bodyMaterial);
  hood.position.set(0, 0.82, -1.35);
  hood.rotation.x = -0.06;
  hood.castShadow = true;
  group.add(hood);

  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.2, 0.88), bodyMaterial);
  trunk.position.set(0, 0.83, 1.48);
  group.add(trunk);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.61, 1.95), glass);
  cabin.position.set(0, 1.1, 0.1);
  cabin.castShadow = true;
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.08, 1.09), bodyMaterial);
  roof.position.set(0, 1.38, 0.12);
  group.add(roof);

  const rearPanel = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.18, 0.04), dark);
  rearPanel.position.set(0, 0.74, 1.925);
  group.add(rearPanel);

  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.07, 0.03), tail);
  tailBar.position.set(0, 0.75, 1.95);
  group.add(tailBar);

  [-1, 1].forEach((side) => {
    const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.055, 0.03), white);
    headlight.position.set(side * 0.56, 0.66, -1.93);
    group.add(headlight);
  });

  const wheelGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 16);
  [[-0.9, -1.22], [0.9, -1.22], [-0.9, 1.26], [0.9, 1.26]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, tire);
    wheel.position.set(x, 0.34, z);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), dark);
  bumper.position.set(0, 0.35, -1.94);
  group.add(bumper);

  group.userData.wheels = [];
  return group;
}

function makeBarrier() {
  const group = new THREE.Group();
  const hazard = new THREE.MeshStandardMaterial({
    map: makeHazardTexture(false),
    metalness: 0.1,
    roughness: 0.64,
    side: THREE.DoubleSide,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x25262a,
    metalness: 0.75,
    roughness: 0.46,
  });
  const red = new THREE.MeshBasicMaterial({ color: 0xff2b43, toneMapped: false });

  const board = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.72, 0.14), hazard);
  board.position.y = 0.7;
  board.castShadow = true;
  group.add(board);

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.08, 0.22), metal);
  topRail.position.y = 1.1;
  group.add(topRail);

  [-1.05, 1.05].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.95, 0.48), metal);
    leg.position.set(x, 0.45, 0);
    leg.castShadow = true;
    group.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.09, 0.72), metal);
    foot.position.set(x, 0.045, 0);
    group.add(foot);
  });

  const warning = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), red);
  warning.position.set(0, 1.18, 0.06);
  group.add(warning);

  return group;
}

function makeGate() {
  const group = new THREE.Group();
  const main = new THREE.Group();
  group.add(main);

  const hazard = new THREE.MeshStandardMaterial({
    map: makeHazardTexture(false),
    metalness: 0.1,
    roughness: 0.6,
    side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    metalness: 0.7,
    roughness: 0.42,
  });
  const red = new THREE.MeshBasicMaterial({ color: 0xff3047, toneMapped: false });
  const whiteGlow = new THREE.MeshBasicMaterial({ color: 0xd7f7ff, toneMapped: false });
  const signMap = makeGateSignTexture();

  // Low wall across all lanes. Fast flight clears this; an arch still frames it.
  for (let i = -1; i <= 1; i += 1) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.23, 1.68, 0.46), hazard);
    panel.position.set(i * 3.25, 0.84, 0);
    panel.castShadow = true;
    main.add(panel);

    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.08, 0.4), dark);
    rail.position.set(i * 3.25, 1.73, 0);
    main.add(rail);

    const light = new THREE.Mesh(new THREE.BoxGeometry(3.05, 0.035, 0.03), red);
    light.position.set(i * 3.25, 1.47, 0.25);
    main.add(light);
  }

  // Side pylons and a top beam create a dramatic fly-through gate.
  [-1, 1].forEach((side) => {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.28, 5.2, 0.55), dark);
    pylon.position.set(side * 5.2, 2.6, 0);
    pylon.castShadow = true;
    group.add(pylon);

    for (let y = 0.45; y < 4.9; y += 0.58) {
      const segment = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.62), red);
      segment.position.set(side * 5.2, y, 0);
      group.add(segment);
    }

    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.4), dark);
    foot.position.set(side * 5.2, 0.09, 0);
    group.add(foot);

    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), red);
    beacon.position.set(side * 5.2, 5.25, 0);
    group.add(beacon);
  });

  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.65, 0.32, 0.48), dark);
  beam.position.y = 5.25;
  group.add(beam);

  const beamLight = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.035, 0.04), whiteGlow);
  beamLight.position.set(0, 5.05, 0.28);
  group.add(beamLight);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 1.35),
    new THREE.MeshBasicMaterial({ map: signMap, toneMapped: false }),
  );
  sign.position.set(0, 2.33, 0.3);
  group.add(sign);

  const signBack = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.48, 0.28), dark);
  signBack.position.set(0, 2.33, 0);
  group.add(signBack);

  const scanLight = new THREE.PointLight(0xff233b, 14, 22, 2);
  scanLight.position.set(0, 2.6, 1.6);
  group.add(scanLight);

  group.userData.scanLight = scanLight;
  group.userData.beacons = [];
  group.traverse((child) => {
    if (child.material === red) group.userData.beacons.push(child);
  });

  return group;
}

export function createWorld(scene, renderer) {
  const world = {
    obstacles: [],
    gate: null,
    distance: 0,
    spawnCount: 0,
    elapsed: 0,
  };

  scene.fog = new THREE.Fog(0x17121d, 85, 410);
  scene.background = new THREE.Color(0x05070d);

  /* -------------------------------- sky -------------------------------- */
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x03040a) },
      uHorizon: { value: new THREE.Color(0x4a253a) },
      uBottom: { value: new THREE.Color(0x0a0910) },
      uSunDirection: { value: new THREE.Vector3(-0.72, 0.055, -0.69).normalize() },
      uSunColor: { value: new THREE.Color(0xff8d70) },
      uGlowColor: { value: new THREE.Color(0x65334f) },
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vDirection = normalize(worldPosition.xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uGlowColor;
      varying vec3 vDirection;

      void main() {
        float h = vDirection.y;
        vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.62, h));
        color = mix(uBottom, color, smoothstep(-0.18, 0.035, h));

        float sunDot = max(dot(normalize(vDirection), uSunDirection), 0.0);
        float sun = pow(sunDot, 420.0);
        float halo = pow(sunDot, 13.0);
        float wideHalo = pow(sunDot, 3.5);
        color += uSunColor * (sun * 3.4 + halo * 0.44);
        color += uGlowColor * wideHalo * 0.2;

        float band = sin(h * 95.0 + vDirection.x * 13.0) * 0.5 + 0.5;
        color += vec3(0.018, 0.01, 0.02) * band * smoothstep(0.02, 0.3, h) * (1.0 - smoothstep(.3, .7, h));

        float horizonLine = exp(-abs(h) * 85.0) * 0.16;
        color += vec3(0.6, 0.26, 0.28) * horizonLine;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 20), skyMaterial);
  scene.add(sky);

  const starGeometry = new THREE.BufferGeometry();
  const starPositions = [];
  const starColors = [];
  for (let i = 0; i < 1800; i += 1) {
    const theta = Math.random() * TAU;
    const y = Math.pow(Math.random(), 0.58);
    const radius = 600 + Math.random() * 85;
    const horizontal = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(theta) * horizontal * radius, y * radius * 0.82 + 30, Math.sin(theta) * horizontal * radius);
    const warm = Math.random() > 0.88;
    const color = new THREE.Color(warm ? 0xffd7bd : 0xc6dcff);
    color.multiplyScalar(0.55 + Math.random() * 0.45);
    starColors.push(color.r, color.g, color.b);
  }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.88,
      vertexColors: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  scene.add(stars);

  const moonGlowTexture = canvasTexture(256, 256, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(232,241,255,.9)');
    gradient.addColorStop(0.09, 'rgba(210,227,255,.75)');
    gradient.addColorStop(0.3, 'rgba(139,171,224,.12)');
    gradient.addColorStop(1, 'rgba(80,110,170,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonGlowTexture,
    color: 0xd8e8ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }));
  moon.position.set(210, 155, -570);
  moon.scale.set(50, 50, 1);
  scene.add(moon);

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonGlowTexture,
    color: 0xff8064,
    transparent: true,
    opacity: 0.36,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  }));
  sunGlow.position.set(-320, 44, -610);
  sunGlow.scale.set(190, 190, 1);
  scene.add(sunGlow);

  /* ----------------------------- landscape ----------------------------- */
  scene.add(makeRidge(-455, 30, 56, 0x1b1422, 0.2));
  scene.add(makeRidge(-335, 18, 37, 0x120e16, 2.4));
  scene.add(makeRidge(-265, 7, 20, 0x0b0910, 4.8));
  scene.add(makeRocketTower());

  const groundTexture = makeGroundTexture();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({
      map: groundTexture,
      color: 0x837a7f,
      roughness: 0.98,
      metalness: 0.03,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.095;
  ground.receiveShadow = true;
  scene.add(ground);

  // Low dunes and rock silhouettes on the shoulders.
  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x16121a,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
  });
  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockCount = 52;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < rockCount; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const scale = rand(0.7, 3.2);
    dummy.position.set(side * rand(12, 75), scale * 0.28 - 0.08, -rand(4, 520));
    dummy.scale.set(scale * rand(0.7, 1.4), scale * rand(0.4, 1.1), scale * rand(0.8, 1.8));
    dummy.rotation.set(rand(-0.4, 0.4), rand(0, TAU), rand(-0.3, 0.3));
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  rocks.receiveShadow = true;
  const rocksGroup = new THREE.Group();
  rocksGroup.add(rocks);
  scene.add(rocksGroup);

  /* ------------------------------- road -------------------------------- */
  const roadTexture = makeRoadTexture(renderer);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, 560),
    new THREE.MeshStandardMaterial({
      map: roadTexture,
      roughness: 0.76,
      metalness: 0.18,
      color: 0xa5a8ad,
    }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0, -238);
  road.receiveShadow = true;
  scene.add(road);

  const shoulderMaterial = new THREE.MeshStandardMaterial({
    color: 0x19181d,
    roughness: 0.9,
    metalness: 0.08,
  });
  const shoulderLeft = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 560), shoulderMaterial);
  shoulderLeft.position.set(-ROAD_WIDTH / 2 - 1.7, -0.025, -238);
  shoulderLeft.receiveShadow = true;
  scene.add(shoulderLeft);
  const shoulderRight = shoulderLeft.clone();
  shoulderRight.position.x = ROAD_WIDTH / 2 + 1.7;
  scene.add(shoulderRight);

  const railMaterial = new THREE.MeshStandardMaterial({
    color: 0x252b32,
    metalness: 0.9,
    roughness: 0.32,
  });
  [-1, 1].forEach((side) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 560), railMaterial);
    rail.position.set(side * (ROAD_WIDTH / 2 + 1.25), 0.44, -238);
    rail.castShadow = true;
    scene.add(rail);

    const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 560), railMaterial);
    lowerRail.position.set(side * (ROAD_WIDTH / 2 + 1.25), 0.21, -238);
    scene.add(lowerRail);
  });

  // Animated edge markers.
  const lightGeometry = new THREE.SphereGeometry(0.065, 6, 5);
  const lightMaterial = new THREE.MeshBasicMaterial({ color: 0x6cecff, toneMapped: false });
  const edgeLightCount = 44;
  const edgeLights = new THREE.InstancedMesh(lightGeometry, lightMaterial, edgeLightCount * 2);
  for (let i = 0; i < edgeLightCount; i += 1) {
    [-1, 1].forEach((side, index) => {
      dummy.position.set(side * (ROAD_WIDTH / 2 + 0.36), 0.06, -i * 11);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      edgeLights.setMatrixAt(i * 2 + index, dummy.matrix);
    });
  }
  const edgeLightsGroup = new THREE.Group();
  edgeLightsGroup.add(edgeLights);
  scene.add(edgeLightsGroup);

  const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff3348, toneMapped: false });
  const markerGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.38);
  const guardMarkers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 56);
  for (let i = 0; i < 28; i += 1) {
    [-1, 1].forEach((side, index) => {
      dummy.position.set(side * (ROAD_WIDTH / 2 + 1.26), 0.56, -i * 17);
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      guardMarkers.setMatrixAt(i * 2 + index, dummy.matrix);
    });
  }
  const guardMarkersGroup = new THREE.Group();
  guardMarkersGroup.add(guardMarkers);
  scene.add(guardMarkersGroup);

  const gantries = makeOverheadGantries();
  scene.add(gantries);

  const signs = makeGroundSigns();
  const signsGroup = new THREE.Group();
  signsGroup.add(signs);
  scene.add(signsGroup);

  /* ------------------------------ lighting ----------------------------- */
  const hemi = new THREE.HemisphereLight(0x8d9bd6, 0x140d12, 0.92);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xffc4a2, 2.35);
  keyLight.position.set(-38, 32, -18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -22;
  keyLight.shadow.camera.right = 22;
  keyLight.shadow.camera.top = 22;
  keyLight.shadow.camera.bottom = -22;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 110;
  keyLight.shadow.bias = -0.0006;
  keyLight.shadow.normalBias = 0.035;
  keyLight.target.position.set(0, 0, -6);
  scene.add(keyLight);
  scene.add(keyLight.target);

  const rimLight = new THREE.DirectionalLight(0x62c9ff, 2.2);
  rimLight.position.set(24, 12, 28);
  scene.add(rimLight);

  const horizonLight = new THREE.DirectionalLight(0xff7460, 0.9);
  horizonLight.position.set(-10, 3, -120);
  scene.add(horizonLight);

  // A faint camera-side fill keeps the road readable without flattening the scene.
  const cameraFill = new THREE.PointLight(0x6ea6d8, 22, 32, 2);
  cameraFill.position.set(0, 8, 4);
  scene.add(cameraFill);

  /* ----------------------------- obstacle layer ------------------------ */
  const obstacleLayer = new THREE.Group();
  scene.add(obstacleLayer);

  const obstaclePalette = [0x252c35, 0x3d2529, 0x263037, 0x493b2c, 0x1a1e24, 0x4a1e25];
  const beaconTexture = canvasTexture(96, 96, (ctx, w, h) => {
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gradient.addColorStop(0, 'rgba(255,90,105,1)');
    gradient.addColorStop(0.25, 'rgba(255,38,59,.8)');
    gradient.addColorStop(1, 'rgba(255,20,40,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
  const beaconMaterial = new THREE.SpriteMaterial({
    map: beaconTexture,
    color: 0xff2e45,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });

  function addBeacon(group, y = 1.35) {
    const sprite = new THREE.Sprite(beaconMaterial.clone());
    sprite.position.set(0, y, 0);
    sprite.scale.set(0.65, 0.65, 1);
    group.add(sprite);
  }

  // Obstacles are cloned from shared templates so materials, textures and
  // geometries are not rebuilt for every car entering the endless highway.
  const trafficTemplates = obstaclePalette.map((color) => {
    const template = makeTrafficCar(color);
    addBeacon(template, 1.55);
    return template;
  });
  const barrierTemplate = makeBarrier();
  addBeacon(barrierTemplate, 1.32);
  let gateAsset = null;

  world.spawnTrafficCar = (lane, zOffset = 0) => {
    const group = pick(trafficTemplates).clone(true);
    group.position.set(LANE_X[lane], 0, SPAWN_Z + zOffset);
    group.rotation.y = rand(-0.015, 0.015);
    group.userData.collision = {
      type: 'car',
      halfW: 0.86,
      halfD: 1.86,
      height: 1.45,
      lane,
      passed: false,
    };
    obstacleLayer.add(group);
    world.obstacles.push(group);
    world.spawnCount += 1;
    return group;
  };

  world.spawnBarrier = (lane, zOffset = 0) => {
    const group = barrierTemplate.clone(true);
    group.position.set(LANE_X[lane], 0, SPAWN_Z + zOffset);
    group.userData.collision = {
      type: 'barrier',
      halfW: 1.24,
      halfD: 0.4,
      height: 1.18,
      lane,
      passed: false,
    };
    obstacleLayer.add(group);
    world.obstacles.push(group);
    world.spawnCount += 1;
    return group;
  };

  world.spawnGate = (distance = 0) => {
    if (world.gate) return world.gate;
    if (!gateAsset) gateAsset = makeGate();
    const group = gateAsset;
    group.position.set(0, 0, -148);
    group.userData.collision = {
      type: 'gate',
      halfW: 5.6,
      halfD: 0.5,
      height: 3.0,
      lane: 1,
      passed: false,
    };
    group.userData.kind = 'gate';
    group.userData.spawnDistance = distance;
    obstacleLayer.add(group);
    world.gate = group;
    return group;
  };

  world.updateObstacles = (dt, speed, elapsed) => {
    for (let i = world.obstacles.length - 1; i >= 0; i -= 1) {
      const obstacle = world.obstacles[i];
      obstacle.position.z += speed * dt;
      if (obstacle.position.z > 24) {
        obstacleLayer.remove(obstacle);
        world.obstacles.splice(i, 1);
      }
    }

    if (world.gate) {
      world.gate.position.z += speed * dt;
      const beacons = world.gate.userData.beacons;
      beacons.forEach((beacon, index) => {
        const pulse = Math.sin(elapsed * 8 - index * 0.4) > 0.2;
        beacon.visible = pulse;
      });
      if (world.gate.userData.scanLight) {
        world.gate.userData.scanLight.intensity = 10 + Math.sin(elapsed * 7) * 5;
      }
      if (world.gate.position.z > 24) {
        obstacleLayer.remove(world.gate);
        world.gate = null;
      }
    }
  };

  world.clearObstacles = () => {
    for (const obstacle of world.obstacles) {
      obstacleLayer.remove(obstacle);
    }
    world.obstacles.length = 0;
    if (world.gate) {
      obstacleLayer.remove(world.gate);
      world.gate = null;
    }
  };

  world.checkCollision = (carX, altitude, carHalfW = 0.79, carHalfD = 1.72) => {
    const candidates = world.gate ? [...world.obstacles, world.gate] : world.obstacles;
    const carBottom = altitude + 0.08;
    const carTop = altitude + 1.16;

    for (const obstacle of candidates) {
      const box = obstacle.userData.collision;
      if (!box) continue;
      const dz = Math.abs(obstacle.position.z);
      const dx = Math.abs(obstacle.position.x - carX);
      if (dz > box.halfD + carHalfD) continue;
      if (dx > box.halfW + carHalfW) continue;
      if (carBottom < box.height && carTop > -0.05) {
        box.hit = true;
        return { obstacle, box };
      }
    }
    return null;
  };

  world.update = (dt, distance, speed, elapsed) => {
    world.distance = distance;
    world.elapsed = elapsed;

    roadTexture.offset.y = (distance / 31.1) % 1;
    groundTexture.offset.y = (distance / 260) % 1;

    edgeLightsGroup.position.z = distance % 11;
    guardMarkersGroup.position.z = distance % 17;
    gantries.position.z = distance % 166;
    signsGroup.position.z = distance % 238;
    rocksGroup.position.z = distance % 520;

    // Sparse dust motes drifting across the road.
    const beaconPulse = 0.78 + Math.sin(elapsed * 4.4) * 0.14;
    beaconMaterial.opacity = beaconPulse;

    stars.rotation.y = elapsed * 0.0015;
    moon.position.x = 210 + Math.sin(elapsed * 0.01) * 2;
  };

  world.reset = () => {
    world.clearObstacles();
    world.distance = 0;
    world.spawnCount = 0;
    world.elapsed = 0;
    roadTexture.offset.y = 0;
    edgeLightsGroup.position.z = 0;
    guardMarkersGroup.position.z = 0;
    gantries.position.z = 0;
    signsGroup.position.z = 0;
    rocksGroup.position.z = 0;
  };

  world.obstacleLayer = obstacleLayer;
  world.scene = scene;
  world.renderer = renderer;
  world.setMenuMode = (enabled) => {
    gantries.visible = !enabled;
    signsGroup.visible = !enabled;
    rocksGroup.visible = !enabled;
    edgeLightsGroup.visible = true;
  };
  return world;
}
