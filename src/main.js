import './styles/global.css';
import { playgroundEntries, objectEntries } from './content/catalog.js';
import { initCollectionNavigation } from './ui/collection-navigation.js';
import { renderCollections } from './ui/render-collections.js';

renderCollections({ playgroundEntries, objectEntries });
const disposeNavigation = initCollectionNavigation({ playgroundEntries, objectEntries });

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
