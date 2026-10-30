import * as THREE from '../vendor/three.module.js';
import { createRoadster } from './car.js';
import { createWorld, LANE_X } from './world.js';
import { AudioEngine } from './audio.js';

/* =========================================================================
   ROADSTER // ROCKET — game director
   ========================================================================= */

const $ = (id) => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
const random = (min, max) => min + Math.random() * (max - min);

const dom = {
  canvas: $('scene'),
  bootLoader: $('bootLoader'),
  bootError: $('bootError'),
  bootErrorText: $('bootErrorText'),
  menu: $('menuScreen'),
  startBtn: $('startBtn'),
  pause: $('pauseScreen'),
  resumeBtn: $('resumeBtn'),
  restartFromPauseBtn: $('restartFromPauseBtn'),
  gameOver: $('gameOverScreen'),
  restartBtn: $('restartBtn'),
  menuBtn: $('menuBtn'),
  pauseBtn: $('pauseBtn'),
  soundBtn: $('soundBtn'),
  distance: $('distanceValue'),
  speed: $('speedValue'),
  bestInline: $('bestInline'),
  difficulty: $('difficultyValue'),
  speedCap: $('speedCapValue'),
  menuBest: $('menuBest'),
  modeChip: $('modeChip'),
  modeChipText: $('modeChipText'),
  chargeValue: $('chargeValue'),
  chargeState: $('chargeState'),
  pressureFill: $('pressureFill'),
  pressureTrack: $('pressureTrack'),
  flightHint: $('flightHint'),
  touchLeft: $('touchLeft'),
  touchRight: $('touchRight'),
  touchFly: $('touchFly'),
  hudAlert: $('hudAlert'),
  hudAlertTitle: $('hudAlertTitle'),
  hudAlertSub: $('hudAlertSub'),
  hudAlertDistance: $('hudAlertDistance'),
  toast: $('toast'),
  screenFlash: $('screenFlash'),
  damageFlash: $('damageFlash'),
  finalDistance: $('finalDistance'),
  finalFlightTime: $('finalFlightTime'),
  finalTopSpeed: $('finalTopSpeed'),
  finalBest: $('finalBest'),
  newBestBadge: $('newBestBadge'),
};

let best = 0;
try {
  best = Number(localStorage.getItem('roadster-rocket-best') || 0) || 0;
} catch {
  best = 0;
}

const game = {
  state: 'menu',
  distance: 0,
  speed: 34,
  charge: 30,
  difficultyLevel: 1,
  elapsed: 0,
  flightTime: 0,
  topSpeed: 0,
  lane: 1,
  carX: 0,
  targetX: 0,
  steer: 0,
  nextSpawnAt: 60,
  lastGateAt: -999,
  gateRef: null,
  crashTimer: 0,
  crashAltitude: 0,
  crashRoll: 0,
  crashPitch: 0,
  toastTimer: 0,
  exhaustAcc: 0,
  liftAcc: 0,
  landingAcc: 0,
  dustAcc: 0,
  gateIntroPlayed: false,
  best,
};

const flight = {
  active: false,
  phase: 'ground',
  altitude: 0,
  maxAltitude: 3.15,
  time: 0,
  throttle: 0,
  descendStart: 0,
  descendDuration: 1.6,
  spinAngle: 0,
  spinSpeed: 0,
  spinTarget: Math.PI * 2,
  landingWarned: false,
};

const FLIGHT_DRAIN = 18.1;
const LANDING_THRESHOLD = 26;
const SPIN_RATE = 1.55;
const TAU = Math.PI * 2;
const alignRollToLevel = (angle) => Math.round(angle / TAU) * TAU;
const DIFFICULTY_STEP_METERS = 1000;
const MAX_DIFFICULTY_LEVEL = 15;
const BASE_SPEED_CAP = 39;
const SPEED_CAP_STEP = 4;
const difficultyLevelForDistance = (distance) => Math.min(
  MAX_DIFFICULTY_LEVEL,
  1 + Math.max(0, Math.floor(distance / DIFFICULTY_STEP_METERS)),
);
const speedCapForLevel = (level) => BASE_SPEED_CAP + (Math.min(level, MAX_DIFFICULTY_LEVEL) - 1) * SPEED_CAP_STEP;

const particles = {
  max: 420,
  head: 0,
  geometry: null,
  material: null,
  points: null,
  data: [],
  positions: null,
  colors: null,
  sizes: null,
  alphas: null,
};

let renderer;
let scene;
let camera;
let world;
let car;
let audio;
let showroom;
let landingGlow;
let showroomRing;
let showroomRingOuter;
let showroomGlow;
let startTime = performance.now();
let lastFrame = performance.now();
let cameraBase = new THREE.Vector3();
let cameraLook = new THREE.Vector3();
let cameraInitialised = false;
let shake = 0;
let timeScale = 1;
let uiCache = {};
let pointerStart = null;
let bestDisplayed = best;

const tempVector = new THREE.Vector3();
const tempVector2 = new THREE.Vector3();
const tempDirection = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();

/* =========================================================================
   boot
   ========================================================================= */

function showFatalError(message) {
  dom.bootLoader.classList.add('is-hidden');
  dom.bootError.hidden = false;
  dom.bootErrorText.textContent = message;
}

window.addEventListener('error', (event) => {
  if (event.error) {
    console.error(event.error);
  }
});

async function boot() {
  try {
    if (!window.WebGLRenderingContext) {
      throw new Error('当前浏览器不支持 WebGL。请使用最新版 Chrome、Edge 或 Safari。');
    }

    // Canvas-painted signage uses the display typeface, so give the local
    // webfont a chance to settle before building textures.
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch { /* fall back to system sans-serif */ }
    }

    renderer = new THREE.WebGLRenderer({
      canvas: dom.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 1200);
    cameraBase.set(5.6, 2.35, -6.7);
    camera.position.copy(cameraBase);
    cameraLook.set(-1.1, 0.6, 0);

    const environmentMap = createEnvironmentMap(renderer);
    if (environmentMap) {
      scene.environment = environmentMap;
      scene.environmentIntensity = 0.4;
    }

    car = createRoadster(environmentMap);
    car.root.position.y = 0.02;
    scene.add(car.root);
    scene.add(car.shadow);

    world = createWorld(scene, renderer);
    world.setMenuMode(true);
    audio = new AudioEngine();
    document.body.classList.toggle('is-muted', audio.muted);

    showroom = createShowroom();
    scene.add(showroom);

    createParticles();
    landingGlow = createLandingGlow();
    scene.add(landingGlow);

    // A soft key light follows the showcase car and makes the silver body pop.
    const showcaseLight = new THREE.PointLight(0xffd8c2, 32, 18, 2);
    showcaseLight.position.set(3.4, 3.4, 2.6);
    scene.add(showcaseLight);
    const showcaseRim = new THREE.PointLight(0x52dfff, 25, 16, 2);
    showcaseRim.position.set(-2.8, 2.4, -3.5);
    scene.add(showcaseRim);
    game.showcaseLight = showcaseLight;
    game.showcaseRim = showcaseRim;

    bindEvents();
    updateBestLabels();
    setScreen('menu');
    dom.bootError.hidden = true;
    resize();
    window.addEventListener('resize', resize);

    requestAnimationFrame(frame);
    window.setTimeout(() => {
      dom.bootLoader.classList.add('is-hidden');
    }, 380);
    window.__RR_READY__ = true;
  } catch (error) {
    console.error(error);
    showFatalError(error.message || '场景初始化失败。');
  }
}

