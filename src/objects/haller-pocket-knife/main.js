import { mountExperience } from '../../core/experience.js';
import { initSiteShell } from '../../site-shell.js';
import { createHallerPocketKnifeScene } from './create-scene.js';

const disposeNavigation = initSiteShell();
const canvas = document.querySelector('[data-object-scene]');
const bladeButton = document.querySelector('[data-blade-toggle]');
const resetButton = document.querySelector('[data-view-reset]');
const statusElement = document.querySelector('[data-object-status]');

let sceneController;
let bladeOpen = false;

function setStatus(message) {
  statusElement.textContent = message;
}

function updateBladeButton() {
  bladeButton.textContent = bladeOpen ? 'Close blade' : 'Open blade';
  bladeButton.setAttribute('aria-pressed', String(bladeOpen));
}

const disposeExperience = mountExperience({
  canvas,
  statusElement,
  createScene: (context) => createHallerPocketKnifeScene({ ...context, onStatus: setStatus }),
  onReady(controller) {
    sceneController = controller;
    bladeButton.disabled = false;
    resetButton.disabled = false;
    setStatus('Blade closed');
  },
});

bladeButton.addEventListener('click', () => {
  bladeOpen = !bladeOpen;
  sceneController?.setBladeOpen(bladeOpen);
  updateBladeButton();
});

resetButton.addEventListener('click', () => sceneController?.resetView());
updateBladeButton();

window.addEventListener(
  'pagehide',
  () => {
    disposeNavigation();
    disposeExperience();
  },
  { once: true },
);
