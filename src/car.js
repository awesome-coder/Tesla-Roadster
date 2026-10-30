import * as THREE from '../vendor/three.module.js';

/* =========================================================================
   ROADSTER // ROCKET — procedural vehicle
   A low, angular, silver hypercar built from lofted cross-sections.
   ========================================================================= */

const TAU = Math.PI * 2;

function radialTexture(size = 128, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function plateTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d9e0e4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#11161b';
  ctx.fillRect(6, 6, canvas.width - 12, canvas.height - 12);
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = '#eef5f8';
  ctx.font = '600 58px Oxanium, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '8px';
  ctx.fillText('RKT · 01', canvas.width / 2, canvas.height / 2 + 2);
  ctx.fillStyle = 'rgba(85,230,255,.8)';
  ctx.fillRect(38, 39, 4, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function underbodyMarkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(115,239,255,.72)';
  ctx.lineWidth = 4;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
  ctx.fillStyle = 'rgba(185,248,255,.92)';
  ctx.font = '700 86px Oxanium, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '8px';
  ctx.fillText('R//R', canvas.width / 2, 112);
  ctx.fillStyle = 'rgba(116,230,255,.7)';
  ctx.font = '500 24px Oxanium, Arial, sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('COLD-GAS LIFT  /  10 THRUSTERS', canvas.width / 2, 184);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeSectionRing(section) {
  const { w, b, t } = section;
  const h = t - b;
  return [
    { x: w * 0.82, y: b },
    { x: w, y: b + h * 0.12 },
    { x: w, y: t - h * 0.2 },
    { x: w * 0.78, y: t },
    { x: 0, y: t + 0.022 },
    { x: -w * 0.78, y: t },
    { x: -w, y: t - h * 0.2 },
    { x: -w, y: b + h * 0.12 },
    { x: -w * 0.82, y: b },
  ];
}

/**
 * Builds a closed, faceted loft. Sections must be ordered from front (-Z) to
 * rear (+Z). Both end caps are triangulated so the body is watertight.
 */
function loftGeometry(sections) {
  const rings = sections.map((section) => makeSectionRing(section));
  const vertices = [];
  const push = (x, y, z) => vertices.push(x, y, z);
  const quad = (a, b, c, d) => {
    push(a.x, a.y, a.z);
    push(b.x, b.y, b.z);
    push(c.x, c.y, c.z);

    push(a.x, a.y, a.z);
    push(c.x, c.y, c.z);
    push(d.x, d.y, d.z);
  };

  for (let s = 0; s < sections.length - 1; s += 1) {
    const a = sections[s];
    const b = sections[s + 1];
    const ringA = rings[s];
    const ringB = rings[s + 1];
    for (let i = 0; i < ringA.length; i += 1) {
      const j = (i + 1) % ringA.length;
      quad(
        { x: ringA[i].x, y: ringA[i].y, z: a.z },
        { x: ringA[j].x, y: ringA[j].y, z: a.z },
        { x: ringB[j].x, y: ringB[j].y, z: b.z },
        { x: ringB[i].x, y: ringB[i].y, z: b.z },
      );
    }
  }

  // Front cap
  const front = sections[0];
  const frontRing = rings[0];
  const frontCenterY = (front.b + front.t) / 2;
  for (let i = 0; i < frontRing.length; i += 1) {
    const j = (i + 1) % frontRing.length;
    push(0, frontCenterY, front.z);
    push(frontRing[j].x, frontRing[j].y, front.z);
    push(frontRing[i].x, frontRing[i].y, front.z);
  }

  // Rear cap
  const rear = sections[sections.length - 1];
  const rearRing = rings[rings.length - 1];
  const rearCenterY = (rear.b + rear.t) / 2;
  for (let i = 0; i < rearRing.length; i += 1) {
    const j = (i + 1) % rearRing.length;
    push(0, rearCenterY, rear.z);
    push(rearRing[i].x, rearRing[i].y, rear.z);
    push(rearRing[j].x, rearRing[j].y, rear.z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function rodBetween(start, end, radius, material, radialSegments = 6) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function makeWheel(isRear, environmentMap = null) {
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);

  const tireMaterial = new THREE.MeshStandardMaterial({
    color: 0x050607,
    roughness: 0.92,
    metalness: 0.08,
  });
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.445, 0.445, 0.34, 28), tireMaterial);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  spin.add(tire);

  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xaab3bb,
    roughness: 0.22,
    metalness: 1,
  });
  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x0d1115,
    roughness: 0.32,
    metalness: 0.86,
  });
  if (environmentMap) {
    rimMaterial.envMap = environmentMap;
    rimMaterial.envMapIntensity = 2.4;
    darkMetal.envMap = environmentMap;
    darkMetal.envMapIntensity = 1.2;
  }
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.355, 24), rimMaterial);
  rim.rotation.z = Math.PI / 2;
  spin.add(rim);

  const rimInset = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.365, 24), darkMetal);
  rimInset.rotation.z = Math.PI / 2;
  spin.add(rimInset);

  // Five-spoke turbine face, laid in the YZ plane.
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * TAU;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.062, 0.235), rimMaterial);
    spoke.position.set(0, Math.cos(angle) * 0.14, Math.sin(angle) * 0.14);
    spoke.rotation.x = angle;
    spin.add(spoke);
  }

  // Bright outer lip makes the wheel face readable at night.
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.301, 0.014, 5, 28), rimMaterial);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = 0.19;
  spin.add(lip);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.39, 16), rimMaterial);
  hub.rotation.z = Math.PI / 2;
  spin.add(hub);

  if (isRear) {
    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.21, 0.21, 0.02, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.7, roughness: 0.45 }),
    );
    brakeDisc.rotation.z = Math.PI / 2;
    brakeDisc.position.x = -0.02;
    spin.add(brakeDisc);
  }

  const caliper = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.17, 0.1),
    new THREE.MeshStandardMaterial({
      color: 0xc5111d,
      emissive: 0x3c0205,
      emissiveIntensity: 0.5,
      metalness: 0.5,
      roughness: 0.35,
    }),
  );
  caliper.position.set(-0.19, 0.19, 0.04);
  caliper.rotation.x = -0.4;
  spin.add(caliper);

  return { pivot, spin };
}