function createShowroom() {
  const group = new THREE.Group();
  group.position.y = 0.015;

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x4fe5ff,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });

  showroomRing = new THREE.Mesh(new THREE.RingGeometry(3.22, 3.27, 100), ringMaterial);
  showroomRing.rotation.x = -Math.PI / 2;
  group.add(showroomRing);

  showroomRingOuter = new THREE.Mesh(
    new THREE.RingGeometry(4.1, 4.13, 100),
    ringMaterial.clone(),
  );
  showroomRingOuter.rotation.x = -Math.PI / 2;
  showroomRingOuter.material.opacity = 0.14;
  group.add(showroomRingOuter);

  const glowTexture = makeParticleTexture();
  showroomGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0x1a90b6,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  showroomGlow.rotation.x = -Math.PI / 2;
  showroomGlow.position.y = -0.005;
  group.add(showroomGlow);

  // Tick marks around the display plinth.
  const tickMaterial = new THREE.MeshBasicMaterial({
    color: 0x8cecff,
    transparent: true,
    opacity: 0.25,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  for (let i = 0; i < 24; i += 1) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.04), tickMaterial);
    const angle = (i / 24) * Math.PI * 2;
    tick.position.set(Math.cos(angle) * 3.67, 0.01, Math.sin(angle) * 3.67);
    tick.rotation.y = -angle;
    group.add(tick);
  }

  return group;
}

function makeParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(48, 48, 0, 48, 48, 45);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(255,255,255,.85)');
  gradient.addColorStop(0.58, 'rgba(255,255,255,.24)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 96, 96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createEnvironmentMap(rendererInstance) {
  // A tiny procedural sunset studio, converted to PMREM for the car's PBR
  // materials. It gives the silver body long, readable reflections without
  // shipping an HDR asset.
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const sky = ctx.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#070912');
  sky.addColorStop(0.36, '#151527');
  sky.addColorStop(0.51, '#623246');
  sky.addColorStop(0.58, '#241624');
  sky.addColorStop(0.72, '#09090d');
  sky.addColorStop(1, '#050508');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 512);

  const sun = ctx.createRadialGradient(232, 260, 0, 232, 260, 145);
  sun.addColorStop(0, 'rgba(255,226,194,.95)');
  sun.addColorStop(0.14, 'rgba(255,159,113,.55)');
  sun.addColorStop(0.5, 'rgba(255,95,94,.13)');
  sun.addColorStop(1, 'rgba(255,70,80,0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, 1024, 512);

  const strips = [
    { x: 630, y: 48, w: 126, h: 122, color: 'rgba(186,233,255,.65)' },
    { x: 815, y: 110, w: 52, h: 205, color: 'rgba(92,218,255,.33)' },
    { x: 350, y: 58, w: 38, h: 130, color: 'rgba(255,184,158,.28)' },
    { x: 510, y: 108, w: 16, h: 170, color: 'rgba(255,255,255,.2)' },
    { x: 95, y: 125, w: 12, h: 135, color: 'rgba(147,225,255,.2)' },
  ];
  strips.forEach((strip) => {
    const glow = ctx.createLinearGradient(strip.x, strip.y, strip.x, strip.y + strip.h);
    glow.addColorStop(0, 'rgba(255,255,255,0)');
    glow.addColorStop(0.22, strip.color);
    glow.addColorStop(0.75, strip.color);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(strip.x, strip.y, strip.w, strip.h);
  });

  const roadGlow = ctx.createLinearGradient(0, 410, 0, 512);
  roadGlow.addColorStop(0, 'rgba(70,106,130,.08)');
  roadGlow.addColorStop(0.35, 'rgba(70,141,170,.23)');
  roadGlow.addColorStop(1, 'rgba(3,5,7,.9)');
  ctx.fillStyle = roadGlow;
  ctx.fillRect(0, 400, 1024, 112);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  try {
    const pmrem = new THREE.PMREMGenerator(rendererInstance);
    pmrem.compileEquirectangularShader();
    const envMap = pmrem.fromEquirectangular(texture).texture;
    texture.dispose();
    pmrem.dispose();
    return envMap;
  } catch (error) {
    console.warn('Environment map unavailable:', error);
    return null;
  }
}

function createLandingGlow() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.8, 8.2),
    new THREE.MeshBasicMaterial({
      map: makeParticleTexture(),
      color: 0x3ee8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.032, 0.25);
  mesh.renderOrder = 2;
  mesh.visible = false;
  return mesh;
}

function createParticles() {  const { max } = particles;
  particles.positions = new Float32Array(max * 3);
  particles.colors = new Float32Array(max * 3);
  particles.sizes = new Float32Array(max);
  particles.alphas = new Float32Array(max);
  particles.data = Array.from({ length: max }, () => ({
    life: 0,
    maxLife: 0,
    velocity: new THREE.Vector3(),
    gravity: 0,
    drag: 0,
    baseSize: 0,
    baseAlpha: 0,
    color: new THREE.Color(),
  }));

  particles.geometry = new THREE.BufferGeometry();
  particles.geometry.setAttribute('position', new THREE.BufferAttribute(particles.positions, 3));
  particles.geometry.setAttribute('aColor', new THREE.BufferAttribute(particles.colors, 3));
  particles.geometry.setAttribute('aSize', new THREE.BufferAttribute(particles.sizes, 1));
  particles.geometry.setAttribute('aAlpha', new THREE.BufferAttribute(particles.alphas, 1));

  particles.material = new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: makeParticleTexture() },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.8) },
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (320.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        float alpha = tex.a * vAlpha;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });

  particles.points = new THREE.Points(particles.geometry, particles.material);
  particles.points.frustumCulled = false;
  scene.add(particles.points);
}

function spawnParticle({ x, y, z, vx, vy, vz, color, size, life, gravity = 0, drag = 0 }) {
  const i = particles.head;
  particles.head = (particles.head + 1) % particles.max;
  const p = particles.data[i];
  p.life = life;
  p.maxLife = life;
  p.velocity.set(vx, vy, vz);
  p.gravity = gravity;
  p.drag = drag;
  p.baseSize = size;
  p.baseAlpha = 1;
  if (color instanceof THREE.Color) p.color.copy(color);
  else p.color.set(color);
  particles.positions[i * 3] = x;
  particles.positions[i * 3 + 1] = y;
  particles.positions[i * 3 + 2] = z;
  particles.colors[i * 3] = p.color.r;
  particles.colors[i * 3 + 1] = p.color.g;
  particles.colors[i * 3 + 2] = p.color.b;
  particles.sizes[i] = size;
  particles.alphas[i] = 1;
}

function clearParticles() {
  particles.data.forEach((p) => { p.life = 0; });
  particles.alphas.fill(0);
  particles.geometry.attributes.aAlpha.needsUpdate = true;
}

function updateParticles(dt) {
  let any = false;
  for (let i = 0; i < particles.max; i += 1) {
    const p = particles.data[i];
    if (p.life <= 0) {
      if (particles.alphas[i] !== 0) {
        particles.alphas[i] = 0;
        any = true;
      }
      continue;
    }
    any = true;
    p.life -= dt;
    const k = Math.max(p.life / p.maxLife, 0);
    if (p.life <= 0) {
      particles.alphas[i] = 0;
      continue;
    }
    p.velocity.y += p.gravity * dt;
    if (p.drag > 0) {
      const drag = Math.max(0, 1 - p.drag * dt);
      p.velocity.multiplyScalar(drag);
    }
    particles.positions[i * 3] += p.velocity.x * dt;
    particles.positions[i * 3 + 1] += p.velocity.y * dt;
    particles.positions[i * 3 + 2] += p.velocity.z * dt;
    particles.alphas[i] = Math.pow(k, 0.65);
    particles.sizes[i] = p.baseSize * (0.55 + k * 0.75);
  }
  if (any) {
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.aColor.needsUpdate = true;
    particles.geometry.attributes.aSize.needsUpdate = true;
    particles.geometry.attributes.aAlpha.needsUpdate = true;
  }
}

/* =========================================================================
   flow
   ========================================================================= */

