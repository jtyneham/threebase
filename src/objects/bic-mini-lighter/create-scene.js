import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createBicMiniLighterModel } from './create-model.ts';

const INITIAL_MODEL_ROTATION = [0, 0, 0];

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

export function createBicMiniLighterScene({
  renderer,
  quality,
  requestRender,
  onStatus,
  onActionStateChange,
}) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1012');
  scene.fog = new THREE.Fog('#0d1012', 145, 240);

  const environmentGenerator = new THREE.PMREMGenerator(renderer);
  const environmentTarget = environmentGenerator.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environmentTarget.texture;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(46, 15, 128);

  const model = createBicMiniLighterModel();
  model.rotation.set(...INITIAL_MODEL_ROTATION);
  scene.add(model);

  scene.add(new THREE.HemisphereLight(0xe8f2ff, 0x25292d, 0.72));
  const keyLight = new THREE.DirectionalLight(0xffebd4, 2.15);
  keyLight.position.set(-65, 105, 100);
  keyLight.castShadow = true;
  const shadowSize = quality.pixelRatio <= 1.5 ? 1024 : 2048;
  keyLight.shadow.mapSize.set(shadowSize, shadowSize);
  keyLight.shadow.camera.near = 20;
  keyLight.shadow.camera.far = 260;
  keyLight.shadow.camera.left = -70;
  keyLight.shadow.camera.right = 70;
  keyLight.shadow.camera.top = 80;
  keyLight.shadow.camera.bottom = -80;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xaed8ff, 1.2);
  rimLight.position.set(80, 35, -80);
  scene.add(rimLight);
  const faceLight = new THREE.DirectionalLight(0xf8fbff, 0.48);
  faceLight.position.set(-15, -10, 110);
  scene.add(faceLight);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.ShadowMaterial({ opacity: 0.24 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -31.6;
  ground.receiveShadow = true;
  scene.add(ground);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.minDistance = 72;
  controls.maxDistance = 210;
  controls.target.set(0, 2.5, 0);
  controls.update();
  controls.saveState();
  controls.addEventListener('change', requestRender);

  const runtime = model.userData.sculptRuntime;
  const wheel = runtime.nodes['spark-wheel'];
  const lever = runtime.nodes['fuel-lever'];
  const flame = runtime.nodes['flame-effect'];
  let actionActive = false;
  let actionElapsed = 0;
  let wheelBase = 0;

  function finishAction() {
    actionActive = false;
    lever.rotation.z = 0;
    flame.visible = false;
    flame.scale.set(1, 1, 1);
    flame.rotation.y = 0;
    onActionStateChange?.(false);
    onStatus?.('Ready to inspect');
  }

  function flick() {
    if (actionActive) return false;
    actionActive = true;
    actionElapsed = 0;
    wheelBase = wheel.rotation.z;
    onActionStateChange?.(true);
    onStatus?.('Striker engaged');
    requestRender();
    return true;
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
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      flick();
      return;
    } else return;

    event.preventDefault();
    onStatus?.('Object rotated');
    requestRender();
  }

  renderer.domElement.addEventListener('keydown', handleKeydown);

  return {
    scene,
    camera,
    wantsContinuousRendering: false,
    flick,
    resetView,
    update({ delta, reducedMotion }) {
      if (!actionActive) return false;
      actionElapsed += delta;

      if (reducedMotion) {
        wheel.rotation.z = wheelBase - Math.PI * 1.8;
        lever.rotation.z = -0.13;
        flame.visible = true;
        if (actionElapsed >= 1.5) finishAction();
        return actionActive;
      }

      const strike = THREE.MathUtils.smoothstep(Math.min(actionElapsed / 0.28, 1), 0, 1);
      wheel.rotation.z = wheelBase - strike * Math.PI * 2.25;
      lever.rotation.z = -Math.sin(Math.min(actionElapsed / 0.34, 1) * Math.PI * 0.5) * 0.14;
      flame.visible = actionElapsed > 0.18 && actionElapsed < 2;
      if (flame.visible) {
        flame.scale.y = 0.9 + Math.sin(actionElapsed * 34) * 0.09;
        flame.rotation.y = Math.sin(actionElapsed * 17) * 0.08;
      }
      if (actionElapsed >= 2.3) finishAction();
      return actionActive;
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
