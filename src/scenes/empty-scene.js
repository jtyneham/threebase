import { PerspectiveCamera, Scene } from 'three';

// This deliberately renders nothing. It proves the shared lifecycle works
// without allowing a placeholder visual to become the project's architecture.
export function createEmptyScene() {
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 5;

  return {
    scene,
    camera,
    update() {},
    resize() {},
    dispose() {},
    wantsContinuousRendering: false,
  };
}