function setScreen(screen) {
  game.state = screen === 'menu' ? 'menu' : screen === 'gameover' ? 'gameover' : screen === 'paused' ? 'paused' : 'playing';
  document.body.dataset.screen = screen;

  dom.menu.classList.toggle('is-active', screen === 'menu');
  dom.pause.classList.toggle('is-active', screen === 'paused');
  dom.gameOver.classList.toggle('is-active', screen === 'gameover');

  if (screen === 'menu') {
    showroom.visible = true;
    world.setMenuMode(true);
    document.body.classList.remove('is-flying', 'is-ready', 'is-landing', 'is-boosting');
    dom.hudAlert.classList.remove('is-visible');
  }

  if (screen === 'playing' || screen === 'paused') {
    world.setMenuMode(false);
  }

  if (screen === 'gameover') {
    document.body.classList.remove('is-flying', 'is-ready', 'is-landing', 'is-boosting');
    dom.hudAlert.classList.remove('is-visible');
  }

  if (screen === 'paused') {
    document.body.classList.remove('is-boosting');
  }
}

function resetRun() {
  world.reset();
  car.reset();
  clearParticles();
  game.distance = 0;
  game.speed = 34;
  game.charge = 30;
  game.difficultyLevel = 1;
  game.elapsed = 0;
  game.flightTime = 0;
  game.topSpeed = 0;
  game.lane = 1;
  game.carX = 0;
  game.targetX = 0;
  game.steer = 0;
  game.nextSpawnAt = 58;
  game.lastGateAt = -999;
  game.gateRef = null;
  game.crashTimer = 0;
  game.crashAltitude = 0;
  game.crashRoll = 0;
  game.crashPitch = 0;
  game.toastTimer = 0;
  game.exhaustAcc = 0;
  game.liftAcc = 0;
  game.landingAcc = 0;
  game.dustAcc = 0;
  game.gateIntroPlayed = false;

  flight.active = false;
  flight.phase = 'ground';
  flight.altitude = 0;
  flight.time = 0;
  flight.throttle = 0;
  flight.descendStart = 0;
  flight.spinAngle = 0;
  flight.spinSpeed = 0;
  flight.spinTarget = TAU;
  flight.landingWarned = false;

  car.root.position.set(0, 0.02, 0);
  car.root.rotation.set(0, 0, 0);
  car.rollPivot.rotation.x = 0;
  car.rollPivot.rotation.y = 0;
  car.rollPivot.rotation.z = 0;
  car.shadow.position.set(0, 0.018, 0);
  car.shadow.scale.set(1, 1, 1);
  car.shadow.material.opacity = 0.72;

  shake = 0;
  timeScale = 1;
  if (landingGlow) {
    landingGlow.visible = false;
    landingGlow.material.opacity = 0;
  }
  document.body.classList.remove('is-flying', 'is-ready', 'is-landing', 'is-boosting');
  dom.hudAlert.classList.remove('is-visible');
  uiCache = {};

  // Put an early obstacle in the distance; the spawn scheduler handles the rest.
  world.spawnTrafficCar(Math.random() > 0.5 ? 0 : 2, 86);
  updateHUD(true);
}

async function startGame() {
  try {
    audio.unlock();
  } catch (error) {
    console.warn('Audio unavailable:', error);
  }
  resetRun();
  setScreen('playing');
  showroom.visible = false;
  world.setMenuMode(false);
  flashScreen(dom.screenFlash);
  showToast('地面模式 · 变道避障，冷气系统自动充能', 2.6);
  audio.takeoff();
}

function restartGame() {
  if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover') {
    startGame();
  }
}

function goToMenu() {
  world.clearObstacles();
  resetPresentation();
  setScreen('menu');
  updateBestLabels();
  uiCache = {};
}

function resetPresentation() {
  flight.active = false;
  flight.phase = 'ground';
  flight.altitude = 0;
  game.carX = 0;
  game.targetX = 0;
  game.lane = 1;
  game.speed = 0;
  flight.spinAngle = 0;
  flight.spinSpeed = 0;
  flight.spinTarget = TAU;
  flight.landingWarned = false;
  car.root.position.set(0, 0.02, 0);
  car.root.rotation.set(0, 0, 0);
  car.rollPivot.rotation.x = 0;
  car.rollPivot.rotation.y = 0;
  car.rollPivot.rotation.z = 0;
  car.shadow.position.set(0, 0.018, 0);
  car.shadow.material.opacity = 0.72;
  car.shadow.scale.set(1, 1, 1);
  if (landingGlow) {
    landingGlow.visible = false;
    landingGlow.material.opacity = 0;
  }
  clearParticles();
  document.body.classList.remove('is-flying', 'is-ready', 'is-landing', 'is-boosting');
}

function pauseGame() {
  if (game.state !== 'playing') return;
  setScreen('paused');
  dom.hudAlert.classList.remove('is-visible');
  audio.update({ active: false });
}

async function resumeGame() {
  if (game.state !== 'paused') return;
  audio.unlock();
  setScreen('playing');
  lastFrame = performance.now();
}

function togglePause() {
  if (game.state === 'playing') pauseGame();
  else if (game.state === 'paused') resumeGame();
}

/* =========================================================================
   gameplay
   ========================================================================= */

function steer(direction) {
  if (game.state !== 'playing') return;
  const next = clamp(game.lane + direction, 0, 2);
  if (next === game.lane) {
    shake = Math.max(shake, 0.02);
    return;
  }
  game.lane = next;
  game.targetX = LANE_X[next];
  audio.laneChange(direction);
}

function tryFly(force = false) {
  if (game.state !== 'playing') return false;
  if (flight.active) return false;
  if (flight.phase === 'descend') {
    showToast('正在着陆 · 等待反推结束', 1.2);
    return false;
  }
  if (game.charge < 99.5 && !force) {
    showToast(`冷气压力不足 · 还差 ${Math.ceil(100 - game.charge)}%`, 1.1);
    return false;
  }

  game.charge = Math.min(100, game.charge);
  flight.active = true;
  flight.phase = 'ascend';
  flight.time = 0;
  flight.throttle = 0;
  flight.altitude = Math.max(flight.altitude, 0.02);
  flight.spinAngle = 0;
  flight.spinSpeed = 0;
  flight.spinTarget = TAU;
  flight.landingWarned = false;
  car.rollPivot.rotation.x = 0;
  car.rollPivot.rotation.y = 0;
  car.rollPivot.rotation.z = 0;
  document.body.classList.add('is-flying', 'is-boosting');
  document.body.classList.remove('is-ready', 'is-landing');
  shake = Math.max(shake, 0.18);
  flashScreen(dom.screenFlash);
  audio.takeoff();
  showToast('底盘与尾部同时点火 · 起飞', 1.4);
  spawnTakeoffBurst();
  window.setTimeout(() => document.body.classList.remove('is-boosting'), 1100);

  const remaining = game.charge;
  if (remaining < 25 && !force) {
    showToast('气压偏低 · 飞行时间有限', 1.4);
  }
  return true;
}

function spawnObstacleRow() {
  const level = game.difficultyLevel;
  const twoLaneChance = Math.min(0.9, 0.18 + (level - 1) * 0.1);
  const blockers = [];

  if (Math.random() < twoLaneChance) {
    const safeLane = Math.floor(Math.random() * 3);
    for (let lane = 0; lane < 3; lane += 1) {
      if (lane !== safeLane) blockers.push(lane);
    }
  } else {
    blockers.push(Math.floor(Math.random() * 3));
  }

  blockers.forEach((lane, index) => {
    const zOffset = blockers.length > 1 ? (index === 0 ? -2.2 : 2.2) : 0;
    if (Math.random() < 0.52) {
      world.spawnBarrier(lane, zOffset);
    } else {
      world.spawnTrafficCar(lane, zOffset);
    }
  });
}

function spawnGate() {
  if (world.gate) return;
  world.spawnGate(game.distance);
  game.lastGateAt = game.distance;
  game.gateRef = world.gate;
  game.gateIntroPlayed = false;
  shake = Math.max(shake, 0.12);
  audio.chime();
}

