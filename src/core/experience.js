import { WebGLRenderer } from 'three';
import { getQualityProfile, observeReducedMotion } from './quality.js';
import { createRenderLoop } from './render-loop.js';
import { observeRendererSize } from './resize-controller.js';

function setStatus(element, message) {
  if (element) element.textContent = message;
}

export function mountExperience({ canvas, statusElement, createScene }) {
  if (!canvas) return () => {};

  const quality = getQualityProfile();
  let renderer;

  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: quality.antialias,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.warn('Threebase could not initialize WebGL.', error);
    canvas.hidden = true;
    setStatus(statusElement, 'Interactive 3D is unavailable on this device.');
    return () => {};
  }

  const sceneModule = createScene({ renderer, quality });
  const loop = createRenderLoop(({ elapsed, delta }) => {
    sceneModule.update?.({ elapsed, delta, reducedMotion: quality.reducedMotion });
    renderer.render(sceneModule.scene, sceneModule.camera);
  });

  const stopResize = observeRendererSize({
    container: canvas.parentElement,
    renderer,
    camera: sceneModule.camera,
    pixelRatio: quality.pixelRatio,
    onResize: (viewport) => {
      sceneModule.resize?.(viewport);
      loop.invalidate();
    },
  });

  const stopMotionObserver = observeReducedMotion((reducedMotion) => {
    quality.reducedMotion = reducedMotion;
    loop.setContinuous(sceneModule.wantsContinuousRendering && !reducedMotion);
    loop.invalidate();
  });

  function handleContextLost(event) {
    event.preventDefault();
    loop.setContinuous(false);
    setStatus(statusElement, 'The 3D canvas paused because its graphics context was lost.');
  }

  function handleContextRestored() {
    setStatus(statusElement, '');
    loop.setContinuous(sceneModule.wantsContinuousRendering && !quality.reducedMotion);
    loop.invalidate();
  }

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);
  loop.setContinuous(sceneModule.wantsContinuousRendering && !quality.reducedMotion);
  loop.invalidate();

  return () => {
    stopResize();
    stopMotionObserver();
    loop.dispose();
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    sceneModule.dispose?.();
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
