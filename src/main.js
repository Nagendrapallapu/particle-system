import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { HandInput } from './HandInput.js';
import { ParticleSystem } from './Particles.js';
import '/style.css';

// ═══════════════════════════════════════════
// DOM
// ═══════════════════════════════════════════
const loadingScreen = document.getElementById('loading-screen');
const fpsEl = document.getElementById('fps-counter');
const toggleBtn = document.getElementById('toggle-controls');
const controlsBody = document.getElementById('controls-body');

// Global error overlay
window.onerror = (msg, source, line) => {
  const d = document.createElement('div');
  Object.assign(d.style, {
    position: 'fixed', bottom: '0', left: '0', width: '100%',
    background: 'rgba(180,30,50,0.92)', color: '#fff',
    padding: '12px 16px', zIndex: '10000', fontFamily: 'monospace', fontSize: '13px',
  });
  d.innerHTML = `<strong>Error:</strong> ${msg} <small>(${source}:${line})</small>`;
  document.body.appendChild(d);
};

// ═══════════════════════════════════════════
// THREE.JS Scene
// ═══════════════════════════════════════════
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x030308, 0.003);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 500
);
camera.position.set(0, 5, 50);

const renderer = new THREE.WebGLRenderer({
  antialias: false,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.4;
controls.minDistance = 15;
controls.maxDistance = 120;
controls.enablePan = false;

// ═══════════════════════════════════════════
// Post-Processing
// ═══════════════════════════════════════════
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.4,   // strength
  0.5,   // radius
  0.15   // threshold
);
composer.addPass(bloomPass);

try {
  composer.addPass(new OutputPass());
} catch (_) {
  // OutputPass may not exist in older Three.js
}

// ═══════════════════════════════════════════
// Ambient particles (tiny background stars)
// ═══════════════════════════════════════════
const starGeo = new THREE.BufferGeometry();
const starCount = 3000;
const starPos = new Float32Array(starCount * 3);
for (let i = 0; i < starCount; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 400;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
  starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({
  color: 0x444466,
  size: 0.3,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});
scene.add(new THREE.Points(starGeo, starMat));

// ═══════════════════════════════════════════
// Systems
// ═══════════════════════════════════════════
const particleSystem = new ParticleSystem(scene);
const handInput = new HandInput();

// ═══════════════════════════════════════════
// Keyboard Controls
// ═══════════════════════════════════════════
const KEY_MAP = {
  '1': 'heart',
  '2': 'flower',
  '3': 'saturn',
  '4': 'fireworks',
  '5': 'galaxy',
  '6': 'dna',
  '7': 'star',
  '8': 'tornado',
  '0': 'sphere',
};

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (KEY_MAP[key]) {
    particleSystem.setTemplate(KEY_MAP[key]);
  } else if (key === 'c') {
    particleSystem.cycleColors();
  } else if (key === 'h') {
    controlsBody.classList.toggle('collapsed');
    toggleBtn.textContent = controlsBody.classList.contains('collapsed') ? '▶' : '▼';
  }
});

toggleBtn.addEventListener('click', () => {
  controlsBody.classList.toggle('collapsed');
  toggleBtn.textContent = controlsBody.classList.contains('collapsed') ? '▶' : '▼';
});

// ═══════════════════════════════════════════
// FPS Counter
// ═══════════════════════════════════════════
let frameCount = 0;
let lastFpsTime = performance.now();
function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 1000) {
    if (fpsEl) fpsEl.textContent = `${frameCount} FPS`;
    frameCount = 0;
    lastFpsTime = now;
  }
}

// ═══════════════════════════════════════════
// Animation Loop
// ═══════════════════════════════════════════
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // Cap dt

  controls.update();

  // Subtle camera sway based on hand position
  if (handInput.isReady && handInput.gestures.handDetected) {
    const g = handInput.gestures;
    const targetX = g.palmCenter.x * 10 - 5;
    const targetY = -g.palmCenter.y * 6 + 3;
    camera.position.x += (targetX - camera.position.x) * 0.01;
    camera.position.y += (5 + targetY - camera.position.y) * 0.01;
  }

  particleSystem.update(dt, handInput.isReady ? handInput.gestures : {});
  composer.render();
  updateFPS();
}

// ═══════════════════════════════════════════
// Resize
// ═══════════════════════════════════════════
window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
});

// ═══════════════════════════════════════════
// Init
// ═══════════════════════════════════════════
async function init() {
  await handInput.init();

  // Start regardless of camera success
  setTimeout(() => {
    if (loadingScreen) loadingScreen.classList.add('hidden');
  }, 300);

  animate();
}

init();