function updatePlaying(dt) {
  game.elapsed += dt;

  const speedCap = speedCapForLevel(game.difficultyLevel);
  const speedTarget = Math.min(34 + game.distance * 0.012, speedCap) + (flight.active ? 4 : 0);
  game.speed = damp(game.speed, speedTarget, 0.55, dt);
  game.distance += game.speed * dt;
  game.topSpeed = Math.max(game.topSpeed, game.speed * 3.6);
  game.flightTime += flight.active ? dt : 0;

  const nextDifficulty = difficultyLevelForDistance(game.distance);
  if (nextDifficulty > game.difficultyLevel) {
    game.difficultyLevel = nextDifficulty;
    const capKmh = Math.round(speedCapForLevel(nextDifficulty) * 3.6);
    showToast(`难度提升 · LV.${String(nextDifficulty).padStart(2, '0')} · 障碍增多 / 上限 ${capKmh} km/h`, 2.1);
    audio.chime();
    shake = Math.max(shake, 0.06);
  }

  // Smooth lateral lane motion.
  game.carX = damp(game.carX, game.targetX, 9.2, dt);
  game.steer = damp(game.steer, clamp((game.targetX - game.carX) * 0.5, -0.85, 0.85), 8, dt);

  updateFlight(dt);

  const rate = 9.5 + Math.min(game.distance * 0.0004, 2.4);
  if (!flight.active && flight.phase !== 'descend') {
    game.charge = Math.min(100, game.charge + rate * dt);
  }

  while (game.distance >= game.nextSpawnAt) {
    spawnObstacleRow();
    const gap = Math.max(56, 86 - (game.difficultyLevel - 1) * 5);
    game.nextSpawnAt += gap * random(0.9, 1.12);
  }

  if (
    game.charge >= 99.9 &&
    !world.gate &&
    game.distance - game.lastGateAt > 330 &&
    game.distance > 90 &&
    !flight.active
  ) {
    spawnGate();
  }

  const gateBefore = world.gate;
  world.updateObstacles(dt * timeScale, game.speed, game.elapsed);
  if (gateBefore && !world.gate) {
    game.gateRef = null;
    showToast('封锁线已越过 · BLOCK CLEARED', 1.6);
    audio.chime();
  }

  world.update(dt, game.distance, game.speed, game.elapsed);

  updateCarTransform(dt);
  updateExhaust(dt);

  if (game.state === 'playing') {
    checkNearMisses();
    const hit = world.checkCollision(game.carX, flight.altitude);
    if (hit) {
      triggerCrash(hit);
    }
  }
}

