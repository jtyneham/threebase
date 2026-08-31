import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createHallerPocketKnifeModel } from './create-model.js';

const INITIAL_MODEL_ROTATION = [-0.07, -0.04, 0];

function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of objectMaterials) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
    }
  });

  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

export function createHallerPocketKnifeScene({
  renderer,
  quality,
  requestRender,
  onStatus,
}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#11130f');

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = environmentGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environmentTarget.texture;

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 500);
  camera.position.set(8, 18, 240);

  const model = createHallerPocketKnifeModel();
  model.rotation.set(...INITIAL_MODEL_ROTATION);
  scene.add(model);

  scene.add(new THREE.HemisphereLight(0xfff7e8, 0x30352d, 0.65));
  const keyLight = new THREE.DirectionalLight(0xffedcf, 1.2);
  keyLight.position.set(-80, 110, 130);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xb9d7ff, 0.8);
  rimLight.position.set(90, 30, -90);
  scene.add(rimLight);
  const faceLight = new THREE.DirectionalLight(0xf5fbff, 0.5);
  faceLight.position.set(-20, -15, 160);
  scene.add(faceLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 90;
  controls.maxDistance = 440;
  controls.target.set(8, 0, 0);
  controls.update();
  controls.saveState();
  controls.addEventListener('change', requestRender);

  const bladePivot = model.userData.sculptRuntime.nodes['blade-pivot'];
  const { closedAngle, openAngle } = model.userData.bladeState;
  let bladeOpen = false;
  let bladeAngle = closedAngle;
  let targetBladeAngle = closedAngle;
  let viewportSize = { width: 1, height: 1 };
  bladePivot.rotation.z = bladeAngle;

  function fitCamera() {
    const aspect = viewportSize.width / Math.max(viewportSize.height, 1);
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const objectWidth = bladeOpen ? 150 : 100;
    const widthFitDistance = objectWidth / (2 * Math.tan(verticalFov / 2) * aspect);
    const fitDistance = THREE.MathUtils.clamp(
      widthFitDistance,
      bladeOpen ? 220 : 175,
      400,
    );
    const viewDirection = camera.position.clone().sub(controls.target).normalize();
    controls.target.set(bladeOpen ? 8 : 35, 0, 0);
    camera.position.copy(controls.target).addScaledVector(viewDirection, fitDistance);
    controls.maxDistance = Math.max(440, fitDistance * 1.25);
    controls.update();
    controls.saveState();
  }

  function setBladeOpen(open) {
    bladeOpen = Boolean(open);
    targetBladeAngle = bladeOpen ? openAngle : closedAngle;
    fitCamera();
    if (quality.reducedMotion) {
      bladeAngle = targetBladeAngle;
      bladePivot.rotation.z = bladeAngle;
    }
    onStatus?.(`Blade ${bladeOpen ? 'open' : 'closed'}`);
    requestRender();
  }

  function resetView() {
    controls.reset();
    model.rotation.set(...INITIAL_MODEL_ROTATION);
    onStatus?.('View reset');
    requestRender();
  }

  function handleKeydown(event) {
    const rotationStep = Math.PI / 18;
    if (event.key === 'ArrowLeft') model.rotation.y -= rotationStep;
    else if (event.key === 'ArrowRight') model.rotation.y += rotationStep;
    else if (event.key === 'ArrowUp') model.rotation.x -= rotationStep;
    else if (event.key === 'ArrowDown') model.rotation.x += rotationStep;
    else if (event.key === 'Home') {
      event.preventDefault();
      resetView();
      return;
    }
    else return;

    event.preventDefault();
    onStatus?.('Object rotated');
    requestRender();
  }

  renderer.domElement.addEventListener('keydown', handleKeydown);
  onStatus?.('Blade closed');

  return {
    scene,
    camera,
    wantsContinuousRendering: false,
    setBladeOpen,
    resetView,
    update({ delta, reducedMotion }) {
      if (reducedMotion) {
        bladeAngle = targetBladeAngle;
        bladePivot.rotation.z = bladeAngle;
        return false;
      }

      bladeAngle = THREE.MathUtils.damp(bladeAngle, targetBladeAngle, 8, delta);
      bladePivot.rotation.z = bladeAngle;
      return Math.abs(bladeAngle - targetBladeAngle) > 0.001;
    },
    resize({ width, height }) {
      viewportSize = { width, height };
      fitCamera();
      requestRender();
    },
    dispose() {
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('keydown', handleKeydown);
      environmentTarget.dispose();
      environmentGenerator.dispose();
      disposeObject(scene);
      scene.environment = null;
    },
  };
}