export function createRoadster(environmentMap = null) {
  const root = new THREE.Group();
  root.name = 'Roadster Rocket';

  /* ----------------------------- materials ----------------------------- */
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce0,
    metalness: 0.7,
    roughness: 0.26,
    clearcoat: 0.9,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const bodyDarkMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x8b929a,
    metalness: 0.82,
    roughness: 0.33,
    clearcoat: 0.6,
    clearcoatRoughness: 0.24,
    side: THREE.DoubleSide,
    flatShading: true,
  });

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a1e30,
    metalness: 0.2,
    roughness: 0.045,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const carbonMaterial = new THREE.MeshStandardMaterial({
    color: 0x090b0d,
    metalness: 0.65,
    roughness: 0.4,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const trimMaterial = new THREE.MeshStandardMaterial({
    color: 0x0d1115,
    metalness: 0.55,
    roughness: 0.48,
  });

  const chromeMaterial = new THREE.MeshStandardMaterial({
    color: 0xc7d0d7,
    metalness: 1,
    roughness: 0.16,
  });

  const redLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xff2234,
    emissive: 0xff001e,
    emissiveIntensity: 1.28,
    metalness: 0.4,
    roughness: 0.24,
  });

  const tailBarMaterial = new THREE.MeshBasicMaterial({
    color: 0xff1830,
    toneMapped: false,
  });

  const whiteLightMaterial = new THREE.MeshStandardMaterial({
    color: 0xdff5ff,
    emissive: 0xb7e7ff,
    emissiveIntensity: 3.25,
    metalness: 0.2,
    roughness: 0.2,
  });

  if (environmentMap) {
    const envSettings = [
      [bodyMaterial, 1.5],
      [bodyDarkMaterial, 1.2],
      [glassMaterial, 2.7],
      [carbonMaterial, 0.75],
      [trimMaterial, 0.7],
      [chromeMaterial, 2.2],
      [redLightMaterial, 1.2],
      [whiteLightMaterial, 1.1],
    ];
    envSettings.forEach(([material, intensity]) => {
      material.envMap = environmentMap;
      material.envMapIntensity = intensity;
    });
  }

  /* ------------------------------- body -------------------------------- */
  const bodySections = [
    { z: -2.24, w: 0.48, b: 0.22, t: 0.35 },
    { z: -2.08, w: 0.74, b: 0.155, t: 0.44 },
    { z: -1.74, w: 0.94, b: 0.11, t: 0.57 },
    { z: -1.28, w: 0.995, b: 0.1, t: 0.66 },
    { z: -0.66, w: 0.98, b: 0.095, t: 0.705 },
    { z: 0.36, w: 0.99, b: 0.095, t: 0.735 },
    { z: 1.18, w: 1.015, b: 0.105, t: 0.77 },
    { z: 1.82, w: 0.95, b: 0.135, t: 0.735 },
    { z: 2.08, w: 0.82, b: 0.185, t: 0.6 },
    { z: 2.17, w: 0.67, b: 0.24, t: 0.48 },
  ];

  const body = new THREE.Mesh(loftGeometry(bodySections), bodyMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  root.add(body);

  // A darker lower body / rocker mass gives the silver shape a strong shadow line.
  const lowerBodySections = [
    { z: -2.03, w: 0.72, b: 0.075, t: 0.18 },
    { z: -1.25, w: 0.95, b: 0.065, t: 0.19 },
    { z: 0.6, w: 0.96, b: 0.06, t: 0.19 },
    { z: 1.73, w: 0.93, b: 0.07, t: 0.2 },
    { z: 2.12, w: 0.77, b: 0.11, t: 0.26 },
  ];
  const lowerBody = new THREE.Mesh(loftGeometry(lowerBodySections), bodyDarkMaterial);
  lowerBody.castShadow = true;
  root.add(lowerBody);

  /* ------------------------------ canopy ------------------------------- */
  const canopySections = [
    { z: -1.02, w: 0.74, b: 0.7, t: 0.735 },
    { z: -0.55, w: 0.67, b: 0.75, t: 1.005 },
    { z: -0.15, w: 0.555, b: 0.775, t: 1.22 },
    { z: 0.55, w: 0.49, b: 0.785, t: 1.23 },
    { z: 1.04, w: 0.61, b: 0.755, t: 0.985 },
    { z: 1.18, w: 0.72, b: 0.73, t: 0.78 },
  ];
  const canopy = new THREE.Mesh(loftGeometry(canopySections), glassMaterial);
  canopy.castShadow = true;
  root.add(canopy);

  // Canopy frame: A-pillars, roof rails and a B-pillar split.
  const framePoints = [
    [new THREE.Vector3(-0.7, 0.735, -1.0), new THREE.Vector3(-0.505, 1.215, -0.16)],
    [new THREE.Vector3(0.7, 0.735, -1.0), new THREE.Vector3(0.505, 1.215, -0.16)],
    [new THREE.Vector3(-0.505, 1.225, -0.14), new THREE.Vector3(-0.49, 1.23, 0.56)],
    [new THREE.Vector3(0.505, 1.225, -0.14), new THREE.Vector3(0.49, 1.23, 0.56)],
    [new THREE.Vector3(-0.49, 1.23, 0.56), new THREE.Vector3(-0.66, 0.8, 1.14)],
    [new THREE.Vector3(0.49, 1.23, 0.56), new THREE.Vector3(0.66, 0.8, 1.14)],
  ];
  framePoints.forEach(([a, b]) => {
    const rod = rodBetween(a, b, 0.023, chromeMaterial, 6);
    rod.castShadow = true;
    root.add(rod);
  });

  // Center spine on the glass roof.
  const spine = rodBetween(
    new THREE.Vector3(0, 1.235, -0.18),
    new THREE.Vector3(0, 1.24, 0.58),
    0.018,
    carbonMaterial,
    5,
  );
  root.add(spine);

  // Side window blade.
  [[-1, -0.505], [1, 0.505]].forEach(([side]) => {
    const glassBlade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.035, 0.68), chromeMaterial);
    glassBlade.position.set(side * 0.51, 1.13, 0.25);
    glassBlade.rotation.x = -0.025;
    root.add(glassBlade);
  });

  /* ----------------------------- aero parts ---------------------------- */
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.07, 0.38), carbonMaterial);
  splitter.position.set(0, 0.105, -2.09);
  splitter.rotation.x = -0.045;
  splitter.castShadow = true;
  root.add(splitter);

  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.025, 0.12), chromeMaterial);
  frontLip.position.set(0, 0.08, -2.275);
  root.add(frontLip);

  [-1, 1].forEach((side) => {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 2.38), carbonMaterial);
    skirt.position.set(side * 0.985, 0.092, 0.12);
    skirt.castShadow = true;
    root.add(skirt);

    const aeroBlade = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.09, 1.1), carbonMaterial);
    aeroBlade.position.set(side * 1.045, 0.22, 0.15);
    aeroBlade.rotation.z = side * -0.08;
    root.add(aeroBlade);

    const sideMarker = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.16), redLightMaterial);
    sideMarker.position.set(side * 0.99, 0.52, -0.56);
    root.add(sideMarker);
  });

  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.09, 0.34), carbonMaterial);
  diffuser.position.set(0, 0.165, 2.08);
  diffuser.rotation.x = 0.12;
  diffuser.castShadow = true;
  root.add(diffuser);

  // Engine cover / rear deck vent, keeping the flat rear surface from reading as a slab.
  const rearDeckVent = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.018, 0.58), carbonMaterial);
  rearDeckVent.position.set(0, 0.775, 1.12);
  rearDeckVent.rotation.x = -0.025;
  root.add(rearDeckVent);

  for (let i = -2; i <= 2; i += 1) {
    const ventSlat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.012, 0.035), chromeMaterial);
    ventSlat.position.set(0, 0.788, 1.12 + i * 0.1);
    ventSlat.rotation.x = -0.025;
    root.add(ventSlat);
  }

  // Buttresses flow from the canopy into the rear haunches.
  [-1, 1].forEach((side) => {
    const buttress = rodBetween(
      new THREE.Vector3(side * 0.53, 0.82, 0.78),
      new THREE.Vector3(side * 0.69, 0.79, 1.55),
      0.052,
      bodyMaterial,
      5,
    );
    buttress.castShadow = true;
    root.add(buttress);
  });

  for (let i = -3; i <= 3; i += 1) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.1, 0.31), carbonMaterial);
    fin.position.set(i * 0.19, 0.225, 2.1);
    fin.rotation.x = 0.12;
    root.add(fin);
  }

  // Active rear wing.
  const wingPivot = new THREE.Group();
  wingPivot.position.set(0, 1.02, 1.54);
  root.add(wingPivot);

  const wingSupports = new THREE.Group();
  [-1, 1].forEach((side) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.31, 0.16), carbonMaterial);
    support.position.set(side * 0.62, 0.1, 0.06);
    support.rotation.x = -0.18;
    support.castShadow = true;
    wingSupports.add(support);
  });

  // Central swan-neck pylon keeps the wing visibly attached from side-on
  // angles, especially while the car is rolling through a barrel turn.
  const swanNeck = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.54, 0.18), bodyMaterial);
  swanNeck.position.set(0, 0.02, 0.06);
  swanNeck.rotation.x = -0.16;
  swanNeck.castShadow = true;
  wingSupports.add(swanNeck);
  wingPivot.add(wingSupports);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.055, 0.47), bodyMaterial);
  wing.position.set(0, 0.31, 0.08);
  wing.rotation.x = -0.15;
  wing.castShadow = true;
  wingPivot.add(wing);

  const wingUnderside = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.018, 0.43), carbonMaterial);
  wingUnderside.position.set(0, 0.278, 0.08);
  wingUnderside.rotation.x = -0.15;
  wingPivot.add(wingUnderside);

  const wingLeadingEdge = new THREE.Mesh(new THREE.BoxGeometry(1.96, 0.026, 0.035), carbonMaterial);
  wingLeadingEdge.position.set(0, 0.338, -0.145);
  wingLeadingEdge.rotation.x = -0.15;
  wingPivot.add(wingLeadingEdge);

  [-1, 1].forEach((side) => {
    const endplate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.48), carbonMaterial);
    endplate.position.set(side * 0.995, 0.335, 0.08);
    endplate.rotation.x = -0.15;
    wingPivot.add(endplate);
  });

  const wingLight = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.018, 0.025), redLightMaterial);
  wingLight.position.set(0, 0.268, 0.29);
  wingLight.rotation.x = -0.15;
  wingPivot.add(wingLight);

  /* ------------------------------ lighting ----------------------------- */
  const headlightGeometry = new THREE.BoxGeometry(0.56, 0.042, 0.075);
  [-1, 1].forEach((side) => {
    const headlight = new THREE.Mesh(headlightGeometry, whiteLightMaterial);
    headlight.position.set(side * 0.56, 0.475, -2.155);
    headlight.rotation.y = side * -0.16;
    headlight.rotation.z = side * 0.045;
    root.add(headlight);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.018, 0.03), chromeMaterial);
    brow.position.set(side * 0.55, 0.51, -2.14);
    brow.rotation.y = side * -0.16;
    root.add(brow);
  });

  const frontDuct = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.09, 0.06), trimMaterial);
  frontDuct.position.set(0, 0.285, -2.25);
  root.add(frontDuct);

  // Angular daytime-running strips that run back along the fender tops.
  const drlMaterial = new THREE.MeshBasicMaterial({
    color: 0xe6f8ff,
    toneMapped: false,
  });
  [-1, 1].forEach((side) => {
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.024, 0.035), drlMaterial);
    drl.position.set(side * 0.64, 0.555, -1.82);
    drl.rotation.y = side * -0.3;
    drl.rotation.z = side * 0.05;
    root.add(drl);

    const sideVent = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 0.34), carbonMaterial);
    sideVent.position.set(side * 0.995, 0.48, -0.62);
    sideVent.rotation.z = side * -0.08;
    root.add(sideVent);

    for (let i = -1; i <= 1; i += 1) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.015, 0.28), chromeMaterial);
      slat.position.set(side * 1.004, 0.48 + i * 0.045, -0.62);
      slat.rotation.z = side * -0.08;
      root.add(slat);
    }
  });

  // Minimal T badge on the nose.
  const badge = new THREE.Group();
  const badgeBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.012), chromeMaterial);
  badge.add(badgeBar);
  const badgeStem = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.105, 0.012), chromeMaterial);
  badgeStem.position.y = -0.05;
  badge.add(badgeStem);
  badge.position.set(0, 0.405, -2.245);
  badge.rotation.x = -0.22;
  root.add(badge);

  const tailHousing = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.16, 0.08), trimMaterial);
  tailHousing.position.set(0, 0.595, 2.155);
  root.add(tailHousing);

  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.048, 0.025), tailBarMaterial);
  tailBar.position.set(0, 0.595, 2.2);
  root.add(tailBar);

  [-1, 1].forEach((side) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.044, 0.02), redLightMaterial);
    corner.position.set(side * 0.8, 0.595, 2.198);
    root.add(corner);
  });

  const tailGlowTexture = radialTexture(128, [
    [0, 'rgba(255,36,53,.9)'],
    [0.4, 'rgba(255,24,40,.28)'],
    [1, 'rgba(255,10,20,0)'],
  ]);
  const tailGlowMaterial = new THREE.SpriteMaterial({
    map: tailGlowTexture,
    color: 0xff1c2f,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const tailGlow = new THREE.Sprite(tailGlowMaterial);
  tailGlow.position.set(0, 0.59, 2.27);
  tailGlow.scale.set(2.7, 0.75, 1);
  root.add(tailGlow);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.54, 0.135),
    new THREE.MeshBasicMaterial({ map: plateTexture(), toneMapped: false }),
  );
  plate.position.set(0, 0.4, 2.202);
  root.add(plate);

  // A subtle front glow keeps the nose readable against the night road.
  const headlightGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture(128, [
      [0, 'rgba(198,240,255,.75)'],
      [0.52, 'rgba(116,206,255,.12)'],
      [1, 'rgba(50,120,255,0)'],
    ]),
    color: 0xc5efff,
    transparent: true,
    opacity: 0.65,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }));
  headlightGlow.position.set(0, 0.44, -2.31);
  headlightGlow.scale.set(2.7, 0.9, 1);
  root.add(headlightGlow);

  const headlightSpot = new THREE.SpotLight(0xd7f3ff, 18, 46, 0.46, 0.62, 1.2);
  headlightSpot.position.set(0, 0.72, -1.5);
  headlightSpot.target.position.set(0, -0.6, -22);
  root.add(headlightSpot);
  root.add(headlightSpot.target);

  /* ------------------------------- wheels ------------------------------ */
  const wheels = [];
  const steeringPivots = [];
  const wheelPositions = [
    { x: -0.94, z: -1.43, front: true },
    { x: 0.94, z: -1.43, front: true },
    { x: -0.94, z: 1.34, front: false },
    { x: 0.94, z: 1.34, front: false },
  ];

  wheelPositions.forEach(({ x, z, front }) => {
    const wheel = makeWheel(!front, environmentMap);
    wheel.pivot.position.set(x, 0.445, z);
    wheel.spin.rotation.x = front ? 0.2 : 1.1;
    root.add(wheel.pivot);
    wheels.push(wheel.spin);
    if (front) steeringPivots.push(wheel.pivot);
  });

  // Wheel arch lips.
  const archMaterial = new THREE.MeshStandardMaterial({
    color: 0x0b0d10,
    metalness: 0.5,
    roughness: 0.55,
  });
  [-1.43, 1.34].forEach((z) => {
    [-1, 1].forEach((side) => {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.49, 0.055, 6, 22, Math.PI),
        archMaterial,
      );
      arch.position.set(side * 1.0, 0.46, z);
      arch.rotation.y = Math.PI / 2;
      arch.castShadow = true;
      root.add(arch);
    });
  });

  /* ---------------------------- mirrors -------------------------------- */
  [-1, 1].forEach((side) => {
    const start = new THREE.Vector3(side * 0.78, 0.84, -0.31);
    const end = new THREE.Vector3(side * 1.075, 0.92, -0.4);
    const stalk = rodBetween(start, end, 0.018, carbonMaterial, 5);
    root.add(stalk);

    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.07, 0.23), bodyMaterial);
    mirror.position.set(side * 1.1, 0.93, -0.42);
    mirror.rotation.y = side * 0.15;
    mirror.castShadow = true;
    root.add(mirror);

    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.045), glassMaterial);
    mirrorGlass.position.set(side * 1.102, 0.93, -0.535);
    mirrorGlass.rotation.y = Math.PI;
    root.add(mirrorGlass);
  });

  /* ----------------------------- thrusters ----------------------------- */
  const thrusterGroup = new THREE.Group();
  thrusterGroup.position.set(0, 0.34, 2.17);
  root.add(thrusterGroup);

  const thrusterBacking = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.33, 0.1), carbonMaterial);
  thrusterBacking.position.set(0, 0, -0.01);
  thrusterGroup.add(thrusterBacking);

  const nozzleMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b654c,
    metalness: 1,
    roughness: 0.28,
  });
  const nozzleInnerMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a0d09,
    metalness: 0.9,
    roughness: 0.35,
  });

  const flameMaterial = new THREE.MeshBasicMaterial({
    color: 0x4bdcff,
    transparent: true,
    opacity: 0.66,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const flameCoreMaterial = new THREE.MeshBasicMaterial({
    color: 0xe6fdff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const flameTexture = radialTexture(64, [
    [0, 'rgba(226,255,255,.95)'],
    [0.35, 'rgba(88,225,255,.5)'],
    [1, 'rgba(20,80,255,0)'],
  ]);

  const flames = [];
  const nozzleGlows = [];
  const nozzleXs = [-0.63, -0.21, 0.21, 0.63];
  nozzleXs.forEach((x) => {
    const nozzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.135, 0.26, 14, 1, true),
      nozzleMaterial,
    );
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, 0, 0.1);
    thrusterGroup.add(nozzle);

    const throat = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 16),
      nozzleInnerMaterial,
    );
    throat.position.set(x, 0, 0.225);
    thrusterGroup.add(throat);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.125, 1.3, 12, 1, true),
      flameMaterial.clone(),
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.set(x, 0, 0.82);
    flame.visible = false;
    thrusterGroup.add(flame);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.72, 10, 1, true),
      flameCoreMaterial.clone(),
    );
    core.rotation.x = Math.PI / 2;
    core.position.set(x, 0, 0.5);
    core.visible = false;
    thrusterGroup.add(core);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTexture,
      color: 0x8deaff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(x, 0, 0.29);
    glow.scale.set(0.75, 0.75, 1);
    glow.visible = false;
    thrusterGroup.add(glow);

    flames.push({ flame, core, glow, offset: Math.random() * TAU });
    nozzleGlows.push(glow);
  });

  // Underbody lift emitters / cold-gas manifold. These fire together with the
  // rear nozzles at takeoff and carry the car through a controlled landing.
  const liftGroup = new THREE.Group();
  root.add(liftGroup);

  const liftFlames = [];
  const liftPositions = [
    { x: -0.57, z: -1.02 },
    { x: 0.57, z: -1.02 },
    { x: -0.57, z: 0.92 },
    { x: 0.57, z: 0.92 },
  ];

  liftPositions.forEach(({ x, z }) => {
    const pod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.145, 0.175, 0.14, 12, 1, true),
      nozzleMaterial,
    );
    pod.position.set(x, 0.035, z);
    liftGroup.add(pod);

    const podInner = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 12),
      nozzleInnerMaterial,
    );
    podInner.rotation.x = Math.PI / 2;
    podInner.position.set(x, -0.038, z);
    liftGroup.add(podInner);

    const podRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.018, 5, 18),
      chromeMaterial,
    );
    podRing.rotation.x = Math.PI / 2;
    podRing.position.set(x, -0.01, z);
    liftGroup.add(podRing);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 1.3, 12, 1, true),
      flameMaterial.clone(),
    );
    flame.rotation.x = Math.PI;
    flame.position.set(x, -0.6, z);
    flame.visible = false;
    liftGroup.add(flame);

    const core = new THREE.Mesh(
      new THREE.ConeGeometry(0.075, 0.76, 10, 1, true),
      flameCoreMaterial.clone(),
    );
    core.rotation.x = Math.PI;
    core.position.set(x, -0.36, z);
    core.visible = false;
    liftGroup.add(core);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTexture,
      color: 0x9ff4ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    glow.position.set(x, -0.035, z);
    glow.scale.set(0.75, 0.75, 1);
    glow.visible = false;
    liftGroup.add(glow);

    liftFlames.push({ flame, core, glow, offset: Math.random() * TAU, x, z });
  });

  // A dark underbody plate anchors the lift nozzles visually.
  const liftPlate = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.028, 2.45), carbonMaterial);
  liftPlate.position.set(0, 0.088, 0);
  root.add(liftPlate);

  // Mechanical underbody detail: visible when the car pitches forward through
  // its airborne somersault. Kept below the lift plate so it reads as a real
  // service underside rather than a flat panel.
  const axleMaterial = new THREE.MeshStandardMaterial({
    color: 0x59616b,
    metalness: 0.9,
    roughness: 0.32,
  });
  const underRibMaterial = new THREE.MeshStandardMaterial({
    color: 0x161b21,
    metalness: 0.7,
    roughness: 0.4,
  });
  const underSpine = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 2.05), axleMaterial);
  underSpine.position.set(0, 0.041, 0.02);
  root.add(underSpine);

  [-0.58, 0.58].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.026, 2.2), axleMaterial);
    rail.position.set(x, 0.04, 0.02);
    root.add(rail);
  });

  [-1.02, -0.52, 0, 0.52, 1.02].forEach((z) => {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.022, 0.055), underRibMaterial);
    rib.position.set(0, 0.036, z);
    root.add(rib);
  });

  [-1.4, 1.32].forEach((z) => {
    const axle = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.045, 0.045), underRibMaterial);
    axle.position.set(0, 0.26, z);
    root.add(axle);
  });

  const underMark = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.46),
    new THREE.MeshBasicMaterial({
      map: underbodyMarkTexture(),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  underMark.rotation.x = Math.PI / 2;
  underMark.rotation.z = 0;
  underMark.position.set(0, 0.028, 0.32);
  root.add(underMark);

  // Underbody emitters / cold-gas manifold.
  const underGlowMaterial = new THREE.MeshBasicMaterial({
    color: 0x39dfff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const underGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 3.1), underGlowMaterial);
  underGlow.rotation.x = -Math.PI / 2;
  underGlow.position.set(0, 0.055, 0.15);
  root.add(underGlow);

  const undersideStrip = new THREE.Mesh(
    new THREE.BoxGeometry(1.3, 0.014, 0.035),
    new THREE.MeshBasicMaterial({ color: 0x49e7ff, toneMapped: false }),
  );
  undersideStrip.position.set(0, 0.075, 0.9);
  root.add(undersideStrip);
  undersideStrip.visible = false;

  const jetLight = new THREE.PointLight(0x46dcff, 0, 9, 2);
  jetLight.position.set(0, 0.5, 2.4);
  root.add(jetLight);

  const underLight = new THREE.PointLight(0x43dfff, 0, 6, 2);
  underLight.position.set(0, 0.1, 0);
  root.add(underLight);

  /* --------------------------- contact shadow -------------------------- */
  const shadowTexture = radialTexture(256, [
    [0, 'rgba(0,0,0,.95)'],
    [0.45, 'rgba(0,0,0,.6)'],
    [1, 'rgba(0,0,0,0)'],
  ]);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.2, 8.4),
    new THREE.MeshBasicMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      color: 0x000000,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.renderOrder = 1;

  /* ----------------------------- animation ----------------------------- */
  let wheelSpin = 0;

  function update({ dt, elapsed, speed, flight, steer, boost }) {
    const phase = flight.phase || (flight.active ? 'cruise' : 'ground');
    const airborne = phase === 'ascend' || phase === 'cruise' || phase === 'stabilize' || phase === 'descend';

    wheelSpin += (speed / 0.445) * dt * (airborne ? 0.28 : 1);
    wheels.forEach((wheel) => {
      wheel.rotation.x = wheelSpin;
    });

    const steerAngle = THREE.MathUtils.clamp(steer * 0.24, -0.22, 0.22);
    steeringPivots.forEach((pivot) => {
      pivot.rotation.y = steerAngle;
    });

    // The rear nozzles do most of the work on launch and cruise. As the
    // landing sequence starts, authority shifts to the underbody lift jets.
    let rearPower = 0;
    let liftPower = 0;
    if (phase === 'ascend') {
      rearPower = 1.14;
      liftPower = 1.06;
    } else if (phase === 'cruise') {
      rearPower = 0.82;
      liftPower = 0.68;
    } else if (phase === 'stabilize') {
      rearPower = 0.46;
      liftPower = 1.18;
    } else if (phase === 'descend') {
      rearPower = 0;
      liftPower = 1.2 * THREE.MathUtils.clamp(flight.altitude / 0.32, 0.2, 1);
    }

    flames.forEach(({ flame, core, glow, offset }, i) => {
      const visible = rearPower > 0.015;
      flame.visible = visible;
      core.visible = visible;
      glow.visible = visible;
      if (!visible) return;
      const pulse = 0.84 + Math.sin(elapsed * 34 + offset) * 0.12 + Math.sin(elapsed * 71 + offset * 2.1) * 0.06;
      const launch = (0.68 + rearPower * 0.45) * pulse;
      flame.scale.set(pulse, launch + (i % 2) * 0.12, pulse);
      core.scale.set(pulse * 0.9, launch * 0.95, pulse * 0.9);
      flame.material.opacity = (0.32 + rearPower * 0.28) * (0.8 + pulse * 0.2);
      core.material.opacity = (0.56 + rearPower * 0.3) * (0.8 + pulse * 0.2);
      glow.material.opacity = (0.35 + rearPower * 0.4) * (0.8 + pulse * 0.2);
      glow.scale.setScalar(0.52 + rearPower * 0.26 + pulse * 0.18);
    });

    liftFlames.forEach(({ flame, core, glow, offset }, i) => {
      const visible = liftPower > 0.015;
      flame.visible = visible;
      core.visible = visible;
      glow.visible = visible;
      if (!visible) return;
      const pulse = 0.86 + Math.sin(elapsed * 39 + offset) * 0.1 + Math.sin(elapsed * 77 + offset * 1.8) * 0.05;
      const thrust = (0.64 + liftPower * 0.48) * pulse;
      flame.scale.set(pulse * (0.92 + (i % 2) * 0.08), thrust, pulse * (0.92 + (i % 2) * 0.08));
      core.scale.set(pulse * 0.85, thrust * 0.95, pulse * 0.85);
      flame.material.opacity = (0.36 + liftPower * 0.3) * (0.8 + pulse * 0.2);
      core.material.opacity = (0.62 + liftPower * 0.24) * (0.8 + pulse * 0.2);
      glow.material.opacity = (0.4 + liftPower * 0.4) * (0.8 + pulse * 0.2);
      glow.scale.setScalar(0.5 + liftPower * 0.3 + pulse * 0.2);
    });

    const liftGlowStrength = THREE.MathUtils.clamp(liftPower, 0, 1);
    underGlowMaterial.opacity = liftGlowStrength > 0.02
      ? 0.07 + liftGlowStrength * 0.13 + Math.sin(elapsed * 9) * 0.025
      : 0;
    underGlow.visible = liftGlowStrength > 0.02;
    undersideStrip.visible = liftGlowStrength > 0.02;
    jetLight.intensity = THREE.MathUtils.lerp(jetLight.intensity, rearPower * (4.2 + boost * 1.6), 0.16);
    underLight.intensity = THREE.MathUtils.lerp(underLight.intensity, liftPower * 3.7, 0.14);

    // The wing deploys when the car is in the air and tucks at speed on the ground.
    const targetWing = airborne ? 0.2 : 0.035;
    wingPivot.rotation.x = THREE.MathUtils.lerp(wingPivot.rotation.x, -targetWing, 0.08);
    wingPivot.position.y = THREE.MathUtils.lerp(wingPivot.position.y, airborne ? 1.13 : 1.02, 0.06);

    // Make the brake light surge while the pressure system is charging.
    const brakePulse = 1.25 + Math.sin(elapsed * 2.2) * 0.12;
    redLightMaterial.emissiveIntensity = brakePulse + (airborne ? 0.35 : 0);
    whiteLightMaterial.emissiveIntensity = airborne ? 2.8 : 3.25;

    tailGlow.material.opacity = 0.34 + Math.sin(elapsed * 2.6) * 0.05;

    // Headlight reflection on the road.
    headlightGlow.material.opacity = 0.56 + Math.sin(elapsed * 5.1) * 0.04;
  }

  function reset() {
    wheelSpin = 0;
    wheels.forEach((wheel) => { wheel.rotation.x = 0; });
    wingPivot.rotation.x = 0;
    wingPivot.position.y = 1.02;
    if (typeof rollPivot !== 'undefined') {
      rollPivot.rotation.x = 0;
      rollPivot.rotation.y = 0;
      rollPivot.rotation.z = 0;
    }
  }

  // Re-parent the fully built car beneath a center pivot so the airborne
  // spin rotates around the car's mass, not around the road surface.
  const rollPivot = new THREE.Group();
  rollPivot.position.y = 0.58;
  [...root.children].forEach((child) => {
    root.remove(child);
    child.position.y -= 0.58;
    rollPivot.add(child);
  });
  root.add(rollPivot);

  return {
    root,
    rollPivot,
    shadow,
    wheels,
    steeringPivots,
    wingPivot,
    underGlow,
    undersideStrip,
    tailGlow,
    headlightGlow,
    jetLight,
    underLight,
    flames,
    liftFlames,
    update,
    reset,
  };
}