function updateFlight(dt) {
  if (flight.active) {
    flight.time += dt;
    flight.throttle = damp(flight.throttle, 1, 3.4, dt);
    game.charge = Math.max(0, game.charge - FLIGHT_DRAIN * dt);

    if (flight.phase === 'ascend') {
      const k = clamp(flight.time / 0.98, 0, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      flight.altitude = flight.maxAltitude * eased;
      if (k >= 1) flight.phase = 'cruise';
    } else if (flight.phase === 'cruise' || flight.phase === 'stabilize') {
      const bob = flight.phase === 'stabilize' ? 0.016 : 0.055;
      flight.altitude = flight.maxAltitude + Math.sin((flight.time - 0.98) * 3.2) * bob;
    }

    // Begin the landing sequence while there is still enough pressure to
    // spin the car level and switch authority to the underbody lift jets.
    if (flight.phase !== 'stabilize' && game.charge <= LANDING_THRESHOLD) {
      flight.phase = 'stabilize';
      flight.spinTarget = alignRollToLevel(flight.spinAngle);
      if (flight.spinAngle < 0.7) flight.spinTarget = 0;
      if (!flight.landingWarned) {
        flight.landingWarned = true;
        document.body.classList.add('is-landing');
        showToast('侧滚姿态回正 · 底盘反推准备着陆', 1.8);
        audio.chime();
      }
    }

    if (flight.phase === 'ascend' || flight.phase === 'cruise') {
      const ramp = clamp((flight.altitude - 1.15) / 0.75, 0, 1);
      flight.spinSpeed = damp(flight.spinSpeed, SPIN_RATE * ramp, 2.7, dt);
      flight.spinAngle += flight.spinSpeed * dt;
    } else if (flight.phase === 'stabilize') {
      flight.spinSpeed = damp(flight.spinSpeed, 0, 5.5, dt);
      flight.spinAngle = damp(flight.spinAngle, flight.spinTarget, 4.6, dt);
      if (Math.abs(flight.spinAngle - flight.spinTarget) < 0.002) {
        flight.spinAngle = flight.spinTarget;
      }
    }
    car.rollPivot.rotation.x = 0;
    car.rollPivot.rotation.y = 0;
    car.rollPivot.rotation.z = flight.spinAngle;

    if (game.charge <= 0.01) {
      game.charge = 0;
      flight.active = false;
      flight.phase = 'descend';
      flight.time = 0;
      flight.descendStart = flight.altitude;
      flight.spinTarget = alignRollToLevel(flight.spinAngle);
      flight.throttle = 0.5;
      document.body.classList.remove('is-flying', 'is-boosting');
      document.body.classList.add('is-landing');
      audio.noiseBurst({
        duration: 1.25,
        gain: 0.05,
        startFreq: 1100,
        endFreq: 180,
        q: 0.62,
      });
      showToast('反推着陆 · 姿态锁定', 1.25);
    }
  } else if (flight.phase === 'descend') {
    flight.time += dt;
    flight.throttle = damp(flight.throttle, 0.35, 2.4, dt);
    flight.spinSpeed = damp(flight.spinSpeed, 0, 6, dt);
    flight.spinAngle = damp(flight.spinAngle, flight.spinTarget, 5.5, dt);
    if (Math.abs(flight.spinAngle - flight.spinTarget) < 0.002) {
      flight.spinAngle = flight.spinTarget;
    }
    car.rollPivot.rotation.x = 0;
    car.rollPivot.rotation.y = 0;
    car.rollPivot.rotation.z = flight.spinAngle;

    const k = clamp(flight.time / flight.descendDuration, 0, 1);
    // Smootherstep: zero vertical velocity and acceleration at touchdown.
    const smooth = k * k * k * (k * (k * 6 - 15) + 10);
    flight.altitude = flight.descendStart * (1 - smooth);

    if (k >= 1) {
      flight.altitude = 0;
      flight.phase = 'ground';
      flight.throttle = 0;
      flight.spinAngle = 0;
      car.rollPivot.rotation.x = 0;
      car.rollPivot.rotation.y = 0;
      car.rollPivot.rotation.z = 0;
      document.body.classList.remove('is-landing');
      audio.land();
      spawnLandingBurst(0.9);
      shake = Math.max(shake, 0.035);
      showToast('平稳着陆 · 返回地面模式', 1.2);
    }
  } else {
    flight.altitude = 0;
    flight.throttle = damp(flight.throttle, 0, 5, dt);
    flight.spinAngle = 0;
    flight.spinSpeed = 0;
    car.rollPivot.rotation.x = 0;
    car.rollPivot.rotation.y = 0;
    car.rollPivot.rotation.z = 0;
  }
}

function updateCarTransform(dt) {
  car.root.position.x = game.carX;
  car.root.position.z = 0;

  const airborne = flight.phase === 'ascend'
    || flight.phase === 'cruise'
    || flight.phase === 'stabilize'
    || flight.phase === 'descend';
  const groundBob = flight.phase === 'ground' ? Math.sin(game.elapsed * 16) * Math.min(0.008, game.speed * 0.00016) : 0;
  const airBob = (flight.phase === 'cruise' || flight.phase === 'stabilize')
    ? Math.sin(game.elapsed * 3.1) * (flight.phase === 'cruise' ? 0.035 : 0.012)
    : 0;
  car.root.position.y = 0.02 + flight.altitude + groundBob + airBob;

  let pitchTarget = 0;
  if (flight.phase === 'ascend') pitchTarget = 0.125;
  else if (flight.phase === 'cruise') pitchTarget = 0.027;
  else if (flight.phase === 'stabilize') pitchTarget = 0.012;
  else if (flight.phase === 'descend') pitchTarget = -0.018;
  else pitchTarget = -Math.min(game.speed * 0.00006, 0.006);

  if (game.state === 'crashing' || game.state === 'gameover') {
    pitchTarget = game.crashPitch;
  }

  const rollTarget = (game.state === 'crashing' || game.state === 'gameover')
    ? game.crashRoll
    : -game.steer * (airborne ? 0.035 : 0.055);

  car.root.rotation.x = damp(car.root.rotation.x, pitchTarget, 6.5, dt);
  car.root.rotation.z = damp(car.root.rotation.z, rollTarget, 7, dt);
  car.root.rotation.y = damp(car.root.rotation.y, -game.steer * 0.025, 6, dt);

  car.shadow.position.x = game.carX;
  car.shadow.position.z = 0.02;
  const shadowScale = 1 + flight.altitude * 0.085;
  car.shadow.scale.set(shadowScale, shadowScale, 1);
  car.shadow.material.opacity = 0.7 * clamp(1 - flight.altitude / 7.5, 0, 1);

  if (landingGlow) {
    const descentGlow = flight.phase === 'descend'
      ? clamp(1 - flight.altitude / 3.35, 0, 1)
      : 0;
    if (descentGlow > 0.012) {
      landingGlow.visible = true;
      landingGlow.position.x = game.carX;
      landingGlow.position.z = 0.3;
      const pulse = 0.9 + Math.sin(game.elapsed * 13) * 0.08;
      landingGlow.scale.setScalar(0.8 + descentGlow * 0.62);
      landingGlow.material.opacity = (0.08 + descentGlow * 0.32) * pulse;
    } else {
      landingGlow.material.opacity = damp(landingGlow.material.opacity, 0, 12, dt);
      if (landingGlow.material.opacity < 0.005) landingGlow.visible = false;
    }
  }

  car.update({
    dt: flight.phase === 'ground' ? dt : dt * 0.9,
    elapsed: game.elapsed,
    speed: game.speed,
    flight: {
      active: flight.active,
      phase: flight.phase,
      altitude: flight.altitude,
      maxAltitude: flight.maxAltitude,
      throttle: flight.throttle,
    },
    steer: game.steer,
    boost: document.body.classList.contains('is-boosting') ? 1 : 0,
  });
}

function updateExhaust(dt) {
  const phase = flight.phase;
  const rearPowered = phase === 'ascend' || phase === 'cruise' || phase === 'stabilize';
  const liftPowered = phase === 'ascend' || phase === 'cruise' || phase === 'stabilize' || phase === 'descend';

  if (rearPowered || liftPowered) {
    // Match the emitters to the rolling body so the plumes describe the
    // car's actual rotating attitude instead of floating in body space.
    car.root.updateMatrixWorld(true);
    car.rollPivot.getWorldQuaternion(tempQuaternion);

    if (rearPowered) {
      game.exhaustAcc += dt * (phase === 'ascend' ? 110 : 72);
      while (game.exhaustAcc >= 1) {
        game.exhaustAcc -= 1;
        const nozzle = car.flames[Math.floor(Math.random() * car.flames.length)];
        nozzle.glow.getWorldPosition(tempVector);
        tempDirection.set(0, 0, 1).applyQuaternion(tempQuaternion);
        spawnParticle({
          x: tempVector.x + random(-0.06, 0.06),
          y: tempVector.y + random(-0.05, 0.05),
          z: tempVector.z + random(-0.04, 0.08),
          vx: tempDirection.x * random(3.4, 7.2) + random(-0.4, 0.4),
          vy: tempDirection.y * random(3.4, 7.2) + random(-0.3, 0.28),
          vz: tempDirection.z * random(3.4, 7.2) + random(-0.3, 0.3),
          color: Math.random() > 0.35 ? 0x55e6ff : 0xcafaff,
          size: random(0.12, 0.3),
          life: random(0.35, 0.72),
          drag: 1.6,
        });
      }
    }

    if (liftPowered) {
      game.liftAcc += dt * (phase === 'descend' ? 125 : 150);
      while (game.liftAcc >= 1) {
        game.liftAcc -= 1;
        const nozzle = car.liftFlames[Math.floor(Math.random() * car.liftFlames.length)];
        nozzle.glow.getWorldPosition(tempVector);
        tempDirection.set(0, -1, 0).applyQuaternion(tempQuaternion);
        const thrust = random(2.8, 6.4);
        spawnParticle({
          x: tempVector.x + random(-0.07, 0.07),
          y: tempVector.y - 0.04,
          z: tempVector.z + random(-0.07, 0.07),
          vx: tempDirection.x * thrust + random(-0.7, 0.7),
          vy: tempDirection.y * thrust + random(-0.2, 0.45),
          vz: tempDirection.z * thrust + random(-0.7, 0.7),
          color: Math.random() > 0.3 ? 0x68efff : 0xe4ffff,
          size: random(0.1, 0.28),
          life: random(0.28, 0.62),
          drag: 1.9,
        });
      }
    }
  } else if (phase === 'ground' && game.speed > 24 && game.state === 'playing') {
    game.dustAcc += dt * 7;
    while (game.dustAcc >= 1) {
      game.dustAcc -= 1;
      const side = Math.random() > 0.5 ? -1 : 1;
      spawnParticle({
        x: game.carX + side * random(0.76, 1.02),
        y: 0.08,
        z: random(1.1, 1.8),
        vx: side * random(0.05, 0.3),
        vy: random(0.1, 0.35),
        vz: random(1.2, 3.5),
        color: Math.random() > 0.5 ? 0x938d8a : 0x4f6d7a,
        size: random(0.08, 0.2),
        life: random(0.25, 0.55),
        gravity: -0.6,
        drag: 2.2,
      });
    }
  }

  // Ground effect during the last part of the descent. The underbody jets
  // kick grit and warm blue light out from under the chassis as it settles.
  if (phase === 'descend') {
    const proximity = clamp(1 - flight.altitude / 1.9, 0, 1);
    if (proximity > 0.015) {
      game.landingAcc += dt * 88 * proximity;
      while (game.landingAcc >= 1) {
        game.landingAcc -= 1;
        const angle = Math.random() * Math.PI * 2;
        const radius = random(0.55, 1.75);
        spawnParticle({
          x: game.carX + Math.cos(angle) * radius,
          y: 0.07,
          z: 0.3 + Math.sin(angle) * radius * 0.7,
          vx: Math.cos(angle) * random(0.8, 3.4) * proximity,
          vy: random(0.15, 0.8) * proximity,
          vz: Math.sin(angle) * random(0.6, 2.4) * proximity,
          color: Math.random() > 0.42 ? 0x77efff : 0xb9b2a0,
          size: random(0.09, 0.28),
          life: random(0.25, 0.65),
          gravity: -0.7,
          drag: 2.5,
        });
      }
    }
  }
}

function spawnTakeoffBurst() {
  for (let i = 0; i < 70; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = random(0.2, 1.5);
    spawnParticle({
      x: game.carX + Math.cos(angle) * radius,
      y: 0.12 + Math.random() * 0.25,
      z: random(-1.8, 1.8),
      vx: Math.cos(angle) * random(0.5, 2.3),
      vy: random(0.3, 2.1),
      vz: random(-0.8, 2.2),
      color: Math.random() > 0.25 ? 0x64e8ff : 0xe1ffff,
      size: random(0.16, 0.45),
      life: random(0.4, 1.1),
      gravity: -1.2,
      drag: 1.8,
    });
  }

  // The chassis lift jets hammer the road while the rear nozzles kick the car
  // forward. Both bursts are deliberately spawned on the same frame.
  const liftOffsets = [-0.57, 0.57];
  for (let i = 0; i < 56; i += 1) {
    const x = liftOffsets[i % 2];
    const z = i % 4 < 2 ? -1.02 : 0.92;
    spawnParticle({
      x: game.carX + x + random(-0.12, 0.12),
      y: 0.1,
      z: z + random(-0.1, 0.1),
      vx: random(-1.35, 1.35),
      vy: random(-4.6, -2.2),
      vz: random(-0.75, 0.75),
      color: Math.random() > 0.28 ? 0x74efff : 0xeaffff,
      size: random(0.13, 0.36),
      life: random(0.3, 0.72),
      gravity: -1.4,
      drag: 1.4,
    });
  }

  for (let i = 0; i < 34; i += 1) {
    const x = [-0.63, -0.21, 0.21, 0.63][i % 4];
    spawnParticle({
      x: game.carX + x + random(-0.06, 0.06),
      y: 0.34 + random(-0.06, 0.06),
      z: 2.26 + random(-0.03, 0.06),
      vx: random(-0.35, 0.35),
      vy: random(-0.15, 0.22),
      vz: random(3.1, 6.8),
      color: Math.random() > 0.35 ? 0x54e7ff : 0xe6ffff,
      size: random(0.1, 0.26),
      life: random(0.32, 0.68),
      drag: 1.7,
    });
  }

  for (let i = 0; i < 18; i += 1) {
    spawnParticle({
      x: game.carX + random(-0.9, 0.9),
      y: flight.altitude + 0.4,
      z: random(1.5, 2.9),
      vx: random(-0.2, 0.2),
      vy: random(0.2, 0.7),
      vz: random(1.4, 3.2),
      color: 0xd8fbff,
      size: random(0.1, 0.23),
      life: random(0.35, 0.8),
      drag: 1.2,
    });
  }
}

function spawnLandingBurst(strength = 1) {
  for (let i = 0; i < Math.round(34 * strength); i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const radius = random(0.3, 2.1);
    spawnParticle({
      x: game.carX + Math.cos(angle) * radius,
      y: 0.08,
      z: Math.sin(angle) * radius * 0.6,
      vx: Math.cos(angle) * random(0.8, 2.8),
      vy: random(0.05, 0.55),
      vz: Math.sin(angle) * random(0.4, 1.5),
      color: Math.random() > 0.4 ? 0x61e5ff : 0xbfb7a3,
      size: random(0.14, 0.4),
      life: random(0.3, 0.9),
      gravity: -1.7,
      drag: 2.4,
    });
  }
}

function checkNearMisses() {
  for (const obstacle of world.obstacles) {
    const data = obstacle.userData.collision;
    if (!data || data.passed) continue;
    if (obstacle.position.z > 2.1) {
      data.passed = true;
      const dx = Math.abs(obstacle.position.x - game.carX);
      if (dx < data.halfW + 1.55 && flight.altitude < 0.9) {
        audio.nearMiss();
        shake = Math.max(shake, 0.055);
      }
    }
  }
}

function triggerCrash(hit) {
  if (game.state !== 'playing') return;
  game.state = 'crashing';
  game.crashTimer = 0;
  game.crashAltitude = flight.altitude;
  game.crashRoll = random(-0.42, 0.42);
  game.crashPitch = random(-0.16, 0.11);
  flight.active = false;
  flight.phase = 'crashed';
  flight.throttle = 0;
  document.body.classList.remove('is-ready', 'is-flying', 'is-landing', 'is-boosting');
  dom.hudAlert.classList.remove('is-visible');
  if (landingGlow) landingGlow.visible = false;
  shake = 1.25;
  audio.crash();
  damageFlash(dom.damageFlash);
  spawnCrashBurst(hit);
  const obstacle = hit.obstacle;
  if (obstacle) {
    tempVector.copy(obstacle.position);
    tempVector.x = game.carX;
    obstacle.position.x += random(-0.22, 0.22);
  }
}

function spawnCrashBurst(hit) {
  const x = game.carX;
  const y = Math.max(0.5, game.crashAltitude + 0.5);
  for (let i = 0; i < 150; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = random(1.5, 9.5);
    const isHot = Math.random() > 0.28;
    spawnParticle({
      x: x + random(-0.7, 0.7),
      y: y + random(-0.4, 0.8),
      z: random(-2.1, 2.2),
      vx: Math.cos(angle) * speed * random(0.4, 1),
      vy: random(0.6, 6.5),
      vz: Math.sin(angle) * speed * random(0.3, 0.9),
      color: isHot
        ? (Math.random() > 0.45 ? 0xffb15c : 0xff5535)
        : (Math.random() > 0.5 ? 0x79e5ff : 0xffe5b8),
      size: random(0.18, 0.75),
      life: random(0.45, 1.55),
      gravity: -7.5,
      drag: 0.55,
    });
  }
  for (let i = 0; i < 40; i += 1) {
    spawnParticle({
      x: x + random(-1.4, 1.4),
      y: y + random(-0.3, 1.4),
      z: random(-1.8, 2.2),
      vx: random(-2.5, 2.5),
      vy: random(0.2, 2.4),
      vz: random(-1.5, 2.2),
      color: 0x5b4d55,
      size: random(0.4, 1.15),
      life: random(0.7, 2.1),
      gravity: -0.7,
      drag: 1.4,
    });
  }
  if (hit && hit.obstacle) {
    // A quick shockwave ring at the impact point.
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      spawnParticle({
        x,
        y: 0.1,
        z: 1.7,
        vx: Math.cos(a) * 7.5,
        vy: 0.2,
        vz: Math.sin(a) * 7.5,
        color: 0xffd7a3,
        size: 0.16,
        life: 0.4,
        drag: 2.5,
      });
    }
  }
}

