import { mountExperience } from '../../core/experience.js';
import { initSiteShell } from '../../site-shell.js';
import { createBicMiniLighterScene } from './create-scene.js';

const disposeNavigation = initSiteShell();
const canvas = document.querySelector('[data-object-scene]');
const flickButton = document.querySelector('[data-lighter-flick]');
const resetButton = document.querySelector('[data-view-reset]');
const statusElement = document.querySelector('[data-object-status]');

let sceneController;

function setStatus(message) {
  statusElement.textContent = message;
}

function setActionBusy(busy) {
  flickButton.disabled = busy;
}

const disposeExperience = mountExperience({
  canvas,
  statusElement,
  createScene: (context) => createBicMiniLighterScene({
    ...context,
    onStatus: setStatus,
    onActionStateChange: setActionBusy,
  }),
  onReady(controller) {
    sceneController = controller;
    flickButton.disabled = false;
    resetButton.disabled = false;
    setStatus('Ready to inspect');
  },
});

flickButton.addEventListener('click', () => sceneController?.flick());
resetButton.addEventListener('click', () => sceneController?.resetView());

window.addEventListener(
  'pagehide',
  () => {
    disposeNavigation();
    disposeExperience();
  },
  { once: true },
);
