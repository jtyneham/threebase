import { initSiteShell } from './site-shell.js';

const disposeNavigation = initSiteShell();

let disposed = false;
let disposeExperience = () => {};

async function startExperience() {
  const [{ mountExperience }, { createEmptyScene }] = await Promise.all([
    import('./core/experience.js'),
    import('./scenes/empty-scene.js'),
  ]);

  if (disposed) return;
  disposeExperience = mountExperience({
    canvas: document.querySelector('[data-scene]'),
    statusElement: document.querySelector('[data-scene-status]'),
    createScene: createEmptyScene,
  });
}

if ('requestIdleCallback' in window) {
  window.requestIdleCallback(startExperience, { timeout: 1000 });
} else {
  window.setTimeout(startExperience, 0);
}

window.addEventListener(
  'pagehide',
  () => {
    disposed = true;
    disposeNavigation();
    disposeExperience();
  },
  { once: true },
);