function updateCrashing(dt) {
  game.crashTimer += dt;
  game.speed = damp(game.speed, 0, 3.5, dt);
  flight.altitude = damp(flight.altitude, 0, 2.6, dt);
  updateCarTransform(dt);
  updateParticles(dt);
  shake = damp(shake, 0, 2.2, dt);

  if (game.crashTimer > 1.22 && game.state === 'crashing') {
    showGameOver();
  }
}

function showGameOver() {
  game.state = 'gameover';
  game.speed = 0;
  const finalScore = Math.floor(game.distance);
  const isNewBest = finalScore > bestDisplayed;
  if (isNewBest) {
    best = finalScore;
    bestDisplayed = finalScore;
    try {
      localStorage.setItem('roadster-rocket-best', String(best));
    } catch { /* storage may be blocked */ }
  }
  dom.finalDistance.textContent = finalScore.toLocaleString('en-US');
  dom.finalFlightTime.textContent = `${game.flightTime.toFixed(1)}s`;
  dom.finalTopSpeed.textContent = Math.round(game.topSpeed).toLocaleString('en-US');
  dom.finalBest.textContent = best.toLocaleString('en-US');
  dom.newBestBadge.hidden = !isNewBest;
  updateBestLabels();
  setScreen('gameover');
  audio.update({ active: false });
}

function updateBestLabels() {
  try {
    best = Math.max(best, Number(localStorage.getItem('roadster-rocket-best') || 0) || 0);
  } catch { /* storage may be blocked */ }
  bestDisplayed = best;
  const value = best > 0 ? `${best.toLocaleString('en-US')} m` : '—';
  dom.menuBest.textContent = value;
  dom.bestInline.textContent = best > 0 ? `${best.toLocaleString('en-US')} m` : '—';
}

/* =========================================================================
   camera + render
   ========================================================================= */

