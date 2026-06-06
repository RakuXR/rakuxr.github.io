// splat-viewer.js
// Honest, configurable Gaussian-splat viewer for capture.html.
//
// Design notes (read before editing):
//   * "Fake success is forbidden." This file MUST NOT pretend to render a splat
//     it has not actually loaded. If data-splat-url is missing or set to the
//     sentinel "PENDING", the placeholder children inside #splat-viewer stay
//     visible and we log an operator hint to the console. We never swap in a
//     fake canvas or a static image and call it a splat.
//   * The renderer is Spark (https://github.com/sparkjsdev/spark), MIT-licensed,
//     loaded from its official CDN at sparkjs.dev. three.js is loaded from
//     jsdelivr. Both hosts are explicitly allowlisted in the page CSP.
//   * No bundler. This is plain ESM that runs as <script type="module">.
//   * ASCII-only on purpose so this file is safe to edit from any tool.

const MOUNT_ID = 'splat-viewer';
const SENTINEL_PENDING = 'PENDING';
const SPARK_MODULE_URL = 'https://sparkjs.dev/releases/spark/2.1.0/spark.module.js';
const THREE_MODULE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

function logOperatorHint(reason) {
  // One line, prefixed so an operator can grep for it in the browser console.
  // No emojis, ASCII only.
  console.info(
    '[raku-capture] splat viewer not mounted: ' + reason +
    ' -- set #' + MOUNT_ID + '[data-splat-url] to a real .spz/.ply URL to enable.'
  );
}

function hidePlaceholderChildren(mount) {
  // Hide rather than remove so the DOM remains inspectable and the placeholder
  // can come back if the renderer fails to initialize.
  const children = mount.querySelectorAll('.viewer-badge, .viewer-headline, .viewer-note');
  children.forEach((el) => { el.style.display = 'none'; });
}

function showPlaceholderChildren(mount) {
  const children = mount.querySelectorAll('.viewer-badge, .viewer-headline, .viewer-note');
  children.forEach((el) => { el.style.display = ''; });
}

function addSampleLabel(mount) {
  // When a sample scene is loaded (operator opted in to a non-user URL), we
  // label it honestly so visitors never mistake it for their own capture.
  const label = document.createElement('div');
  label.className = 'viewer-sample-label';
  label.textContent = 'Sample scene -- your scans replace this when ready';
  label.style.cssText = [
    'position:absolute',
    'left:12px',
    'bottom:12px',
    'padding:6px 10px',
    'border-radius:999px',
    'background:rgba(10,10,26,0.78)',
    'border:1px solid #2a2a4a',
    'color:#cfc8ff',
    'font-size:0.72rem',
    'letter-spacing:0.04em',
    'pointer-events:none',
    'z-index:2'
  ].join(';');
  mount.appendChild(label);
}

async function mountViewer(mount, splatUrl) {
  // Dynamically import Spark + three only when we actually have a URL to load.
  // This keeps the page light when the viewer is in PENDING state.
  let THREE;
  let Spark;
  try {
    THREE = await import(THREE_MODULE_URL);
    Spark = await import(SPARK_MODULE_URL);
  } catch (err) {
    logOperatorHint('failed to load Spark or three.js from CDN (' + (err && err.message ? err.message : err) + ')');
    return;
  }

  const SplatMesh = Spark.SplatMesh;
  if (!SplatMesh) {
    logOperatorHint('Spark module did not export SplatMesh');
    return;
  }

  // Build the canvas + renderer.
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block;border-radius:14px;';
  // The wrapper is position:relative, so absolutely positioning the canvas
  // lets the placeholder children be hidden by display:none above without
  // disturbing flexbox metrics.
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';

  mount.appendChild(canvas);

  const rect = mount.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
  camera.position.set(0, 0, 3);

  let splat;
  try {
    splat = new SplatMesh({ url: splatUrl });
  } catch (err) {
    logOperatorHint('SplatMesh constructor threw: ' + (err && err.message ? err.message : err));
    mount.removeChild(canvas);
    showPlaceholderChildren(mount);
    return;
  }

  // Spark's SplatMesh is a THREE.Object3D-compatible mesh.
  scene.add(splat);

  // Minimal orbit-style drag: pointer events rotate yaw/pitch on the splat.
  // We intentionally do NOT depend on OrbitControls so we avoid a second
  // CDN dependency and keep the script CSP surface as small as possible.
  let yaw = 0;
  let pitch = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function onPointerDown(ev) {
    dragging = true;
    lastX = ev.clientX;
    lastY = ev.clientY;
    mount.style.cursor = 'grabbing';
    canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
  }
  function onPointerMove(ev) {
    if (!dragging) return;
    const dx = ev.clientX - lastX;
    const dy = ev.clientY - lastY;
    lastX = ev.clientX;
    lastY = ev.clientY;
    yaw += dx * 0.005;
    pitch += dy * 0.005;
    // Clamp pitch so we don't flip the model upside-down by accident.
    const limit = Math.PI / 2 - 0.05;
    if (pitch > limit) pitch = limit;
    if (pitch < -limit) pitch = -limit;
  }
  function onPointerUp(ev) {
    dragging = false;
    mount.style.cursor = 'grab';
    canvas.releasePointerCapture && canvas.releasePointerCapture(ev.pointerId);
  }
  function onWheel(ev) {
    ev.preventDefault();
    const factor = Math.exp(ev.deltaY * 0.001);
    camera.position.multiplyScalar(factor);
    // Keep within a sane zoom range.
    const dist = camera.position.length();
    if (dist < 0.3) camera.position.setLength(0.3);
    if (dist > 50) camera.position.setLength(50);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function resize() {
    const r = mount.getBoundingClientRect();
    const w = Math.max(1, Math.floor(r.width));
    const h = Math.max(1, Math.floor(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function tick() {
    splat.rotation.y = yaw;
    splat.rotation.x = pitch;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }

  // Hide placeholder children only once we've actually constructed the mesh.
  // The splat may still be downloading in the background, but the renderer is
  // mounted and producing frames -- this is not fake success.
  hidePlaceholderChildren(mount);
  addSampleLabel(mount);
  requestAnimationFrame(tick);
}

function init() {
  const mount = document.getElementById(MOUNT_ID);
  if (!mount) {
    // Page does not include the viewer mount -- nothing to do.
    return;
  }
  const splatUrl = (mount.getAttribute('data-splat-url') || '').trim();
  if (!splatUrl) {
    logOperatorHint('data-splat-url attribute is empty');
    return;
  }
  if (splatUrl === SENTINEL_PENDING) {
    logOperatorHint('data-splat-url is the sentinel "PENDING"');
    return;
  }
  // Defensive: only http(s) URLs are mounted. This blocks accidental
  // file:// or javascript: values from being passed through to fetch.
  if (!/^https?:\/\//i.test(splatUrl)) {
    logOperatorHint('data-splat-url is not an http(s) URL: ' + splatUrl);
    return;
  }
  mountViewer(mount, splatUrl);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