function updateCamera(dt, now) {
  if (!camera) return;
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 0.82;
  let desiredPosition;
  let desiredLook;
  let fovTarget;

  if (game.state === 'menu') {
    const t = now * 0.00022;
    const angle = (portrait ? 0.82 : 0.7) + Math.sin(t * 1.6) * 0.04;
    const radius = portrait ? 11.65 : 9.05;
    desiredPosition = tempVector.set(
      Math.sin(angle) * radius,
      (portrait ? 2.9 : 2.3) + Math.sin(t * 2.3) * 0.08,
      -Math.cos(angle) * radius,
    );
    desiredLook = tempVector2.set(
      portrait ? -0.15 : 2.3,
      portrait ? 0.82 : 0.66,
      0.15,
    );
    fovTarget = portrait ? 57 : 46;
  } else if (game.state === 'gameover') {
    desiredPosition = tempVector.set(
      game.carX * 0.36 + Math.sin(now * 0.0002) * 0.35,
      2.75 + flight.altitude * 0.8,
      7.4 + flight.altitude * 0.24,
    );
    desiredLook = tempVector2.set(game.carX * 0.72, 0.32 + flight.altitude * 0.68, -6.2);
    fovTarget = 57;
  } else {
    const alt = flight.altitude;
    const shortLandscape = window.innerHeight < 520 && aspect > 1.5;
    if (shortLandscape) {
      desiredPosition = tempVector.set(
        game.carX * 0.32,
        3.8 + alt * 0.74 + game.speed * 0.003,
        10.5 + alt * 0.16,
      );
      desiredLook = tempVector2.set(game.carX * 0.62, 0.3 + alt * 0.72, -9);
      fovTarget = flight.active ? 62 : 60;
    } else if (portrait) {
      desiredPosition = tempVector.set(
        game.carX * 0.3,
        4.05 + alt * 0.74 + game.speed * 0.003,
        10.45 + alt * 0.18,
      );
      desiredLook = tempVector2.set(game.carX * 0.58, 0.18 + alt * 0.72, -8.5);
      fovTarget = flight.active ? 61 : 60;
    } else {
      desiredPosition = tempVector.set(
        game.carX * 0.36,
        2.78 + alt * 0.8 + game.speed * 0.004,
        7.8 + alt * 0.2,
      );
      desiredLook = tempVector2.set(game.carX * 0.68, 0.3 + alt * 0.72, -6.4);
      fovTarget = flight.active ? 57 : 54;
    }
  }

  if (!cameraInitialised) {
    cameraBase.copy(desiredPosition);
    cameraLook.copy(desiredLook);
    camera.position.copy(cameraBase);
    camera.lookAt(cameraLook);
    cameraInitialised = true;
  } else {
    const smoothing = game.state === 'menu' ? 1.8 : 4.5;
    cameraBase.x = damp(cameraBase.x, desiredPosition.x, smoothing, dt);
    cameraBase.y = damp(cameraBase.y, desiredPosition.y, smoothing, dt);
    cameraBase.z = damp(cameraBase.z, desiredPosition.z, smoothing, dt);
    cameraLook.x = damp(cameraLook.x, desiredLook.x, smoothing + 1, dt);
    cameraLook.y = damp(cameraLook.y, desiredLook.y, smoothing + 1, dt);
    cameraLook.z = damp(cameraLook.z, desiredLook.z, smoothing + 1, dt);
  }

  camera.fov = damp(camera.fov, fovTarget, 2.3, dt);
  camera.updateProjectionMatrix();

  let sx = 0;
  let sy = 0;
  if (shake > 0.001) {
    sx = (Math.random() * 2 - 1) * shake * 0.12;
    sy = (Math.random() * 2 - 1) * shake * 0.12;
    shake = damp(shake, 0, 3.4, dt);
  }

  camera.position.set(cameraBase.x + sx, cameraBase.y + sy, cameraBase.z);
  camera.lookAt(
    cameraLook.x + sx * 0.3,
    cameraLook.y + sy * 0.3,
    cameraLook.z,
  );
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!renderer) return;

  const rawDt = Math.max(0, (now - lastFrame) / 1000);
  lastFrame = now;
  const dt = Math.min(rawDt, 0.05);

  const active = game.state === 'playing' || game.state === 'crashing';
  const simulationDt = active ? dt * timeScale : 0;

  if (game.state === 'menu') {
    game.elapsed += dt;
    updateShowroom(dt, now);
    car.root.position.set(0, 0.02 + Math.sin(game.elapsed * 1.8) * 0.008, 0);
    car.root.rotation.set(0, 0, 0);
    car.update({
      dt,
      elapsed: game.elapsed,
      speed: 0,
      flight: {
        active: false,
        altitude: 0,
        maxAltitude: flight.maxAltitude,
        throttle: 0,
      },
      steer: 0,
      boost: 0,
    });
    car.shadow.position.set(0, 0.018, 0);
    car.shadow.material.opacity = 0.72;
    updateParticles(dt);
  } else if (game.state === 'playing') {
    updatePlaying(simulationDt);
    updateParticles(dt);
    updateHUD();
    updateAlert();
  } else if (game.state === 'crashing') {
    updateCrashing(dt);
    updateHUD();
    hideAlert();
  } else if (game.state === 'gameover') {
    updateParticles(dt * 0.7);
    updateCarTransform(dt);
    updateCamera(dt, now);
    shake = damp(shake, 0, 2.2, dt);
    renderer.render(scene, camera);
    audio.update({ active: false });
    return;
  } else if (game.state === 'paused') {
    // Preserve the frozen frame.
    renderer.render(scene, camera);
    return;
  }

  if (game.state === 'playing') {
    updateCamera(dt, now);
    audio.update({
      active: true,
      speed: game.speed,
      flight: flight.active,
      ready: game.charge >= 99.9 && !flight.active,
    });
    if (game.toastTimer > 0) {
      game.toastTimer -= dt;
      if (game.toastTimer <= 0) dom.toast.classList.remove('is-visible');
    }
  } else {
    updateCamera(dt, now);
  }

  renderer.render(scene, camera);
}

function updateShowroom(dt, now) {
  const pulse = 0.4 + Math.sin(now * 0.002) * 0.11;
  showroomRing.material.opacity = pulse;
  showroomRingOuter.material.opacity = 0.1 + Math.sin(now * 0.0014 + 1) * 0.045;
  showroomRing.rotation.z += dt * 0.06;
  showroomRingOuter.rotation.z -= dt * 0.035;
  showroomGlow.material.opacity = 0.1 + Math.sin(now * 0.0018) * 0.025;
  if (game.showcaseLight) {
    game.showcaseLight.intensity = 28 + Math.sin(now * 0.001) * 5;
  }
  if (game.showcaseRim) {
    game.showcaseRim.intensity = 22 + Math.sin(now * 0.0016 + 1) * 4;
  }

  // Looping shimmer pinpoints hovering around the car on the menu stage.
  if (Math.random() < dt * 14) {
    const angle = Math.random() * Math.PI * 2;
    const radius = random(2.4, 4.3);
    spawnParticle({
      x: Math.cos(angle) * radius,
      y: 0.1,
      z: Math.sin(angle) * radius,
      vx: 0,
      vy: random(0.1, 0.35),
      vz: 0,
      color: Math.random() > 0.2 ? 0x55e6ff : 0xff7e66,
      size: random(0.04, 0.11),
      life: random(0.7, 1.7),
      drag: 0.15,
    });
  }
}

/* =========================================================================
   HUD
   ========================================================================= */

function setTextIfChanged(key, element, value) {
  if (uiCache[key] !== value) {
    uiCache[key] = value;
    element.textContent = value;
  }
}

function updateHUD(force = false) {
  const meters = Math.floor(game.distance);
  setTextIfChanged('distance', dom.distance, meters.toLocaleString('en-US'));
  setTextIfChanged('speed', dom.speed, String(Math.round(game.speed * 3.6)));
  setTextIfChanged('difficulty', dom.difficulty, String(game.difficultyLevel).padStart(2, '0'));
  setTextIfChanged(
    'speedCap',
    dom.speedCap,
    String(Math.round(speedCapForLevel(game.difficultyLevel) * 3.6)),
  );

  const charge = clamp(game.charge, 0, 100);
  const chargeRounded = Math.round(charge);
  setTextIfChanged('charge', dom.chargeValue, String(chargeRounded));
  dom.pressureFill.style.transform = `scaleX(${charge / 100})`;

  const ready = charge >= 99.5 && !flight.active && flight.phase === 'ground' && game.state === 'playing';
  const landing = flight.phase === 'stabilize' || flight.phase === 'descend';
  document.body.classList.toggle('is-ready', ready);
  document.body.classList.toggle('is-flying', flight.active);
  document.body.classList.toggle('is-landing', landing);

  if (flight.active) {
    if (flight.phase === 'stabilize') {
      setTextIfChanged('chargeState', dom.chargeState, 'STABILIZING');
      setTextIfChanged('flightHint', dom.flightHint, '侧滚姿态回正 · 底盘反推准备着陆');
      setTextIfChanged('mode', dom.modeChipText, 'LANDING SEQUENCE');
    } else {
      setTextIfChanged('chargeState', dom.chargeState, 'DISCHARGING');
      setTextIfChanged('flightHint', dom.flightHint,
        flight.phase === 'ascend' ? '底盘与尾部同时点火 · 爬升中' : '空中侧滚姿态 · 蓝条耗尽后自动着陆');
      setTextIfChanged('mode', dom.modeChipText, flight.phase === 'ascend' ? 'TAKEOFF SEQUENCE' : 'FLIGHT MODE');
    }
  } else if (flight.phase === 'descend') {
    setTextIfChanged('chargeState', dom.chargeState, 'PURGING');
    setTextIfChanged('flightHint', dom.flightHint, '底盘反推 · 平稳着陆中');
    setTextIfChanged('mode', dom.modeChipText, 'AUTO LANDING');
  } else if (ready) {
    setTextIfChanged('chargeState', dom.chargeState, 'FULL PRESSURE');
    setTextIfChanged('flightHint', dom.flightHint, '蓝条已满 · 按 SPACE 启动冷气推进');
    setTextIfChanged('mode', dom.modeChipText, 'TAKEOFF READY');
  } else {
    const rate = 9.5 + Math.min(game.distance * 0.0004, 2.4);
    const seconds = Math.max(0, Math.ceil((100 - charge) / rate));
    setTextIfChanged('chargeState', dom.chargeState, 'CHARGING');
    setTextIfChanged('flightHint', dom.flightHint, `地面行驶自动充能 · 约 ${seconds}s`);
    setTextIfChanged('mode', dom.modeChipText, 'GROUND MODE');
  }

  if (game.state === 'playing' && !flight.active) {
    dom.touchFly.style.opacity = ready ? '1' : '0.55';
  } else {
    dom.touchFly.style.opacity = '';
  }

  if (force) {
    uiCache = {};
  }
}

function updateAlert() {
  if (!world.gate || flight.active || game.state !== 'playing') {
    hideAlert();
    return;
  }
  const distanceToGate = Math.max(0, Math.round(-world.gate.position.z - 2));
  if (distanceToGate > 180 || distanceToGate < 1) {
    hideAlert();
    return;
  }
  dom.hudAlert.classList.add('is-visible');
  setTextIfChanged('alertTitle', dom.hudAlertTitle, '全路障封锁线');
  const chargeReady = game.charge >= 99.5;
  setTextIfChanged(
    'alertSub',
    dom.hudAlertSub,
    chargeReady ? '无法绕行 · 按 SPACE 起飞越过' : '无法绕行 · 保持冷气充能',
  );
  setTextIfChanged('alertDistance', dom.hudAlertDistance, `${distanceToGate}m`);
}

function hideAlert() {
  dom.hudAlert.classList.remove('is-visible');
}

function showToast(message, duration = 2) {
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');
  game.toastTimer = duration;
}

function flashScreen(element) {
  element.classList.remove('is-active');
  // Force a reflow so repeated calls restart the animation.
  void element.offsetWidth;
  element.classList.add('is-active');
}

function damageFlash(element) {
  element.classList.remove('is-active');
  void element.offsetWidth;
  element.classList.add('is-active');
}

function updateMenuBestIfNeeded() {
  updateBestLabels();
}

/* =========================================================================
   input + lifecycle
   ========================================================================= */

function bindEvents() {
  dom.startBtn.addEventListener('click', () => {
    startGame();
  });

  dom.restartBtn.addEventListener('click', () => {
    startGame();
  });

  dom.menuBtn.addEventListener('click', () => {
    goToMenu();
  });

  dom.pauseBtn.addEventListener('click', () => {
    pauseGame();
  });

  dom.resumeBtn.addEventListener('click', () => {
    resumeGame();
  });

  dom.restartFromPauseBtn.addEventListener('click', () => {
    startGame();
  });

  dom.soundBtn.addEventListener('click', () => {
    audio.unlock();
    const muted = audio.toggleMuted();
    document.body.classList.toggle('is-muted', muted);
  });

  dom.touchLeft.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    steer(-1);
  });
  dom.touchRight.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    steer(1);
  });
  dom.touchFly.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    tryFly();
  });

  window.addEventListener('keydown', onKeyDown);

  dom.canvas.addEventListener('pointerdown', (event) => {
    if (game.state !== 'playing') return;
    pointerStart = { x: event.clientX, y: event.clientY };
  });
  dom.canvas.addEventListener('pointerup', (event) => {
    if (!pointerStart || game.state !== 'playing') {
      pointerStart = null;
      return;
    }
    const dx = event.clientX - pointerStart.x;
    if (Math.abs(dx) > 40) {
      steer(dx > 0 ? 1 : -1);
    }
    pointerStart = null;
  });
  dom.canvas.addEventListener('pointercancel', () => { pointerStart = null; });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state === 'playing') pauseGame();
  });

  window.addEventListener('blur', () => {
    if (game.state === 'playing') pauseGame();
  });
}

function onKeyDown(event) {
  const { code } = event;
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(code)) {
    event.preventDefault();
  }

  if (code === 'KeyM') {
    dom.soundBtn.click();
    return;
  }

  if (game.state === 'menu') {
    if (code === 'Space' || code === 'Enter') {
      startGame();
    }
    return;
  }

  if (game.state === 'gameover') {
    if (code === 'KeyR' || code === 'Enter' || code === 'Space') {
      startGame();
    }
    return;
  }

  if (game.state === 'paused') {
    if (code === 'KeyP' || code === 'Escape') resumeGame();
    if (code === 'KeyR') startGame();
    return;
  }

  if (game.state === 'playing') {
    if (code === 'KeyA' || code === 'ArrowLeft') steer(-1);
    else if (code === 'KeyD' || code === 'ArrowRight') steer(1);
    else if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') tryFly();
    else if (code === 'KeyP' || code === 'Escape') pauseGame();
    else if (code === 'KeyR') startGame();
  }
}

function resize() {
  if (!renderer || !camera) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  particles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 1.8);
  cameraInitialised = false;
}

/* =========================================================================
   debug API (useful for QA and automated screenshots)
   ========================================================================= */

window.__RR_DEBUG__ = {
  get game() { return game; },
  get flight() { return flight; },
  get world() { return world; },
  get camera() { return camera; },
  get car() { return car; },
  start() { startGame(); },
  steer,
  fly() { game.charge = 100; return tryFly(true); },
  setCharge(value) { game.charge = clamp(value, 0, 100); },
  spawnGate() { spawnGate(); },
  crash() { if (game.state === 'playing') triggerCrash({ obstacle: world.obstacles[0], box: null }); },
  setDistance(value) { game.distance = value; },
  clear() { world.clearObstacles(); },
  snapCamera() {
    cameraInitialised = false;
    updateCamera(1 / 60, performance.now());
    renderer.render(scene, camera);
  },
  advance(seconds = 1, step = 1 / 60) {
    const iterations = Math.min(3600, Math.ceil(seconds / step));
    for (let i = 0; i < iterations; i += 1) {
      if (game.state === 'playing') {
        updatePlaying(step);
        updateParticles(step);
      } else if (game.state === 'crashing') {
        updateCrashing(step);
        updateParticles(step);
      } else {
        break;
      }
    }
    updateHUD();
    updateAlert();
    return this.snapshot();
  },
  snapshot() {
    return {
      screen: document.body.dataset.screen,
      state: game.state,
      distance: Math.floor(game.distance),
      speed: Math.round(game.speed * 3.6),
      speedCap: Math.round(speedCapForLevel(game.difficultyLevel) * 3.6),
      difficultyLevel: game.difficultyLevel,
      charge: Math.round(game.charge),
      altitude: Number(flight.altitude.toFixed(2)),
      flightActive: flight.active,
      gateZ: world.gate ? Math.round(world.gate.position.z) : null,
      obstacles: world.obstacles.length,
    };
  },
};

// Start once the DOM and module are ready.
boot();

